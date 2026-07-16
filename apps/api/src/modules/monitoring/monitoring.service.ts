import { createHash, randomUUID } from "node:crypto";

import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { OnModuleInit } from "@nestjs/common";
import { AssignmentStatus, DeviceLifecycleStatus, Prisma } from "@prisma/client";
import type { CanonicalNodeType } from "@gss-iot/contracts";

import type { AuthTokenPayload } from "../../common/auth.types";
import { AUTH_CONTEXT } from "../../common/auth.types";
import { PrismaService } from "../../prisma/prisma.service";
import type { MqttSensorMessageMetadata } from "../mqtt/mqtt-client.service";
import { MqttClientService } from "../mqtt/mqtt-client.service";
import { MqttPayloadParserService } from "../mqtt/mqtt-payload-parser.service";
import type { ParsedSensorMessage } from "../mqtt/mqtt-payload-parser.service";
import { MqttTopicService } from "../mqtt/mqtt-topic.service";
import { PermissionResolverService } from "../rbac/permission-resolver.service";
import { mapLatestState, mapSensorReading, toPrismaStatus } from "./monitoring-mappers";
import { MonitoringRealtimeService } from "./monitoring-realtime.service";

const nodeTypeSelect = {
  displayName: true,
  id: true,
  imageAssetKey: true,
  key: true,
  numericCode: true,
} satisfies Prisma.NodeTypeSelect;

const latestStateSelect = {
  areaId: true,
  building: { select: { id: true, title: true } },
  buildingId: true,
  companyId: true,
  gateway: { select: { id: true, serialNumber: true } },
  gatewayId: true,
  lastSeenAt: true,
  node: { select: { id: true, installedLocation: true, number: true } },
  nodeId: true,
  nodeType: { select: nodeTypeSelect },
  nodeTypeId: true,
  status: true,
  updatedAt: true,
  values: true,
} satisfies Prisma.LatestNodeStateSelect;

const readingSelect = {
  buildingId: true,
  gateway: { select: { id: true, serialNumber: true } },
  gatewayId: true,
  id: true,
  measuredAt: true,
  node: { select: { id: true, installedLocation: true, number: true } },
  nodeId: true,
  nodeType: { select: nodeTypeSelect },
  nodeTypeId: true,
  receivedAt: true,
  status: true,
  values: true,
} satisfies Prisma.SensorReadingSelect;

type AssignmentContext = {
  areaId: string;
  buildingId: string;
  companyId: string;
  gatewayId: string;
  nodeId: string;
  nodeTypeId: string;
};

@Injectable()
export class MonitoringService implements OnModuleInit {
  private readonly logger = new Logger(MonitoringService.name);
  readonly retentionDays = 180;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MqttPayloadParserService) private readonly parser: MqttPayloadParserService,
    @Inject(MqttTopicService) private readonly topics: MqttTopicService,
    @Inject(MqttClientService) private readonly mqtt: MqttClientService,
    @Inject(PermissionResolverService)
    private readonly permissions: PermissionResolverService,
    @Inject(MonitoringRealtimeService) private readonly realtime: MonitoringRealtimeService,
  ) {}

  onModuleInit(): void {
    this.mqtt.onSensorMessage((topic, payload, metadata) => {
      void this.onSensorMessage(topic, payload, metadata);
    });
  }

  onSensorMessage(topic: string, payload: Buffer, metadata: MqttSensorMessageMetadata) {
    const parsed = this.parser.parseSensorMessage(this.topics.parseSensorTopic(topic), payload);
    if (!parsed) {
      this.logger.warn(`Ignored malformed MQTT sensor payload on ${topic}.`);
      return null;
    }
    return this.persistSensorReading(parsed, topic, metadata);
  }

  simulateSensorMessage(
    topic: string,
    payload: Record<string, unknown>,
    metadata: MqttSensorMessageMetadata = {},
  ): void {
    this.mqtt.simulateSensorMessage(topic, payload, metadata);
  }

  async persistSensorReading(
    parsed: ParsedSensorMessage,
    sourceTopic: string,
    metadata: MqttSensorMessageMetadata = {},
  ) {
    const context = await this.resolveAssignmentContext(parsed);
    if (!context) {
      this.logger.warn(
        `Ignored sensor reading for unassigned or inactive device ${parsed.gatewaySerial}/${parsed.nodeNumber}.`,
      );
      return { deduplicated: false, ignored: true };
    }

    const receivedAt = metadata.receivedAt ?? new Date();
    const valueHash = this.hashValues(parsed.values);
    const dedupe = this.buildDeduplication(
      parsed,
      context,
      sourceTopic,
      receivedAt,
      valueHash,
      metadata,
    );
    const prismaStatus = toPrismaStatus(parsed.status);

    try {
      const state = await this.prisma.$transaction(async (tx) => {
        await tx.sensorReading.create({
          data: {
            ...context,
            deduplicationKey: dedupe.key,
            deduplicationSource: dedupe.source,
            gatewayMessageId: parsed.gatewayMessageId ?? metadata.packetMessageId?.toString(),
            gatewaySequence: parsed.gatewaySequence,
            measuredAt: parsed.measuredAt,
            receivedAt,
            sourceTopic,
            status: prismaStatus,
            valueHash,
            values: parsed.values as unknown as Prisma.InputJsonValue,
          },
        });

        await Promise.all([
          tx.gateway.update({
            data: { lastSeenAt: receivedAt },
            where: { id: context.gatewayId },
          }),
          tx.node.update({
            data: {
              batteryLevel:
                parsed.nodeType === "door_node" && "batteryLevel" in parsed.values
                  ? parsed.values.batteryLevel
                  : undefined,
              lastSeenAt: receivedAt,
            },
            where: { id: context.nodeId },
          }),
        ]);

        return tx.latestNodeState.upsert({
          create: {
            ...context,
            lastSeenAt: receivedAt,
            status: prismaStatus,
            values: parsed.values as unknown as Prisma.InputJsonValue,
          },
          select: latestStateSelect,
          update: {
            areaId: context.areaId,
            buildingId: context.buildingId,
            companyId: context.companyId,
            gatewayId: context.gatewayId,
            lastSeenAt: receivedAt,
            nodeTypeId: context.nodeTypeId,
            status: prismaStatus,
            values: parsed.values as unknown as Prisma.InputJsonValue,
          },
          where: { nodeId: context.nodeId },
        });
      });

      const mapped = mapLatestState(state);
      this.realtime.emitNodeState(mapped);
      return { deduplicated: false, ignored: false, state: mapped };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { deduplicated: true, ignored: false };
      }
      throw error;
    }
  }

  async listBuildingOverview(auth: AuthTokenPayload, buildingId: string) {
    await this.assertHttpAccess(auth, buildingId);
    const building = await this.getBuildingOrThrow(buildingId);
    const nodeTypes = await this.prisma.nodeType.findMany({
      orderBy: { numericCode: "asc" },
      select: nodeTypeSelect,
    });
    const summaries = await Promise.all(
      nodeTypes.map(async (nodeType) => {
        const nodes = await this.findActiveBuildingNodes(buildingId, nodeType.key);
        const latestStatus =
          nodes
            .map(({ latestState }) => latestState?.status)
            .filter((status): status is NonNullable<typeof status> => Boolean(status))
            .sort()[0] ?? null;
        return {
          count: nodes.length,
          latestStatus: latestStatus ? latestStatus.toLowerCase() : null,
          nodeType,
        };
      }),
    );
    return { building, nodeTypes: summaries };
  }

  async listNodeTypeStates(auth: AuthTokenPayload, buildingId: string, nodeType: string) {
    const canonicalNodeType = this.assertNodeType(nodeType);
    await this.assertHttpAccess(auth, buildingId);
    const [building, nodeTypeRecord, nodes] = await Promise.all([
      this.getBuildingOrThrow(buildingId),
      this.getNodeTypeOrThrow(canonicalNodeType),
      this.findActiveBuildingNodes(buildingId, canonicalNodeType),
    ]);
    const states = nodes.map((node) => {
      if (node.latestState) {
        return mapLatestState(node.latestState);
      }
      const assignment = node.gatewayAssignments[0]!;
      const gateway = assignment.gateway;
      return mapLatestState({
        areaId: building.areaId,
        building: { id: building.id, title: building.title },
        buildingId: building.id,
        companyId: building.companyId,
        gateway: { id: gateway.id, serialNumber: gateway.serialNumber },
        gatewayId: gateway.id,
        lastSeenAt: node.lastSeenAt ?? new Date(0),
        node: { id: node.id, installedLocation: node.installedLocation, number: node.number },
        nodeId: node.id,
        nodeType: node.nodeType,
        nodeTypeId: node.nodeTypeId,
        status: "OFFLINE",
        updatedAt: node.updatedAt,
        values: this.emptyValues(canonicalNodeType),
      });
    });
    return {
      building,
      historyRetentionDays: this.retentionDays,
      nodeType: nodeTypeRecord,
      states,
    };
  }

  async listNodeHistory(
    auth: AuthTokenPayload,
    buildingId: string,
    nodeType: string,
    nodeId: string,
    query: { page?: number; pageSize?: number },
  ) {
    const canonicalNodeType = this.assertNodeType(nodeType);
    await this.assertHttpAccess(auth, buildingId);
    const activeNode = await this.findActiveBuildingNode(buildingId, canonicalNodeType, nodeId);
    if (!activeNode) {
      throw new NotFoundException("The monitoring node was not found in this building.");
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
    const where = { buildingId, nodeId };
    const [items, total] = await Promise.all([
      this.prisma.sensorReading.findMany({
        orderBy: [{ receivedAt: "desc" }, { id: "asc" }],
        select: readingSelect,
        skip: (page - 1) * pageSize,
        take: pageSize,
        where,
      }),
      this.prisma.sensorReading.count({ where }),
    ]);
    return { items: items.map(mapSensorReading), page, pageSize, total };
  }

  async assertRealtimeJoin(auth: AuthTokenPayload, buildingId: string, nodeType: string) {
    const canonicalNodeType = this.assertNodeType(nodeType);
    const allowed = await this.permissions.hasPermission(
      auth.context,
      auth.sub,
      "monitoring.realtime",
    );
    if (!allowed) {
      throw new ForbiddenException("The realtime monitoring permission is missing.");
    }
    await this.assertHttpAccess(auth, buildingId);
    await this.getNodeTypeOrThrow(canonicalNodeType);
    return canonicalNodeType;
  }

  private async resolveAssignmentContext(
    parsed: ParsedSensorMessage,
  ): Promise<AssignmentContext | null> {
    const gateway = await this.prisma.gateway.findFirst({
      where: {
        OR: [
          { serialNumber: parsed.gatewaySerial },
          { serialNumber: { endsWith: parsed.gatewaySerial } },
        ],
        status: DeviceLifecycleStatus.ACTIVE,
      },
    });
    if (!gateway) {
      return null;
    }
    const [gatewayCompany, gatewayBuilding, node] = await Promise.all([
      this.prisma.companyDeviceAssignment.findFirst({
        where: { gatewayId: gateway.id, status: AssignmentStatus.ACTIVE },
      }),
      this.prisma.gatewayBuildingAssignment.findFirst({
        include: { building: true },
        where: { gatewayId: gateway.id, status: AssignmentStatus.ACTIVE },
      }),
      this.prisma.node.findFirst({
        include: {
          companyAssignments: { where: { status: AssignmentStatus.ACTIVE } },
          nodeType: true,
        },
        where: {
          gatewayAssignments: { some: { gatewayId: gateway.id, status: AssignmentStatus.ACTIVE } },
          nodeType: { key: parsed.nodeType },
          number: parsed.nodeNumber,
          status: DeviceLifecycleStatus.ACTIVE,
        },
      }),
    ]);
    const nodeCompany = node?.companyAssignments[0];
    if (
      !gatewayCompany ||
      !gatewayBuilding ||
      !node ||
      !nodeCompany ||
      gatewayCompany.companyId !== gatewayBuilding.building.companyId ||
      nodeCompany.companyId !== gatewayCompany.companyId
    ) {
      return null;
    }
    return {
      areaId: gatewayBuilding.building.areaId,
      buildingId: gatewayBuilding.buildingId,
      companyId: gatewayCompany.companyId,
      gatewayId: gateway.id,
      nodeId: node.id,
      nodeTypeId: node.nodeTypeId,
    };
  }

  private buildDeduplication(
    parsed: ParsedSensorMessage,
    context: AssignmentContext,
    sourceTopic: string,
    receivedAt: Date,
    valueHash: string,
    metadata: MqttSensorMessageMetadata,
  ): { key: string; source: string } {
    if (metadata.packetMessageId !== undefined) {
      return {
        key: `mqtt-packet:${sourceTopic}:${metadata.packetMessageId}`,
        source: "mqtt_packet_message_id",
      };
    }
    if (parsed.gatewayMessageId) {
      return {
        key: `gateway-message:${context.gatewayId}:${context.nodeId}:${parsed.gatewayMessageId}`,
        source: "gateway_message_id",
      };
    }
    if (parsed.gatewaySequence) {
      return {
        key: `gateway-sequence:${context.gatewayId}:${context.nodeId}:${parsed.gatewaySequence}`,
        source: "gateway_sequence",
      };
    }
    if (parsed.measuredAt) {
      return {
        key: `measured:${context.gatewayId}:${context.nodeId}:${parsed.measuredAt.toISOString()}:${valueHash}`,
        source: "measured_at_payload_fingerprint",
      };
    }
    return {
      key: `received:${context.gatewayId}:${context.nodeId}:${receivedAt.toISOString()}:${valueHash}:${randomUUID()}`,
      source: "received_at_unique_no_reliable_legacy_id",
    };
  }

  private hashValues(values: unknown): string {
    return createHash("sha256").update(JSON.stringify(values)).digest("hex");
  }

  private assertNodeType(nodeType: string): CanonicalNodeType {
    if (nodeType === "door_node" || nodeType === "angle_node" || nodeType === "gangform_node") {
      return nodeType;
    }
    if (nodeType === "vertical" || nodeType === "vertical_node" || nodeType === "gangform") {
      return "gangform_node";
    }
    throw new NotFoundException("The node type was not found.");
  }

  private async assertHttpAccess(auth: AuthTokenPayload, buildingId: string): Promise<void> {
    const permitted = await this.permissions.hasPermission(
      auth.context,
      auth.sub,
      "monitoring.view",
    );
    if (!permitted) {
      throw new ForbiddenException("The monitoring permission is missing.");
    }
    if (auth.context === AUTH_CONTEXT.gssAdmin) {
      return;
    }
    const user = await this.prisma.companyUser.findUnique({
      where: { id: auth.sub },
      select: { companyId: true, id: true, roleId: true },
    });
    if (
      !user ||
      !(await this.hasCompanyBuildingScope(user.id, user.companyId, user.roleId, buildingId))
    ) {
      throw new ForbiddenException("The requested resource is outside the assigned scope.");
    }
  }

  private async hasCompanyBuildingScope(
    userId: string,
    companyId: string,
    roleId: string,
    buildingId: string,
  ): Promise<boolean> {
    const building = await this.prisma.constructionBuilding.findUnique({
      where: { id: buildingId },
    });
    if (!building || building.companyId !== companyId) {
      return false;
    }
    const role = await this.prisma.companyRole.findUnique({ where: { id: roleId } });
    if (role?.isCompanyOwnerRole) {
      return true;
    }
    const [buildingAccess, areaAccess] = await Promise.all([
      this.prisma.companyUserBuildingAccess.findUnique({
        where: { companyUserId_buildingId: { buildingId, companyUserId: userId } },
      }),
      this.prisma.companyUserAreaAccess.findUnique({
        where: { companyUserId_areaId: { areaId: building.areaId, companyUserId: userId } },
      }),
    ]);
    return Boolean(buildingAccess || areaAccess);
  }

  private async getBuildingOrThrow(buildingId: string) {
    const building = await this.prisma.constructionBuilding.findUnique({
      where: { id: buildingId },
    });
    if (!building) {
      throw new NotFoundException("The construction building was not found.");
    }
    return building;
  }

  private async getNodeTypeOrThrow(nodeType: CanonicalNodeType) {
    const record = await this.prisma.nodeType.findUnique({
      select: nodeTypeSelect,
      where: { key: nodeType },
    });
    if (!record) {
      throw new NotFoundException("The node type was not found.");
    }
    return record;
  }

  private findActiveBuildingNodes(buildingId: string, nodeType: string) {
    return this.prisma.node.findMany({
      include: {
        gatewayAssignments: {
          include: { gateway: true },
          take: 1,
          where: {
            gateway: {
              buildingAssignments: { some: { buildingId, status: AssignmentStatus.ACTIVE } },
            },
            status: AssignmentStatus.ACTIVE,
          },
        },
        latestState: { select: latestStateSelect },
        nodeType: { select: nodeTypeSelect },
      },
      orderBy: { number: "asc" },
      where: {
        gatewayAssignments: {
          some: {
            gateway: {
              buildingAssignments: { some: { buildingId, status: AssignmentStatus.ACTIVE } },
            },
            status: AssignmentStatus.ACTIVE,
          },
        },
        nodeType: { key: nodeType },
        status: DeviceLifecycleStatus.ACTIVE,
      },
    });
  }

  private findActiveBuildingNode(buildingId: string, nodeType: string, nodeId: string) {
    return this.prisma.node.findFirst({
      where: {
        id: nodeId,
        gatewayAssignments: {
          some: {
            gateway: {
              buildingAssignments: { some: { buildingId, status: AssignmentStatus.ACTIVE } },
            },
            status: AssignmentStatus.ACTIVE,
          },
        },
        nodeType: { key: nodeType },
        status: DeviceLifecycleStatus.ACTIVE,
      },
    });
  }

  private emptyValues(nodeType: CanonicalNodeType) {
    return nodeType === "door_node"
      ? { batteryLevel: null, doorState: "closed" }
      : { angleX: 0, angleY: 0 };
  }
}
