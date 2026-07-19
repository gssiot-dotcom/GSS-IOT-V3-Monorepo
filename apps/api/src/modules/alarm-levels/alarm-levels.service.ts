import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AssignmentStatus,
  AuditActorType,
  DeviceLifecycleStatus,
  GatewayCommandStatus,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";

import type { AuthTokenPayload } from "../../common/auth.types";
import { AUTH_CONTEXT } from "../../common/auth.types";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { GatewayCommandPublisherService } from "../gateway-commands/gateway-command-publisher.service";
import { GatewayCommandsService } from "../gateway-commands/gateway-commands.service";
import { PermissionResolverService } from "../rbac/permission-resolver.service";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  ToggleGatewayAlarmLevelDto,
  UpdateBuildingAlarmLevelDto,
  UpdateFaultFilterDto,
} from "./dto/alarm-levels.dto";

const nodeTypeSelect = {
  displayName: true,
  id: true,
  imageAssetKey: true,
  key: true,
  numericCode: true,
} satisfies Prisma.NodeTypeSelect;

const buildingSelect = {
  address: true,
  areaId: true,
  buildingType: true,
  companyId: true,
  id: true,
  number: true,
  status: true,
  title: true,
} satisfies Prisma.ConstructionBuildingSelect;

@Injectable()
export class AlarmLevelsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
    @Inject(GatewayCommandsService) private readonly commands: GatewayCommandsService,
    @Inject(GatewayCommandPublisherService)
    private readonly publisher: GatewayCommandPublisherService,
    @Inject(PermissionResolverService) private readonly permissions: PermissionResolverService,
  ) {}

  async listAlarmLevels(auth: AuthTokenPayload, buildingId: string) {
    await this.assertAccess(auth, buildingId, "alarm-levels.view");
    const building = await this.getBuildingOrThrow(buildingId);
    const [nodeTypes, configurations, gatewayApplications] = await Promise.all([
      this.prisma.nodeType.findMany({ orderBy: { numericCode: "asc" }, select: nodeTypeSelect }),
      this.prisma.buildingAlarmLevelConfiguration.findMany({
        include: { nodeType: { select: nodeTypeSelect } },
        orderBy: { nodeType: { numericCode: "asc" } },
        where: { buildingId },
      }),
      this.prisma.gatewayAlarmLevelApplication.findMany({
        include: { gateway: { select: { id: true, serialNumber: true } } },
        orderBy: { gateway: { serialNumber: "asc" } },
        where: { buildingId },
      }),
    ]);
    return {
      building,
      configurations: configurations.map((configuration) => ({
        buildingId: configuration.buildingId,
        cautionThreshold: configuration.cautionThreshold,
        dangerThreshold: configuration.dangerThreshold,
        enabled: configuration.enabled,
        id: configuration.id,
        nodeType: configuration.nodeType,
        nodeTypeId: configuration.nodeTypeId,
        updatedAt: configuration.updatedAt.toISOString(),
        version: configuration.version,
        warningThreshold: configuration.warningThreshold,
      })),
      gatewayApplications: gatewayApplications.map((application) => ({
        appliedAt: application.appliedAt?.toISOString() ?? null,
        appliedCommandId: application.appliedCommandId,
        appliedConfigurationVersion: application.appliedConfigurationVersion,
        appliedEnabled: application.appliedEnabled,
        appliedRequestId: application.appliedRequestId,
        desiredCommandId: application.desiredCommandId,
        desiredEnabled: application.desiredEnabled,
        desiredStatus: application.desiredStatus,
        failureReason: application.failureReason,
        gateway: application.gateway,
        gatewayId: application.gatewayId,
        id: application.id,
        nodeTypeId: application.nodeTypeId,
      })),
      nodeTypes,
    };
  }

  async updateAlarmLevel(
    auth: AuthTokenPayload,
    buildingId: string,
    nodeTypeId: string,
    dto: UpdateBuildingAlarmLevelDto,
  ) {
    await this.assertAccess(auth, buildingId, "alarm-levels.manage");
    const [building, nodeType] = await Promise.all([
      this.getBuildingOrThrow(buildingId),
      this.getNodeTypeOrThrow(nodeTypeId),
    ]);
    this.validateThresholds(nodeType.numericCode, dto);
    const actorType = this.actorType(auth);

    const configuration = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.buildingAlarmLevelConfiguration.findUnique({
        where: { buildingId_nodeTypeId: { buildingId, nodeTypeId } },
      });
      const version = existing ? existing.version + 1 : 1;
      const data = {
        cautionThreshold: nodeType.numericCode === 0 ? null : (dto.cautionThreshold ?? null),
        dangerThreshold: nodeType.numericCode === 0 ? null : (dto.dangerThreshold ?? null),
        enabled: dto.enabled,
        updatedById: auth.sub,
        updatedByType: actorType,
        version,
        warningThreshold: nodeType.numericCode === 0 ? null : (dto.warningThreshold ?? null),
      };
      const saved = existing
        ? await tx.buildingAlarmLevelConfiguration.update({
            data,
            where: { id: existing.id },
          })
        : await tx.buildingAlarmLevelConfiguration.create({
            data: { ...data, buildingId, companyId: building.companyId, nodeTypeId },
          });
      await tx.buildingAlarmLevelConfigurationHistory.create({
        data: {
          cautionThreshold: saved.cautionThreshold,
          configurationId: saved.id,
          dangerThreshold: saved.dangerThreshold,
          enabled: saved.enabled,
          updatedById: auth.sub,
          updatedByType: actorType,
          version: saved.version,
          warningThreshold: saved.warningThreshold,
        },
      });
      await this.auditLog.record(
        auth,
        {
          action: "alarm-levels.desired.update",
          entityId: saved.id,
          entityType: "BuildingAlarmLevelConfiguration",
          newValue: saved,
          oldValue: existing ?? undefined,
        },
        tx,
      );
      return saved;
    });

    const gateways = await this.activeBuildingGateways(buildingId);
    const commands = [];
    for (const gateway of gateways) {
      try {
        const command = await this.commands.createSetAlarmLevelsCommand(auth, {
          ...this.buildAlarmCommandSettings(nodeType, configuration, true),
          expiresInSeconds: dto.expiresInSeconds,
          gatewayId: gateway.id,
          nodeTypeId,
        });
        await this.upsertGatewayAlarmApplication(auth, {
          buildingId,
          commandId: command.id,
          configurationId: configuration.id,
          configurationVersion: configuration.version,
          desiredEnabled: true,
          desiredStatus: command.status,
          gatewayId: gateway.id,
          nodeTypeId,
        });
        commands.push(await this.publisher.publishPending(command.id));
      } catch (error) {
        await this.upsertGatewayAlarmApplication(auth, {
          buildingId,
          commandId: null,
          configurationId: configuration.id,
          configurationVersion: configuration.version,
          desiredEnabled: true,
          desiredStatus: GatewayCommandStatus.FAILED,
          failureReason:
            error instanceof Error ? error.message : "Alarm-level command creation failed.",
          gatewayId: gateway.id,
          nodeTypeId,
        });
      }
    }

    await this.auditLog.record(auth, {
      action: "alarm-levels.commands.create",
      entityId: configuration.id,
      entityType: "BuildingAlarmLevelConfiguration",
      newValue: {
        commandIds: commands.map((command) => command.id),
        gatewayCount: gateways.length,
        nodeTypeId,
      },
    });

    return this.listAlarmLevels(auth, buildingId);
  }

  async toggleGatewayAlarmLevel(
    auth: AuthTokenPayload,
    buildingId: string,
    gatewayId: string,
    dto: ToggleGatewayAlarmLevelDto,
  ) {
    await this.assertAccess(auth, buildingId, "alarm-levels.manage");
    const [building, gateway, nodeType] = await Promise.all([
      this.getBuildingOrThrow(buildingId),
      this.getGatewayInBuildingOrThrow(buildingId, gatewayId),
      this.getNodeTypeByKeyOrThrow(dto.nodeType),
    ]);
    if (gateway.companyId !== building.companyId) {
      throw new BadRequestException("Gateway company and building company do not match.");
    }
    const configuration = await this.prisma.buildingAlarmLevelConfiguration.findUnique({
      where: { buildingId_nodeTypeId: { buildingId, nodeTypeId: nodeType.id } },
    });
    if (!configuration) {
      throw new BadRequestException(
        "Save the building alarm-level configuration before toggling a gateway.",
      );
    }

    const command = await this.commands.createSetAlarmLevelsCommand(auth, {
      ...this.buildAlarmCommandSettings(nodeType, configuration, dto.enabled),
      expiresInSeconds: dto.expiresInSeconds,
      gatewayId,
      nodeTypeId: nodeType.id,
    });
    const application = await this.upsertGatewayAlarmApplication(auth, {
      buildingId,
      commandId: command.id,
      configurationId: configuration.id,
      configurationVersion: configuration.version,
      desiredEnabled: dto.enabled,
      desiredStatus: command.status,
      gatewayId,
      nodeTypeId: nodeType.id,
    });
    await this.auditLog.record(auth, {
      action: "alarm-levels.gateway-enabled.update",
      entityId: application.id,
      entityType: "GatewayAlarmLevelApplication",
      newValue: {
        commandId: command.id,
        desiredEnabled: dto.enabled,
        gatewayId,
        nodeType: dto.nodeType,
      },
    });

    await this.publisher.publishPending(command.id);
    return this.listAlarmLevels(auth, buildingId);
  }

  async listFaultFilters(auth: AuthTokenPayload, buildingId: string) {
    await this.assertAccess(auth, buildingId, "alarm-levels.view");
    const building = await this.getBuildingOrThrow(buildingId);
    const gateways = await this.activeBuildingGateways(buildingId);
    const groups = [];
    for (const gateway of gateways) {
      const nodeTypes = await this.prisma.nodeType.findMany({
        orderBy: { numericCode: "asc" },
        select: nodeTypeSelect,
      });
      const groupedNodeTypes = [];
      for (const nodeType of nodeTypes) {
        const nodes = await this.activeGatewayNodes(gateway.id, nodeType.id);
        const desired = await this.prisma.gatewayFaultFilterDesiredState.findMany({
          where: { gatewayId: gateway.id, nodeTypeId: nodeType.id },
        });
        const applied = await this.prisma.gatewayFaultFilterAppliedState.findMany({
          where: { gatewayId: gateway.id, nodeTypeId: nodeType.id },
        });
        groupedNodeTypes.push({
          nodeType,
          nodes: nodes.map((node) => {
            const desiredState = desired.find((item) => item.nodeId === node.id);
            const appliedState = applied.find((item) => item.nodeId === node.id);
            return {
              applied: Boolean(appliedState?.applied),
              appliedAt: appliedState?.appliedAt?.toISOString() ?? null,
              appliedCommandId: appliedState?.appliedCommandId ?? null,
              desiredCommandId: desiredState?.desiredCommandId ?? null,
              desiredEnabled: Boolean(desiredState?.enabled),
              desiredStatus: desiredState?.desiredStatus ?? null,
              failureReason: desiredState?.failureReason ?? appliedState?.failureReason ?? null,
              gateway: { id: gateway.id, serialNumber: gateway.serialNumber },
              gatewayId: gateway.id,
              node: { id: node.id, number: node.number },
              nodeId: node.id,
              nodeTypeId: nodeType.id,
            };
          }),
        });
      }
      groups.push({
        gateway: { id: gateway.id, serialNumber: gateway.serialNumber },
        nodeTypes: groupedNodeTypes,
      });
    }
    return { building, gateways: groups };
  }

  async updateFaultFilter(auth: AuthTokenPayload, buildingId: string, dto: UpdateFaultFilterDto) {
    await this.assertAccess(auth, buildingId, "alarm-levels.manage");
    const [building, gateway] = await Promise.all([
      this.getBuildingOrThrow(buildingId),
      this.getGatewayInBuildingOrThrow(buildingId, dto.gatewayId),
    ]);
    await this.getNodeTypeOrThrow(dto.nodeTypeId);
    if (gateway.companyId !== building.companyId) {
      throw new BadRequestException("Gateway company and building company do not match.");
    }
    const selectedNodes = await this.validateFaultFilterNodes(
      building.companyId,
      dto.gatewayId,
      dto.nodeTypeId,
      dto.nodeIds,
    );
    this.assertNoNumericDuplicates(selectedNodes.map((node) => node.number));
    const actorType = this.actorType(auth);

    const command = await this.commands.createSetFaultFilterCommand(auth, {
      expiresInSeconds: dto.expiresInSeconds,
      gatewayId: dto.gatewayId,
      nodeIds: selectedNodes.map((node) => node.id),
      nodeTypeId: dto.nodeTypeId,
    });

    const allNodes = await this.activeGatewayNodes(dto.gatewayId, dto.nodeTypeId);
    const selectedIds = new Set(selectedNodes.map((node) => node.id));
    await this.prisma.$transaction(async (tx) => {
      for (const node of allNodes) {
        await tx.gatewayFaultFilterDesiredState.upsert({
          create: {
            desiredCommandId: command.id,
            desiredStatus: command.status,
            enabled: selectedIds.has(node.id),
            gatewayId: dto.gatewayId,
            nodeId: node.id,
            nodeTypeId: dto.nodeTypeId,
            updatedById: auth.sub,
            updatedByType: actorType,
          },
          update: {
            desiredCommandId: command.id,
            desiredStatus: command.status,
            enabled: selectedIds.has(node.id),
            failureReason: null,
            updatedById: auth.sub,
            updatedByType: actorType,
          },
          where: {
            gatewayId_nodeTypeId_nodeId: {
              gatewayId: dto.gatewayId,
              nodeId: node.id,
              nodeTypeId: dto.nodeTypeId,
            },
          },
        });
      }
      await this.auditLog.record(
        auth,
        {
          action: "fault-filter.desired.update",
          entityId: command.id,
          entityType: "GatewayCommand",
          newValue: {
            commandId: command.id,
            gatewayId: dto.gatewayId,
            nodeIds: [...selectedIds],
            nodeTypeId: dto.nodeTypeId,
          },
        },
        tx,
      );
    });

    await this.publisher.publishPending(command.id);
    return this.listFaultFilters(auth, buildingId);
  }

  async retryConfigurationCommand(auth: AuthTokenPayload, buildingId: string, commandId: string) {
    await this.assertAccess(auth, buildingId, "alarm-levels.manage");
    const command = await this.commands.getCommand(commandId);
    const allowed =
      command.commandType === "SET_ALARM_LEVELS" || command.commandType === "SET_FAULT_FILTER";
    if (!allowed) {
      throw new BadRequestException("Only alarm configuration commands can be retried here.");
    }
    const inBuilding = await this.prisma.gatewayBuildingAssignment.findFirst({
      where: { buildingId, gatewayId: command.gatewayId, status: AssignmentStatus.ACTIVE },
    });
    if (!inBuilding) {
      throw new ForbiddenException("The command gateway is outside the requested building.");
    }
    return this.publisher.publishPending((await this.commands.retryCommand(auth, commandId)).id);
  }

  private validateThresholds(nodeTypeCode: number, dto: UpdateBuildingAlarmLevelDto): void {
    if (nodeTypeCode === 0) {
      return;
    }
    const caution = dto.cautionThreshold;
    const warning = dto.warningThreshold;
    const danger = dto.dangerThreshold;
    if (
      typeof caution !== "number" ||
      typeof warning !== "number" ||
      typeof danger !== "number" ||
      !(0 < caution && caution < warning && warning < danger && danger <= 12)
    ) {
      throw new BadRequestException(
        "Enabled angle/gangform thresholds must satisfy 0 < caution < warning < danger <= 12.",
      );
    }
  }

  private async assertAccess(auth: AuthTokenPayload, buildingId: string, permission: string) {
    const permitted = await this.permissions.hasPermission(auth.context, auth.sub, permission);
    if (!permitted) {
      throw new ForbiddenException("The alarm-level permission is missing.");
    }
    if (auth.context === AUTH_CONTEXT.gssAdmin) {
      return;
    }
    const user = await this.prisma.companyUser.findUnique({
      where: { id: auth.sub },
      select: { companyId: true },
    });
    const building = await this.prisma.constructionBuilding.findUnique({
      where: { id: buildingId },
    });
    if (!user || !building || building.companyId !== user.companyId) {
      throw new ForbiddenException("The requested resource is outside the assigned scope.");
    }
  }

  private actorType(auth: AuthTokenPayload): AuditActorType {
    return auth.context === AUTH_CONTEXT.gssAdmin
      ? AuditActorType.GSS_ADMIN
      : AuditActorType.COMPANY_USER;
  }

  private async getBuildingOrThrow(buildingId: string) {
    const building = await this.prisma.constructionBuilding.findUnique({
      select: buildingSelect,
      where: { id: buildingId },
    });
    if (!building) throw new NotFoundException("The construction building was not found.");
    return building;
  }

  private async getNodeTypeOrThrow(nodeTypeId: string) {
    const nodeType = await this.prisma.nodeType.findUnique({
      select: nodeTypeSelect,
      where: { id: nodeTypeId },
    });
    if (!nodeType) throw new NotFoundException("The node type was not found.");
    return nodeType;
  }

  private async getNodeTypeByKeyOrThrow(nodeTypeKey: string) {
    const nodeType = await this.prisma.nodeType.findUnique({
      select: nodeTypeSelect,
      where: { key: nodeTypeKey },
    });
    if (!nodeType) throw new NotFoundException("The node type was not found.");
    return nodeType;
  }

  private buildAlarmCommandSettings(
    nodeType: { numericCode: number },
    configuration: {
      cautionThreshold: number | null;
      dangerThreshold: number | null;
      warningThreshold: number | null;
    },
    desiredEnabled: boolean,
  ) {
    if (nodeType.numericCode === 0) {
      return {
        alarmEnabled: desiredEnabled,
        enabled: true,
      };
    }
    if (!desiredEnabled) {
      return {
        alarmEnabled: false,
        enabled: false,
      };
    }
    const caution = configuration.cautionThreshold;
    const warning = configuration.warningThreshold;
    const danger = configuration.dangerThreshold;
    if (
      typeof caution !== "number" ||
      typeof warning !== "number" ||
      typeof danger !== "number" ||
      !(0 < caution && caution < warning && warning < danger && danger <= 12)
    ) {
      throw new BadRequestException(
        "Angle/gangform gateway enable requires canonical building thresholds.",
      );
    }
    return {
      alarmEnabled: true,
      alarmLevel1: caution,
      alarmLevel2: warning,
      alarmLevel3: danger,
      enabled: true,
    };
  }

  private upsertGatewayAlarmApplication(
    auth: AuthTokenPayload,
    input: {
      buildingId: string;
      commandId: string | null;
      configurationId: string;
      configurationVersion: number;
      desiredEnabled: boolean;
      desiredStatus: GatewayCommandStatus;
      failureReason?: string | null;
      gatewayId: string;
      nodeTypeId: string;
    },
  ) {
    const actorType = this.actorType(auth);
    return this.prisma.gatewayAlarmLevelApplication.upsert({
      create: {
        buildingId: input.buildingId,
        configurationId: input.configurationId,
        configurationVersion: input.configurationVersion,
        desiredCommandId: input.commandId,
        desiredEnabled: input.desiredEnabled,
        desiredStatus: input.desiredStatus,
        failureReason: input.failureReason ?? null,
        gatewayId: input.gatewayId,
        nodeTypeId: input.nodeTypeId,
        updatedById: auth.sub,
        updatedByType: actorType,
      },
      update: {
        configurationId: input.configurationId,
        configurationVersion: input.configurationVersion,
        desiredCommandId: input.commandId,
        desiredEnabled: input.desiredEnabled,
        desiredStatus: input.desiredStatus,
        failureReason: input.failureReason ?? null,
        updatedById: auth.sub,
        updatedByType: actorType,
      },
      where: {
        buildingId_gatewayId_nodeTypeId: {
          buildingId: input.buildingId,
          gatewayId: input.gatewayId,
          nodeTypeId: input.nodeTypeId,
        },
      },
    });
  }

  private activeBuildingGateways(buildingId: string) {
    return this.prisma.gateway.findMany({
      orderBy: { serialNumber: "asc" },
      select: { id: true, serialNumber: true },
      where: {
        buildingAssignments: { some: { buildingId, status: AssignmentStatus.ACTIVE } },
        status: DeviceLifecycleStatus.ACTIVE,
      },
    });
  }

  private async getGatewayInBuildingOrThrow(buildingId: string, gatewayId: string) {
    const assignment = await this.prisma.gatewayBuildingAssignment.findFirst({
      include: {
        building: { select: { companyId: true } },
        gateway: {
          select: {
            companyAssignments: {
              select: { companyId: true },
              take: 1,
              where: { status: AssignmentStatus.ACTIVE },
            },
            id: true,
            serialNumber: true,
            status: true,
          },
        },
      },
      where: {
        buildingId,
        gateway: { status: DeviceLifecycleStatus.ACTIVE },
        gatewayId,
        status: AssignmentStatus.ACTIVE,
      },
    });
    if (!assignment)
      throw new BadRequestException("Gateway is not assigned to the selected building.");
    return {
      companyId: assignment.gateway.companyAssignments[0]?.companyId,
      id: assignment.gateway.id,
      serialNumber: assignment.gateway.serialNumber,
      status: assignment.gateway.status,
    };
  }

  private async validateFaultFilterNodes(
    companyId: string,
    gatewayId: string,
    nodeTypeId: string,
    nodeIds: string[],
  ) {
    const uniqueIds = [...new Set(nodeIds)];
    const nodes = await this.prisma.node.findMany({
      where: {
        companyAssignments: { some: { companyId, status: AssignmentStatus.ACTIVE } },
        gatewayAssignments: { some: { gatewayId, status: AssignmentStatus.ACTIVE } },
        id: { in: uniqueIds },
        nodeTypeId,
        status: DeviceLifecycleStatus.ACTIVE,
      },
      select: { id: true, number: true },
    });
    if (nodes.length !== uniqueIds.length) {
      throw new BadRequestException(
        "Every selected node must belong to the company, gateway and node type.",
      );
    }
    const byId = new Map(nodes.map((node) => [node.id, node]));
    return uniqueIds.map((nodeId) => byId.get(nodeId)!);
  }

  private activeGatewayNodes(gatewayId: string, nodeTypeId: string) {
    return this.prisma.node.findMany({
      orderBy: { number: "asc" },
      select: { id: true, number: true },
      where: {
        gatewayAssignments: { some: { gatewayId, status: AssignmentStatus.ACTIVE } },
        nodeTypeId,
        status: DeviceLifecycleStatus.ACTIVE,
      },
    });
  }

  private assertNoNumericDuplicates(nodeNumbers: string[]) {
    const normalized = nodeNumbers.map((nodeNumber) => {
      if (!/^\d+$/.test(nodeNumber.trim())) {
        throw new BadRequestException("Fault-filter node numbers must be numeric.");
      }
      const value = Number(nodeNumber);
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new BadRequestException(
          "Fault-filter node numbers must be safe non-negative integers.",
        );
      }
      return value;
    });
    if (new Set(normalized).size !== normalized.length) {
      throw new BadRequestException("Fault-filter nodes duplicate after numeric normalization.");
    }
  }
}
