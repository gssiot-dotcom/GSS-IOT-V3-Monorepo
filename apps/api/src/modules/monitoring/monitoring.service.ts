import { createHash, randomUUID } from "node:crypto";

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { OnModuleInit } from "@nestjs/common";
import { AssignmentStatus, DeviceLifecycleStatus, Prisma } from "@prisma/client";
import type { CanonicalNodeType } from "@gss-iot/contracts";
import type {
  AdminMonitoringOptionsRecord,
  AdminMonitoringSummaryRecord,
  ClassificationEvidence,
  MonitoringStatus,
} from "@gss-iot/contracts";

import type { AuthTokenPayload } from "../../common/auth.types";
import { AUTH_CONTEXT } from "../../common/auth.types";
import { PrismaService } from "../../prisma/prisma.service";
import { AlarmDomainEventsService } from "../alarms/alarm-domain-events.service";
import { AlarmOccurrenceEvaluatorService } from "../alarms/alarm-occurrence-evaluator.service";
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
  classificationEvidence: true,
  faultFiltered: true,
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
  classificationEvidence: true,
  faultFiltered: true,
  status: true,
  values: true,
} satisfies Prisma.SensorReadingSelect;

const HISTORY_MAX_RANGE_MS = 24 * 60 * 60 * 1000;
const HISTORY_CHART_POINT_LIMIT = 500;

type AssignmentContext = {
  areaId: string;
  buildingId: string;
  companyId: string;
  gatewayBuildingAssignmentId: string;
  gatewayCompanyAssignmentId: string;
  gatewayId: string;
  nodeCompanyAssignmentId: string;
  nodeGatewayAssignmentId: string;
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
    @Inject(AlarmOccurrenceEvaluatorService)
    private readonly alarmEvaluator: AlarmOccurrenceEvaluatorService,
    @Inject(AlarmDomainEventsService)
    private readonly alarmEvents: AlarmDomainEventsService,
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
      this.logger.debug(
        `Malformed MQTT sensor payload content topic=${topic} payload=${this.payloadPreview(payload)}`,
      );
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

  async listAdminOptions(auth: AuthTokenPayload): Promise<AdminMonitoringOptionsRecord> {
    await this.assertAdminMonitoringAccess(auth);
    const [companies, areas, buildings] = await Promise.all([
      this.prisma.company.findMany({
        orderBy: { name: "asc" },
        select: {
          address: true,
          code: true,
          email: true,
          id: true,
          logoKey: true,
          name: true,
          phone: true,
          status: true,
        },
      }),
      this.prisma.constructionArea.findMany({
        orderBy: { name: "asc" },
        select: {
          address: true,
          companyId: true,
          description: true,
          id: true,
          name: true,
          status: true,
        },
      }),
      this.prisma.constructionBuilding.findMany({
        orderBy: { title: "asc" },
        select: {
          address: true,
          areaId: true,
          buildingType: true,
          companyId: true,
          id: true,
          number: true,
          status: true,
          title: true,
        },
      }),
    ]);
    return {
      areas,
      buildings,
      companies: companies.map(({ logoKey, ...company }) => ({
        ...company,
        hasLogo: Boolean(logoKey),
      })),
    };
  }

  async listAdminSummary(
    auth: AuthTokenPayload,
    filters: { areaId?: string; buildingId?: string; companyId?: string },
  ): Promise<AdminMonitoringSummaryRecord> {
    await this.assertAdminMonitoringAccess(auth);
    const stateWhere: Prisma.LatestNodeStateWhereInput = {
      ...(filters.areaId ? { areaId: filters.areaId } : {}),
      ...(filters.buildingId ? { buildingId: filters.buildingId } : {}),
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
    };
    const buildingWhere: Prisma.ConstructionBuildingWhereInput = {
      ...(filters.areaId ? { areaId: filters.areaId } : {}),
      ...(filters.buildingId ? { id: filters.buildingId } : {}),
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
    };
    const now = new Date();
    const staleBefore = new Date(now.getTime() - 5 * 60 * 1000);
    const gatewayWhere: Prisma.GatewayWhereInput = {
      ...(filters.companyId || filters.areaId || filters.buildingId
        ? {
            buildingAssignments: {
              some: {
                status: AssignmentStatus.ACTIVE,
                building: buildingWhere,
              },
            },
          }
        : {}),
    };
    const [
      states,
      groupedBuildings,
      buildings,
      gateways,
      staleGateways,
      offlineGateways,
      recentNodes,
    ] = await Promise.all([
      this.prisma.latestNodeState.groupBy({
        by: ["status"],
        _count: { _all: true },
        where: stateWhere,
      }),
      this.prisma.latestNodeState.groupBy({
        by: ["buildingId", "status"],
        _count: { _all: true },
        where: stateWhere,
      }),
      this.prisma.constructionBuilding.findMany({
        orderBy: { title: "asc" },
        select: {
          address: true,
          areaId: true,
          buildingType: true,
          companyId: true,
          id: true,
          number: true,
          status: true,
          title: true,
        },
        where: buildingWhere,
      }),
      this.prisma.gateway.count({ where: gatewayWhere }),
      this.prisma.gateway.count({
        where: {
          ...gatewayWhere,
          lastSeenAt: { lt: staleBefore },
          status: DeviceLifecycleStatus.ACTIVE,
        },
      }),
      this.prisma.gateway.count({
        where: { ...gatewayWhere, status: { not: DeviceLifecycleStatus.ACTIVE } },
      }),
      this.prisma.latestNodeState.findMany({
        orderBy: { updatedAt: "desc" },
        select: latestStateSelect,
        take: 8,
        where: stateWhere,
      }),
    ]);
    const severityDistribution = {
      caution: 0,
      danger: 0,
      offline: 0,
      safe: 0,
      unconfigured: 0,
      warning: 0,
    } as Record<MonitoringStatus, number>;
    for (const row of states)
      severityDistribution[row.status.toLowerCase() as MonitoringStatus] = row._count._all;
    const buildingCounts = new Map<
      string,
      { danger: number; offline: number; total: number; warning: number }
    >();
    for (const row of groupedBuildings) {
      const count = buildingCounts.get(row.buildingId) ?? {
        danger: 0,
        offline: 0,
        total: 0,
        warning: 0,
      };
      const status = row.status.toLowerCase();
      count.total += row._count._all;
      if (status === "danger") count.danger += row._count._all;
      if (status === "warning") count.warning += row._count._all;
      if (status === "offline") count.offline += row._count._all;
      buildingCounts.set(row.buildingId, count);
    }
    return {
      buildings: buildings.map((building) => ({
        building,
        ...(buildingCounts.get(building.id) ?? { danger: 0, offline: 0, total: 0, warning: 0 }),
      })),
      gateways: {
        offline: offlineGateways,
        online: Math.max(0, gateways - staleGateways - offlineGateways),
        stale: staleGateways,
        total: gateways,
      },
      recentNodes: recentNodes.map(mapLatestState),
      severityDistribution,
    };
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
    const classification = await this.classifyReading(parsed, context);
    const prismaStatus = toPrismaStatus(classification.status);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const result = await this.prisma.$transaction(
          async (tx) => {
            const reading = await tx.sensorReading.create({
              data: {
                areaId: context.areaId,
                buildingId: context.buildingId,
                companyId: context.companyId,
                deduplicationKey: dedupe.key,
                deduplicationSource: dedupe.source,
                gatewayId: context.gatewayId,
                gatewayMessageId: parsed.gatewayMessageId ?? metadata.packetMessageId?.toString(),
                gatewaySequence: parsed.gatewaySequence,
                measuredAt: parsed.measuredAt,
                nodeId: context.nodeId,
                nodeTypeId: context.nodeTypeId,
                receivedAt,
                sourceTopic,
                status: prismaStatus,
                classificationEvidence: classification.evidence as unknown as Prisma.InputJsonValue,
                faultFiltered: classification.faultFiltered,
                valueHash,
                values: parsed.values as unknown as Prisma.InputJsonValue,
              },
              select: { id: true },
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

            const state = await tx.latestNodeState.upsert({
              create: {
                areaId: context.areaId,
                buildingId: context.buildingId,
                companyId: context.companyId,
                gatewayId: context.gatewayId,
                lastSeenAt: receivedAt,
                nodeId: context.nodeId,
                nodeTypeId: context.nodeTypeId,
                status: prismaStatus,
                classificationEvidence: classification.evidence as unknown as Prisma.InputJsonValue,
                faultFiltered: classification.faultFiltered,
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
                classificationEvidence: classification.evidence as unknown as Prisma.InputJsonValue,
                faultFiltered: classification.faultFiltered,
                values: parsed.values as unknown as Prisma.InputJsonValue,
              },
              where: { nodeId: context.nodeId },
            });

            const alarmEvents = await this.alarmEvaluator.evaluate(tx, {
              areaId: context.areaId,
              assignmentProvenance: {
                gatewayBuildingAssignmentId: context.gatewayBuildingAssignmentId,
                gatewayCompanyAssignmentId: context.gatewayCompanyAssignmentId,
                nodeCompanyAssignmentId: context.nodeCompanyAssignmentId,
                nodeGatewayAssignmentId: context.nodeGatewayAssignmentId,
              },
              buildingId: context.buildingId,
              classificationEvidence: classification.evidence,
              companyId: context.companyId,
              faultFiltered: classification.faultFiltered,
              gatewayId: context.gatewayId,
              nodeId: context.nodeId,
              nodeTypeId: context.nodeTypeId,
              readingId: reading.id,
              receivedAt,
              status: prismaStatus,
              values: parsed.values,
            });

            return { alarmEvents, state };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );

        const mapped = mapLatestState(result.state);
        this.realtime.emitNodeState(mapped);
        result.alarmEvents.forEach((event) => this.alarmEvents.emitPolicyTriggered(event));
        return { deduplicated: false, ignored: false, state: mapped };
      } catch (error) {
        if (this.isSensorDedupeError(error)) {
          return { deduplicated: true, ignored: false };
        }
        if (this.isTransactionConflict(error) && attempt < 3) {
          this.logger.warn(
            `Retrying sensor alarm transaction after serialization conflict attempt=${attempt}.`,
          );
          continue;
        }
        throw error;
      }
    }
    throw new Error("Sensor alarm transaction retry loop exited unexpectedly.");
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
        classificationEvidence: null,
        faultFiltered: false,
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
    query: { from: string; page?: number; pageSize?: number; to: string },
  ) {
    const canonicalNodeType = this.assertNodeType(nodeType);
    await this.assertHttpAccess(auth, buildingId);
    const activeNode = await this.findActiveBuildingNode(buildingId, canonicalNodeType, nodeId);
    if (!activeNode) {
      throw new NotFoundException("The monitoring node was not found in this building.");
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 50));
    const range = this.historyRange(query.from, query.to);
    const where = { buildingId, nodeId, receivedAt: { gte: range.from, lt: range.to } };
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

  async getNodeHistoryChart(
    auth: AuthTokenPayload,
    buildingId: string,
    nodeType: string,
    nodeId: string,
    query: { from: string; to: string },
  ) {
    const canonicalNodeType = this.assertNodeType(nodeType);
    await this.assertHttpAccess(auth, buildingId);
    const activeNode = await this.findActiveBuildingNode(buildingId, canonicalNodeType, nodeId);
    if (!activeNode) {
      throw new NotFoundException("The monitoring node was not found in this building.");
    }
    const range = this.historyRange(query.from, query.to);
    const where = { buildingId, nodeId, receivedAt: { gte: range.from, lt: range.to } };
    const totalRawPointCount = await this.prisma.sensorReading.count({ where });
    let items;
    if (totalRawPointCount <= HISTORY_CHART_POINT_LIMIT) {
      items = await this.prisma.sensorReading.findMany({
        orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
        select: readingSelect,
        where,
      });
    } else {
      const sampledIds = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        WITH ordered AS (
          SELECT
            "id",
            ROW_NUMBER() OVER (ORDER BY "receivedAt" ASC, "id" ASC) AS "rowNumber",
            COUNT(*) OVER () AS "total"
          FROM "SensorReading"
          WHERE "buildingId" = ${buildingId}::uuid
            AND "nodeId" = ${nodeId}::uuid
            AND "receivedAt" >= ${range.from}
            AND "receivedAt" < ${range.to}
        )
        SELECT "id"
        FROM ordered
        WHERE "rowNumber" IN (
          SELECT DISTINCT 1 + FLOOR(
            "sampleIndex" * ("total" - 1)::numeric / ${HISTORY_CHART_POINT_LIMIT - 1}
          )::bigint
          FROM generate_series(0, ${HISTORY_CHART_POINT_LIMIT - 1}) AS "sampleIndex"
        )
        ORDER BY "rowNumber"
      `);
      items = await this.prisma.sensorReading.findMany({
        orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
        select: readingSelect,
        where: { id: { in: sampledIds.map(({ id }) => id) } },
      });
    }
    return {
      from: range.from.toISOString(),
      items: items.map(mapSensorReading),
      returnedPointCount: items.length,
      sampled: totalRawPointCount > items.length,
      sampleLimit: HISTORY_CHART_POINT_LIMIT,
      to: range.to.toISOString(),
      totalRawPointCount,
    };
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

  private historyRange(fromValue: string, toValue: string) {
    const from = new Date(fromValue);
    const to = new Date(toValue);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) {
      throw new BadRequestException(
        "History range requires valid ISO datetimes with from before to.",
      );
    }
    if (to.getTime() - from.getTime() > HISTORY_MAX_RANGE_MS) {
      throw new BadRequestException("History range cannot exceed 24 hours.");
    }
    return { from, to };
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
        select: { companyId: true, id: true },
        where: { gatewayId: gateway.id, status: AssignmentStatus.ACTIVE },
      }),
      this.prisma.gatewayBuildingAssignment.findFirst({
        include: { building: true },
        where: { gatewayId: gateway.id, status: AssignmentStatus.ACTIVE },
      }),
      this.prisma.node.findFirst({
        include: {
          companyAssignments: { where: { status: AssignmentStatus.ACTIVE } },
          gatewayAssignments: { where: { gatewayId: gateway.id, status: AssignmentStatus.ACTIVE } },
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
      gatewayBuildingAssignmentId: gatewayBuilding.id,
      gatewayCompanyAssignmentId: gatewayCompany.id,
      gatewayId: gateway.id,
      nodeCompanyAssignmentId: nodeCompany.id,
      nodeGatewayAssignmentId: node.gatewayAssignments[0]!.id,
      nodeId: node.id,
      nodeTypeId: node.nodeTypeId,
    };
  }

  private async classifyReading(
    parsed: ParsedSensorMessage,
    context: AssignmentContext,
  ): Promise<{
    evidence: ClassificationEvidence;
    faultFiltered: boolean;
    status: MonitoringStatus;
  }> {
    const appliedFilter = await this.prisma.gatewayFaultFilterAppliedState.findUnique({
      where: {
        gatewayId_nodeTypeId_nodeId: {
          gatewayId: context.gatewayId,
          nodeId: context.nodeId,
          nodeTypeId: context.nodeTypeId,
        },
      },
    });
    const faultFiltered = Boolean(appliedFilter?.applied);
    const faultFilterState = faultFiltered ? "APPLIED" : "NOT_APPLIED";
    const rawPayloadStatus =
      parsed.payload.status ?? parsed.payload.result ?? parsed.payload.state ?? null;

    if (parsed.nodeType === "door_node") {
      const status = parsed.status === "danger" ? "danger" : "safe";
      return {
        evidence: {
          classification: status,
          configurationState: "CONFIGURED",
          faultFiltered,
          faultFilterState,
          rawPayloadStatus,
        },
        faultFiltered,
        status,
      };
    }

    const config = await this.prisma.buildingAlarmLevelConfiguration.findUnique({
      where: {
        buildingId_nodeTypeId: {
          buildingId: context.buildingId,
          nodeTypeId: context.nodeTypeId,
        },
      },
    });
    const angleX = "angleX" in parsed.values ? parsed.values.angleX : 0;
    const angleY = "angleY" in parsed.values ? parsed.values.angleY : 0;
    const absoluteAngleX = Math.abs(angleX);
    const absoluteAngleY = Math.abs(angleY);
    const metric = Math.max(absoluteAngleX, absoluteAngleY);

    if (!config) {
      return {
        evidence: {
          absoluteAngleX,
          absoluteAngleY,
          classification: "unconfigured",
          configurationState: "UNCONFIGURED",
          faultFiltered,
          faultFilterState,
          matchedConfigurationId: null,
          matchedConfigurationVersion: null,
          metric,
          rawAngleX: angleX,
          rawAngleY: angleY,
          rawPayloadStatus,
        },
        faultFiltered,
        status: "unconfigured",
      };
    }

    const evidenceBase = {
      absoluteAngleX,
      absoluteAngleY,
      cautionThreshold: config.cautionThreshold,
      dangerThreshold: config.dangerThreshold,
      faultFiltered,
      faultFilterState,
      matchedConfigurationId: config.id,
      matchedConfigurationVersion: config.version,
      metric,
      rawAngleX: angleX,
      rawAngleY: angleY,
      rawPayloadStatus,
      warningThreshold: config.warningThreshold,
    } satisfies Omit<ClassificationEvidence, "classification" | "configurationState">;

    if (!config.enabled) {
      return {
        evidence: {
          ...evidenceBase,
          classification: "safe",
          configurationState: "DISABLED",
        },
        faultFiltered,
        status: "safe",
      };
    }

    const caution = config.cautionThreshold;
    const warning = config.warningThreshold;
    const danger = config.dangerThreshold;
    if (typeof caution !== "number" || typeof warning !== "number" || typeof danger !== "number") {
      return {
        evidence: {
          ...evidenceBase,
          classification: "unconfigured",
          configurationState: "UNCONFIGURED",
        },
        faultFiltered,
        status: "unconfigured",
      };
    }

    const status =
      metric >= danger
        ? "danger"
        : metric >= warning
          ? "warning"
          : metric >= caution
            ? "caution"
            : "safe";
    return {
      evidence: {
        ...evidenceBase,
        classification: status,
        configurationState: "CONFIGURED",
      },
      faultFiltered,
      status,
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

  private isSensorDedupeError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      return false;
    }
    const target = Array.isArray(error.meta?.target) ? error.meta.target.join(",") : "";
    return target.includes("deduplicationKey");
  }

  private isTransactionConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
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

  private async assertAdminMonitoringAccess(auth: AuthTokenPayload): Promise<void> {
    if (auth.context !== AUTH_CONTEXT.gssAdmin) {
      throw new ForbiddenException("The GSS Admin monitoring context is required.");
    }
    const permitted = await this.permissions.hasPermission(
      auth.context,
      auth.sub,
      "monitoring.view",
    );
    if (!permitted) {
      throw new ForbiddenException("The monitoring permission is missing.");
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

  private payloadPreview(payload: Buffer | string): string {
    const text = Buffer.isBuffer(payload) ? payload.toString("utf8") : payload;
    try {
      const parsed = JSON.parse(text) as unknown;
      return JSON.stringify(this.redactSecrets(parsed)).slice(0, 1_000);
    } catch {
      return text.slice(0, 1_000);
    }
  }

  private redactSecrets(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.redactSecrets(item));
    }
    if (!value || typeof value !== "object") {
      return value;
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        /password|passwd|secret|token|credential/i.test(key)
          ? "[redacted]"
          : this.redactSecrets(entry),
      ]),
    );
  }
}
