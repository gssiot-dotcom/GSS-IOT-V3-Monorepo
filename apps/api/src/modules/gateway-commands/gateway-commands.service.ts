import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { loadApiEnv } from "@gss-iot/config";
import {
  AssignmentStatus,
  AuditActorType,
  DeviceLifecycleStatus,
  GatewayCommandStatus,
  ProvisioningMode,
} from "@prisma/client";
import type { GatewayCommandType, Prisma } from "@prisma/client";

import type { AuthTokenPayload } from "../../common/auth.types";
import { AUTH_CONTEXT } from "../../common/auth.types";
import { paginated, pageWindow } from "../../common/dto/pagination.dto";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { PrismaService } from "../../prisma/prisma.service";
import { GatewayCommandAdapterRegistry } from "./adapters/gateway-command-adapters";
import type { ParsedGatewayResponse } from "../mqtt/mqtt-payload-parser.service";
import type {
  ListGatewayCommandsQueryDto,
  RegisterNodesCommandDto,
  SetAlarmLevelsCommandDto,
  SetFaultFilterCommandDto,
  WakeSecurityCommandDto,
} from "./dto/gateway-commands.dto";

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

export const gatewayCommandSelect = {
  id: true,
  gatewayId: true,
  commandType: true,
  commandNumber: true,
  status: true,
  topic: true,
  payload: true,
  responsePayload: true,
  requesterType: true,
  requesterId: true,
  companyId: true,
  areaId: true,
  buildingId: true,
  scopeSnapshot: true,
  deletedAt: true,
  correlationKey: true,
  attemptCount: true,
  maxAttempts: true,
  lastAttemptAt: true,
  sentAt: true,
  acknowledgedAt: true,
  failedAt: true,
  expiresAt: true,
  cancelledAt: true,
  failureReason: true,
  createdAt: true,
  updatedAt: true,
  gateway: { select: { id: true, serialNumber: true } },
  provisioningRequest: {
    select: {
      id: true,
      companyId: true,
      buildingId: true,
      gatewayId: true,
      nodeTypeId: true,
      mode: true,
      status: true,
      responsePayload: true,
      failureReason: true,
      appliedAt: true,
      failedAt: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          nodeId: true,
          selected: true,
          assignmentId: true,
          appliedAt: true,
          failureReason: true,
          node: { select: { number: true } },
        },
      },
      endedAssignments: {
        select: { assignmentId: true, endedAt: true, id: true, nodeId: true },
      },
    },
  },
} satisfies Prisma.GatewayCommandSelect;

type SelectedGatewayCommand = Prisma.GatewayCommandGetPayload<{
  select: typeof gatewayCommandSelect;
}>;

export type GatewayResponseCorrelationMode = "legacy_cmd" | "legacy_shape" | "request_id";

export interface GatewayResponseHandleResult {
  appliedAssignmentCount?: number;
  command: SelectedGatewayCommand | null;
  correlationMode: GatewayResponseCorrelationMode;
  unmatchedReason?: string;
}

@Injectable()
export class GatewayCommandsService {
  private readonly env = loadApiEnv();
  private readonly logger = new Logger(GatewayCommandsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
    @Inject(GatewayCommandAdapterRegistry) private readonly adapters: GatewayCommandAdapterRegistry,
  ) {}

  async listCommands(query: ListGatewayCommandsQueryDto) {
    const where = {
      deletedAt: null,
      gatewayId: query.gatewayId,
      status: query.status,
    } satisfies Prisma.GatewayCommandWhereInput;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.gatewayCommand.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        select: gatewayCommandSelect,
        where,
        ...pageWindow(query),
      }),
      this.prisma.gatewayCommand.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  async getCommand(commandId: string) {
    return this.getCommandOrThrow(commandId, this.prisma);
  }

  async createRegisterNodesCommand(actor: AuthTokenPayload, dto: RegisterNodesCommandDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockGateway(dto.gatewayId, tx);
      const gateway = await this.getGatewayProvisioningContext(dto.gatewayId, dto.buildingId, tx);
      const nodeType = await this.getNodeTypeOrThrow(dto.nodeTypeId, tx);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${gateway.id}:${nodeType.id}`}))`;
      const activeRequest = await tx.nodeGatewayProvisioningRequest.findFirst({
        select: { id: true },
        where: {
          gatewayId: gateway.id,
          nodeTypeId: nodeType.id,
          status: {
            in: [
              GatewayCommandStatus.PENDING,
              GatewayCommandStatus.SENT,
              GatewayCommandStatus.FAILED,
            ],
          },
        },
      });
      if (activeRequest) {
        throw new ConflictException(
          "A nonterminal provisioning command already exists for this gateway and node type.",
        );
      }

      const selectedNodeIds = [...new Set(dto.nodeIds)];
      const selectedNodes = await this.getNodesForGatewayCommand(
        selectedNodeIds,
        gateway.companyId,
        tx,
      );
      if (selectedNodes.some((node) => node.nodeTypeId !== nodeType.id)) {
        throw new BadRequestException("All nodes must use the selected node type.");
      }
      if (
        selectedNodes.some(
          (node) =>
            node.gatewayAssignments[0]?.gatewayId &&
            node.gatewayAssignments[0].gatewayId !== gateway.id,
        )
      ) {
        throw new ConflictException("Selected nodes must not be assigned to another gateway.");
      }

      const currentAssignments = await tx.nodeGatewayAssignment.findMany({
        orderBy: { assignedAt: "asc" },
        select: { nodeId: true },
        where: {
          gatewayId: gateway.id,
          node: { nodeTypeId: nodeType.id },
          status: AssignmentStatus.ACTIVE,
        },
      });
      const currentNodeIds = currentAssignments.map((assignment) => assignment.nodeId);
      const finalNodeIds =
        dto.mode === ProvisioningMode.APPEND
          ? [...new Set([...currentNodeIds, ...selectedNodeIds])]
          : selectedNodeIds;
      const finalNodes = await this.getNodesForGatewayCommand(finalNodeIds, gateway.companyId, tx);
      if (finalNodes.some((node) => node.nodeTypeId !== nodeType.id)) {
        throw new BadRequestException("All final nodes must use the selected node type.");
      }
      if (
        finalNodes.some(
          (node) =>
            node.gatewayAssignments[0]?.gatewayId &&
            node.gatewayAssignments[0].gatewayId !== gateway.id,
        )
      ) {
        throw new ConflictException("Final nodes must not be assigned to another gateway.");
      }
      const selectedNodeSet = new Set(selectedNodeIds);
      const built = this.adapters.buildRegisterNodes({
        gatewaySerial: gateway.serialNumber,
        nodeNumbers: finalNodes.map((node) => node.number),
        nodeTypeNumericCode: nodeType.numericCode,
      });
      const expiresAt = new Date(
        Date.now() + (dto.expiresInSeconds ?? this.env.MQTT_COMMAND_EXPIRES_IN_SECONDS) * 1000,
      );
      const requesterType =
        actor.context === AUTH_CONTEXT.gssAdmin
          ? AuditActorType.GSS_ADMIN
          : AuditActorType.COMPANY_USER;
      const created = await tx.gatewayCommand.create({
        data: {
          areaId: gateway.areaId,
          buildingId: gateway.buildingId,
          commandNumber: built.commandNumber,
          commandType: built.commandType,
          correlationKey: `${gateway.serialNumber}:${built.commandNumber}`,
          expiresAt,
          companyId: gateway.companyId,
          gatewayId: gateway.id,
          maxAttempts: this.env.MQTT_MAX_PUBLISH_ATTEMPTS,
          payload: built.payload as Prisma.InputJsonObject,
          requesterId: actor.sub,
          requesterType,
          scopeSnapshot: {
            areaId: gateway.areaId,
            buildingId: gateway.buildingId,
            companyId: gateway.companyId,
          },
          topic: built.topic,
        },
        select: gatewayCommandSelect,
      });
      const command = await this.finalizeCommandPayload(created.id, built.payload, tx);
      const request = await tx.nodeGatewayProvisioningRequest.create({
        data: {
          buildingId: gateway.buildingId,
          commandId: command.id,
          companyId: gateway.companyId,
          gatewayId: gateway.id,
          items: {
            createMany: {
              data: finalNodes.map((node) => ({
                nodeId: node.id,
                selected: selectedNodeSet.has(node.id),
              })),
            },
          },
          mode: dto.mode,
          nodeTypeId: nodeType.id,
          requestedById: actor.sub,
          requestedByType: requesterType,
        },
        include: { items: true },
      });
      await this.auditLog.record(
        actor,
        {
          action: "gateway-command.create",
          entityId: command.id,
          entityType: "GatewayCommand",
          newValue: command,
        },
        tx,
      );
      await this.auditLog.record(
        actor,
        {
          action: "node-gateway-provisioning.request",
          entityId: request.id,
          entityType: "NodeGatewayProvisioningRequest",
          newValue: {
            mode: request.mode,
            requestId: request.id,
            selectedCount: selectedNodeIds.length,
            finalCount: finalNodeIds.length,
          },
        },
        tx,
      );
      return this.getCommandOrThrow(command.id, tx);
    });
  }

  async createWakeSecurityCommand(actor: AuthTokenPayload, dto: WakeSecurityCommandDto) {
    return this.createCommand(actor, dto.gatewayId, dto.expiresInSeconds, async (_tx, gateway) =>
      this.adapters.buildWakeSecurity({
        alarmActive: dto.alarmActive,
        alertLevel: dto.alertLevel,
        gatewaySerial: gateway.serialNumber,
      }),
    );
  }

  async createSetAlarmLevelsCommand(actor: AuthTokenPayload, dto: SetAlarmLevelsCommandDto) {
    return this.createCommand(actor, dto.gatewayId, dto.expiresInSeconds, async (tx, gateway) => {
      const nodeType = await this.getNodeTypeOrThrow(dto.nodeTypeId, tx);
      return this.adapters.buildSetAlarmLevels({
        alarmEnabled: dto.alarmEnabled,
        alarmLevel1: dto.alarmLevel1,
        alarmLevel2: dto.alarmLevel2,
        alarmLevel3: dto.alarmLevel3,
        enabled: dto.enabled,
        gatewaySerial: gateway.serialNumber,
        nodeTypeNumericCode: nodeType.numericCode,
      });
    });
  }

  async createSetFaultFilterCommand(actor: AuthTokenPayload, dto: SetFaultFilterCommandDto) {
    return this.createCommand(actor, dto.gatewayId, dto.expiresInSeconds, async (tx, gateway) => {
      const nodeType = await this.getNodeTypeOrThrow(dto.nodeTypeId, tx);
      const nodes = await this.getNodesForGatewayCommand(dto.nodeIds, gateway.companyId, tx);
      if (nodes.some((node) => node.nodeTypeId !== nodeType.id)) {
        throw new BadRequestException("All fault-filter nodes must use the selected node type.");
      }
      return this.adapters.buildSetFaultFilter({
        gatewaySerial: gateway.serialNumber,
        nodeNumbers: nodes.map((node) => node.number),
        nodeTypeNumericCode: nodeType.numericCode,
      });
    });
  }

  async markSent(commandId: string) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.gatewayCommand.updateMany({
        data: { sentAt: now, status: GatewayCommandStatus.SENT },
        where: { id: commandId, status: GatewayCommandStatus.PENDING },
      });
      if (updated.count > 0) {
        await tx.nodeGatewayProvisioningRequest.updateMany({
          where: { commandId },
          data: { failureReason: null, status: GatewayCommandStatus.SENT },
        });
        await tx.gatewayAlarmLevelApplication.updateMany({
          where: { desiredCommandId: commandId },
          data: { desiredStatus: GatewayCommandStatus.SENT, failureReason: null },
        });
        await tx.gatewayFaultFilterDesiredState.updateMany({
          where: { desiredCommandId: commandId },
          data: { desiredStatus: GatewayCommandStatus.SENT, failureReason: null },
        });
      }
      return this.getCommandOrThrow(commandId, tx);
    });
  }

  async markFailed(commandId: string, reason: string) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.gatewayCommand.updateMany({
        data: { failedAt: now, failureReason: reason, status: GatewayCommandStatus.FAILED },
        where: {
          id: commandId,
          status: { in: [GatewayCommandStatus.PENDING, GatewayCommandStatus.SENT] },
        },
      });
      if (updated.count > 0) {
        await tx.nodeGatewayProvisioningRequest.updateMany({
          where: { commandId },
          data: { failedAt: now, failureReason: reason, status: GatewayCommandStatus.FAILED },
        });
        await tx.nodeGatewayProvisioningItem.updateMany({
          where: { request: { commandId } },
          data: { failureReason: reason },
        });
        await tx.gatewayAlarmLevelApplication.updateMany({
          where: { desiredCommandId: commandId },
          data: { desiredStatus: GatewayCommandStatus.FAILED, failureReason: reason },
        });
        await tx.gatewayFaultFilterDesiredState.updateMany({
          where: { desiredCommandId: commandId },
          data: { desiredStatus: GatewayCommandStatus.FAILED, failureReason: reason },
        });
      }
      return this.getCommandOrThrow(commandId, tx);
    });
  }

  async startPublishAttempt(commandId: string) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const current = await this.getCommandOrThrow(commandId, tx);
      const currentPayload = this.jsonRecord(current.payload);
      if (currentPayload && currentPayload.requestId !== commandId) {
        await this.finalizeCommandPayload(commandId, currentPayload, tx);
      }
      await tx.gatewayCommand.updateMany({
        data: {
          attemptCount: { increment: 1 },
          failureReason: null,
          lastAttemptAt: now,
        },
        where: { id: commandId, status: GatewayCommandStatus.PENDING },
      });
      await tx.nodeGatewayProvisioningRequest.updateMany({
        where: { commandId, status: GatewayCommandStatus.PENDING },
        data: { failureReason: null },
      });
      await tx.gatewayAlarmLevelApplication.updateMany({
        where: { desiredCommandId: commandId, desiredStatus: GatewayCommandStatus.PENDING },
        data: { failureReason: null },
      });
      await tx.gatewayFaultFilterDesiredState.updateMany({
        where: { desiredCommandId: commandId, desiredStatus: GatewayCommandStatus.PENDING },
        data: { failureReason: null },
      });
      return this.getCommandOrThrow(commandId, tx);
    });
  }

  async acknowledgeSentCommand(
    gatewaySerial: string,
    commandNumber: number,
    responsePayload: Prisma.InputJsonValue,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const command = await this.findSingleLegacyCommand(gatewaySerial, commandNumber, tx);
      if (!command) {
        return null;
      }
      return (await this.acknowledgeCommand(command, responsePayload, tx, "legacy_cmd")).command;
    });
  }

  async failSentGatewayResponse(
    gatewaySerial: string,
    commandNumber: number,
    responsePayload: Prisma.InputJsonValue,
    reason: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const command = await this.findSingleLegacyCommand(gatewaySerial, commandNumber, tx);
      if (!command) {
        return null;
      }
      return this.failSentCommand(command, responsePayload, reason, tx);
    });
  }

  async handleGatewayResponse(
    response: ParsedGatewayResponse,
  ): Promise<GatewayResponseHandleResult> {
    if (response.requestId) {
      return this.handleRequestIdResponse(response);
    }
    return this.handleLegacyCommandResponse(response);
  }

  async retryCommand(actor: AuthTokenPayload, commandId: string) {
    return this.prisma.$transaction(async (tx) => {
      const command = await this.getCommandOrThrow(commandId, tx);
      await this.lockGateway(command.gatewayId, tx);
      await this.assertGatewayNotRetired(command.gatewayId, tx);
      if (command.status !== GatewayCommandStatus.FAILED) {
        throw new BadRequestException("Only failed commands can be retried.");
      }
      if (command.attemptCount >= command.maxAttempts) {
        throw new BadRequestException("Command retry limit has been reached.");
      }
      const retried = await tx.gatewayCommand.update({
        where: { id: commandId },
        data: { failureReason: null, status: GatewayCommandStatus.PENDING },
        select: gatewayCommandSelect,
      });
      await tx.nodeGatewayProvisioningRequest.updateMany({
        where: { commandId },
        data: {
          failedAt: null,
          failureReason: null,
          status: GatewayCommandStatus.PENDING,
        },
      });
      await tx.nodeGatewayProvisioningItem.updateMany({
        where: { request: { commandId }, assignmentId: null },
        data: { failureReason: null },
      });
      await tx.gatewayAlarmLevelApplication.updateMany({
        where: { desiredCommandId: commandId },
        data: { desiredStatus: GatewayCommandStatus.PENDING, failureReason: null },
      });
      await tx.gatewayFaultFilterDesiredState.updateMany({
        where: { desiredCommandId: commandId },
        data: { desiredStatus: GatewayCommandStatus.PENDING, failureReason: null },
      });
      await this.auditLog.record(
        actor,
        {
          action: "gateway-command.retry",
          entityId: retried.id,
          entityType: "GatewayCommand",
          newValue: retried,
          oldValue: command,
        },
        tx,
      );
      return retried;
    });
  }

  async cancelCommand(actor: AuthTokenPayload, commandId: string) {
    return this.prisma.$transaction(async (tx) => {
      const command = await this.getCommandOrThrow(commandId, tx);
      if (
        command.status !== GatewayCommandStatus.PENDING &&
        command.status !== GatewayCommandStatus.FAILED
      ) {
        throw new BadRequestException("Only pending or failed commands can be cancelled.");
      }
      const cancelled = await tx.gatewayCommand.update({
        where: { id: commandId },
        data: {
          activeKey: command.id,
          cancelledAt: new Date(),
          status: GatewayCommandStatus.CANCELLED,
        },
        select: gatewayCommandSelect,
      });
      await tx.nodeGatewayProvisioningRequest.updateMany({
        where: { commandId },
        data: {
          failureReason: "Command was cancelled before successful acknowledgement.",
          status: GatewayCommandStatus.CANCELLED,
        },
      });
      await tx.gatewayAlarmLevelApplication.updateMany({
        where: { desiredCommandId: commandId },
        data: {
          desiredStatus: GatewayCommandStatus.CANCELLED,
          failureReason: "Command was cancelled before successful acknowledgement.",
        },
      });
      await tx.gatewayFaultFilterDesiredState.updateMany({
        where: { desiredCommandId: commandId },
        data: {
          desiredStatus: GatewayCommandStatus.CANCELLED,
          failureReason: "Command was cancelled before successful acknowledgement.",
        },
      });
      await this.auditLog.record(
        actor,
        {
          action: "gateway-command.cancel",
          entityId: cancelled.id,
          entityType: "GatewayCommand",
          newValue: cancelled,
          oldValue: command,
        },
        tx,
      );
      return cancelled;
    });
  }

  async expireOverdueCommands() {
    const now = new Date();
    const commands = await this.prisma.gatewayCommand.findMany({
      select: gatewayCommandSelect,
      where: {
        expiresAt: { lte: now },
        status: {
          in: [GatewayCommandStatus.PENDING, GatewayCommandStatus.SENT],
        },
      },
    });
    for (const command of commands) {
      const expired = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.gatewayCommand.update({
          where: { id: command.id },
          data: { activeKey: command.id, status: GatewayCommandStatus.EXPIRED },
          select: gatewayCommandSelect,
        });
        await tx.nodeGatewayProvisioningRequest.updateMany({
          where: { commandId: command.id },
          data: {
            failureReason: "Command expired before successful acknowledgement.",
            status: GatewayCommandStatus.EXPIRED,
          },
        });
        await tx.gatewayAlarmLevelApplication.updateMany({
          where: { desiredCommandId: command.id },
          data: {
            desiredStatus: GatewayCommandStatus.EXPIRED,
            failureReason: "Command expired before successful acknowledgement.",
          },
        });
        await tx.gatewayFaultFilterDesiredState.updateMany({
          where: { desiredCommandId: command.id },
          data: {
            desiredStatus: GatewayCommandStatus.EXPIRED,
            failureReason: "Command expired before successful acknowledgement.",
          },
        });
        return updated;
      });
      await this.auditLog.record(this.systemActor(), {
        action: "gateway-command.expire",
        entityId: expired.id,
        entityType: "GatewayCommand",
        newValue: expired,
        oldValue: command,
      });
    }
    return commands.length;
  }

  async pendingCommandsForGateway(gatewayId: string) {
    return this.prisma.gatewayCommand.findMany({
      orderBy: { createdAt: "asc" },
      select: gatewayCommandSelect,
      where: { gatewayId, status: GatewayCommandStatus.PENDING },
    });
  }

  private async handleRequestIdResponse(
    response: ParsedGatewayResponse,
  ): Promise<GatewayResponseHandleResult> {
    if (!this.isUuid(response.requestId!)) {
      return {
        command: null,
        correlationMode: "request_id",
        unmatchedReason: "malformed_request_id",
      };
    }
    return this.prisma.$transaction(async (tx) => {
      const command = await tx.gatewayCommand.findUnique({
        where: { id: response.requestId },
        select: gatewayCommandSelect,
      });
      if (!command) {
        return {
          command: null,
          correlationMode: "request_id",
          unmatchedReason: "unknown_request_id",
        };
      }
      if (!this.gatewaySerialMatches(command.gateway.serialNumber, response.gatewaySerial)) {
        return {
          command: null,
          correlationMode: "request_id",
          unmatchedReason: "request_id_gateway_mismatch",
        };
      }
      if (command.commandNumber !== response.cmd) {
        return {
          command: null,
          correlationMode: "request_id",
          unmatchedReason: "request_id_cmd_mismatch",
        };
      }
      const ineligibleReason = this.responseIneligibleReason(command, true);
      if (ineligibleReason) {
        return {
          command: null,
          correlationMode: "request_id",
          unmatchedReason: ineligibleReason,
        };
      }
      return this.applyParsedResponse(command, response, tx, "request_id");
    });
  }

  private async handleLegacyCommandResponse(
    response: ParsedGatewayResponse,
  ): Promise<GatewayResponseHandleResult> {
    return this.prisma.$transaction(async (tx) => {
      const candidates = await this.findLegacyCandidates(response.gatewaySerial, response.cmd, tx);
      if (candidates.length === 0) {
        return {
          command: null,
          correlationMode: "legacy_cmd",
          unmatchedReason: "no_eligible_legacy_command",
        };
      }
      if (candidates.length > 1) {
        return {
          command: null,
          correlationMode: "legacy_cmd",
          unmatchedReason: "ambiguous_legacy_command",
        };
      }
      return this.applyParsedResponse(candidates[0]!, response, tx, "legacy_cmd");
    });
  }

  private async applyParsedResponse(
    command: SelectedGatewayCommand,
    response: ParsedGatewayResponse,
    tx: Prisma.TransactionClient,
    correlationMode: GatewayResponseCorrelationMode,
  ): Promise<GatewayResponseHandleResult> {
    if (!response.success) {
      const failed = await this.failSentCommand(
        command,
        response.payload as Prisma.InputJsonObject,
        response.failureReason ?? "Gateway returned a negative acknowledgement.",
        tx,
      );
      return { command: failed, correlationMode };
    }
    const responseMismatch = this.validateSuccessfulResponsePayload(command, response.payload);
    if (responseMismatch) {
      if (correlationMode === "legacy_cmd") {
        return { command: null, correlationMode, unmatchedReason: responseMismatch };
      }
      const failed = await this.failSentCommand(
        command,
        response.payload as Prisma.InputJsonObject,
        responseMismatch,
        tx,
      );
      return { command: failed, correlationMode, unmatchedReason: responseMismatch };
    }
    return this.acknowledgeCommand(
      command,
      response.payload as Prisma.InputJsonObject,
      tx,
      correlationMode,
    );
  }

  private async findSingleLegacyCommand(
    gatewaySerial: string,
    commandNumber: number,
    executor: PrismaExecutor,
  ) {
    const candidates = await this.findLegacyCandidates(gatewaySerial, commandNumber, executor);
    return candidates.length === 1 ? candidates[0]! : null;
  }

  private async findLegacyCandidates(
    gatewaySerial: string,
    commandNumber: number,
    executor: PrismaExecutor,
  ) {
    return executor.gatewayCommand.findMany({
      orderBy: { sentAt: "asc" },
      select: gatewayCommandSelect,
      where: {
        activeKey: "active",
        commandNumber,
        gateway: {
          OR: [{ serialNumber: gatewaySerial }, { serialNumber: { endsWith: gatewaySerial } }],
        },
        status: GatewayCommandStatus.SENT,
      },
    });
  }

  private async acknowledgeCommand(
    command: SelectedGatewayCommand,
    responsePayload: Prisma.InputJsonValue,
    tx: Prisma.TransactionClient,
    correlationMode: GatewayResponseCorrelationMode,
  ): Promise<GatewayResponseHandleResult> {
    if (command.commandType === "REGISTER_NODES") {
      const failureReason = await this.validateProvisioningApply(command.id, tx);
      if (failureReason) {
        const failed = await this.failSentCommand(command, responsePayload, failureReason, tx);
        return { command: failed, correlationMode };
      }
    }
    const updated = await tx.gatewayCommand.updateMany({
      data: {
        acknowledgedAt: new Date(),
        activeKey: command.id,
        responsePayload,
        status: GatewayCommandStatus.ACKNOWLEDGED,
      },
      where: {
        id: command.id,
        status: { in: [GatewayCommandStatus.PENDING, GatewayCommandStatus.SENT] },
      },
    });
    if (updated.count === 0) {
      return {
        command: null,
        correlationMode,
        unmatchedReason: this.terminalResponseReason(command.status),
      };
    }
    let appliedAssignmentCount = 0;
    if (command.commandType === "REGISTER_NODES") {
      appliedAssignmentCount = await this.applyProvisioningRequest(command.id, responsePayload, tx);
    } else if (command.commandType === "SET_ALARM_LEVELS") {
      await this.applyAlarmLevelCommand(command.id, responsePayload, tx);
    } else if (command.commandType === "SET_FAULT_FILTER") {
      await this.applyFaultFilterCommand(command.id, responsePayload, tx);
    }
    const acknowledged = await this.getCommandOrThrow(command.id, tx);
    await this.auditLog.record(
      this.systemActor(),
      {
        action: "gateway-command.acknowledge",
        entityId: acknowledged.id,
        entityType: "GatewayCommand",
        newValue: acknowledged,
        oldValue: command,
      },
      tx,
    );
    this.logger.log(
      `Gateway command acknowledged commandId=${acknowledged.id} correlationMode=${correlationMode} appliedAssignmentCount=${appliedAssignmentCount}`,
    );
    return { appliedAssignmentCount, command: acknowledged, correlationMode };
  }

  private async failSentCommand(
    command: SelectedGatewayCommand,
    responsePayload: Prisma.InputJsonValue,
    reason: string,
    tx: Prisma.TransactionClient,
  ) {
    const now = new Date();
    const updated = await tx.gatewayCommand.updateMany({
      data: {
        failedAt: now,
        failureReason: reason,
        responsePayload,
        status: GatewayCommandStatus.FAILED,
      },
      where: {
        id: command.id,
        status: { in: [GatewayCommandStatus.PENDING, GatewayCommandStatus.SENT] },
      },
    });
    if (updated.count === 0) {
      return this.getCommandOrThrow(command.id, tx);
    }
    await tx.nodeGatewayProvisioningRequest.updateMany({
      where: { commandId: command.id },
      data: {
        failedAt: now,
        failureReason: reason,
        responsePayload,
        status: GatewayCommandStatus.FAILED,
      },
    });
    await tx.nodeGatewayProvisioningItem.updateMany({
      where: { request: { commandId: command.id }, assignmentId: null },
      data: { failureReason: reason },
    });
    await tx.gatewayAlarmLevelApplication.updateMany({
      where: { desiredCommandId: command.id },
      data: { desiredStatus: GatewayCommandStatus.FAILED, failureReason: reason },
    });
    await tx.gatewayFaultFilterDesiredState.updateMany({
      where: { desiredCommandId: command.id },
      data: { desiredStatus: GatewayCommandStatus.FAILED, failureReason: reason },
    });
    const failed = await this.getCommandOrThrow(command.id, tx);
    await this.auditLog.record(
      this.systemActor(),
      {
        action: "gateway-command.response-failed",
        entityId: failed.id,
        entityType: "GatewayCommand",
        newValue: failed,
        oldValue: command,
      },
      tx,
    );
    this.logger.warn(`Gateway command failed commandId=${failed.id} reason=${reason}`);
    return failed;
  }

  private async validateProvisioningApply(
    commandId: string,
    executor: PrismaExecutor,
  ): Promise<string | null> {
    const request = await executor.nodeGatewayProvisioningRequest.findUnique({
      where: { commandId },
      include: { items: true },
    });
    if (!request) {
      return "Provisioning request is missing for register-nodes command.";
    }
    const gatewayCompany = await executor.companyDeviceAssignment.findFirst({
      where: {
        companyId: request.companyId,
        gatewayId: request.gatewayId,
        status: AssignmentStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (!gatewayCompany) {
      return "Gateway is no longer assigned to the requested company.";
    }
    const gatewayBuilding = await executor.gatewayBuildingAssignment.findFirst({
      where: {
        buildingId: request.buildingId,
        gatewayId: request.gatewayId,
        status: AssignmentStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (!gatewayBuilding) {
      return "Gateway is no longer assigned to the requested building.";
    }
    const nodeIds = request.items.map((item) => item.nodeId);
    const nodes = await executor.node.findMany({
      where: { id: { in: nodeIds }, status: { not: DeviceLifecycleStatus.RETIRED } },
      select: {
        id: true,
        nodeTypeId: true,
        companyAssignments: {
          where: { status: AssignmentStatus.ACTIVE },
          select: { companyId: true },
          take: 1,
        },
        gatewayAssignments: {
          where: { status: AssignmentStatus.ACTIVE },
          select: { gatewayId: true },
          take: 1,
        },
      },
    });
    if (nodes.length !== nodeIds.length) {
      return "One or more requested nodes no longer exist.";
    }
    for (const node of nodes) {
      if (node.nodeTypeId !== request.nodeTypeId) {
        return "One or more requested nodes no longer match the provisioning node type.";
      }
      if (node.companyAssignments[0]?.companyId !== request.companyId) {
        return "One or more requested nodes are no longer assigned to the requested company.";
      }
      const assignedGatewayId = node.gatewayAssignments[0]?.gatewayId;
      if (assignedGatewayId && assignedGatewayId !== request.gatewayId) {
        return "One or more requested nodes are already assigned to another gateway.";
      }
    }
    return null;
  }

  private async applyProvisioningRequest(
    commandId: string,
    responsePayload: Prisma.InputJsonValue,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const request = await tx.nodeGatewayProvisioningRequest.findUnique({
      where: { commandId },
      include: { items: true },
    });
    if (!request || request.status === GatewayCommandStatus.ACKNOWLEDGED) {
      return 0;
    }
    const now = new Date();
    const appliedAssignments: Array<{ gatewayId: string; id: string; nodeId: string }> = [];
    const createdAssignmentIds: string[] = [];
    const retainedAssignmentIds: string[] = [];
    const endedAssignmentIds: string[] = [];
    const finalNodeIds = new Set(request.items.map((item) => item.nodeId));
    if (request.mode === ProvisioningMode.REPLACE) {
      const currentAssignments = await tx.nodeGatewayAssignment.findMany({
        select: { gatewayId: true, id: true, nodeId: true },
        where: {
          gatewayId: request.gatewayId,
          node: { nodeTypeId: request.nodeTypeId },
          status: AssignmentStatus.ACTIVE,
        },
      });
      for (const assignment of currentAssignments) {
        if (finalNodeIds.has(assignment.nodeId)) continue;
        await tx.nodeGatewayAssignment.update({
          where: { id: assignment.id },
          data: { activeKey: assignment.id, status: AssignmentStatus.ENDED, unassignedAt: now },
        });
        const ended = await tx.nodeGatewayProvisioningEndedAssignment.create({
          data: {
            assignmentId: assignment.id,
            nodeId: assignment.nodeId,
            requestId: request.id,
            endedAt: now,
          },
        });
        endedAssignmentIds.push(ended.id);
      }
    }
    for (const item of request.items) {
      let assignment = await tx.nodeGatewayAssignment.findFirst({
        where: { nodeId: item.nodeId, status: AssignmentStatus.ACTIVE },
      });
      if (!assignment) {
        assignment = await tx.nodeGatewayAssignment.create({
          data: {
            gatewayId: request.gatewayId,
            nodeId: item.nodeId,
            sourceCommandId: commandId,
          },
        });
        createdAssignmentIds.push(assignment.id);
      } else {
        retainedAssignmentIds.push(assignment.id);
      }
      await tx.nodeGatewayProvisioningItem.update({
        where: { id: item.id },
        data: {
          appliedAt: now,
          assignmentId: assignment.id,
          failureReason: null,
        },
      });
      appliedAssignments.push({
        gatewayId: assignment.gatewayId,
        id: assignment.id,
        nodeId: assignment.nodeId,
      });
    }
    const applied = await tx.nodeGatewayProvisioningRequest.update({
      where: { id: request.id },
      data: {
        appliedAt: now,
        failureReason: null,
        responsePayload,
        status: GatewayCommandStatus.ACKNOWLEDGED,
      },
      include: { items: true },
    });
    await this.auditLog.record(
      this.systemActor(),
      {
        action: "node-gateway-provisioning.apply",
        entityId: request.id,
        entityType: "NodeGatewayProvisioningRequest",
        newValue: {
          appliedRequestId: applied.id,
          assignmentIds: appliedAssignments.map((assignment) => assignment.id),
          createdAssignmentIds,
          endedAssignmentIds,
          itemCount: applied.items.length,
          mode: request.mode,
          retainedAssignmentIds,
        },
        oldValue: request,
      },
      tx,
    );
    return appliedAssignments.length;
  }

  private async applyAlarmLevelCommand(
    commandId: string,
    responsePayload: Prisma.InputJsonValue,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const application = await tx.gatewayAlarmLevelApplication.findFirst({
      where: { desiredCommandId: commandId },
    });
    if (!application || application.appliedCommandId === commandId) {
      return;
    }
    const now = new Date();
    const updated = await tx.gatewayAlarmLevelApplication.update({
      where: { id: application.id },
      data: {
        appliedAt: now,
        appliedCommandId: commandId,
        appliedConfigurationId: application.configurationId,
        appliedConfigurationVersion: application.configurationVersion,
        appliedEnabled: application.desiredEnabled,
        appliedRequestId: commandId,
        desiredStatus: GatewayCommandStatus.ACKNOWLEDGED,
        failureReason: null,
        lastSuccessfulPayload: responsePayload,
      },
    });
    await this.auditLog.record(
      this.systemActor(),
      {
        action: "alarm-levels.apply",
        entityId: updated.id,
        entityType: "GatewayAlarmLevelApplication",
        newValue: updated,
        oldValue: application,
      },
      tx,
    );
  }

  private async applyFaultFilterCommand(
    commandId: string,
    responsePayload: Prisma.InputJsonValue,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const desiredStates = await tx.gatewayFaultFilterDesiredState.findMany({
      where: { desiredCommandId: commandId },
    });
    if (!desiredStates.length) {
      return;
    }
    const now = new Date();
    const appliedStateIds: string[] = [];
    for (const desired of desiredStates) {
      await tx.gatewayFaultFilterDesiredState.update({
        where: { id: desired.id },
        data: {
          desiredStatus: GatewayCommandStatus.ACKNOWLEDGED,
          failureReason: null,
        },
      });
      const applied = await tx.gatewayFaultFilterAppliedState.upsert({
        create: {
          applied: desired.enabled,
          appliedAt: now,
          appliedCommandId: commandId,
          appliedRequestId: commandId,
          gatewayId: desired.gatewayId,
          lastSuccessfulPayload: responsePayload,
          nodeId: desired.nodeId,
          nodeTypeId: desired.nodeTypeId,
          status: GatewayCommandStatus.ACKNOWLEDGED,
        },
        update: {
          applied: desired.enabled,
          appliedAt: now,
          appliedCommandId: commandId,
          appliedRequestId: commandId,
          failureReason: null,
          lastSuccessfulPayload: responsePayload,
          status: GatewayCommandStatus.ACKNOWLEDGED,
        },
        where: {
          gatewayId_nodeTypeId_nodeId: {
            gatewayId: desired.gatewayId,
            nodeId: desired.nodeId,
            nodeTypeId: desired.nodeTypeId,
          },
        },
      });
      appliedStateIds.push(applied.id);
    }
    await this.auditLog.record(
      this.systemActor(),
      {
        action: "fault-filter.apply",
        entityId: commandId,
        entityType: "GatewayCommand",
        newValue: {
          appliedStateIds,
          commandId,
          desiredStateCount: desiredStates.length,
        },
      },
      tx,
    );
  }

  private async createCommand(
    actor: AuthTokenPayload,
    gatewayId: string,
    expiresInSeconds: number | undefined,
    build: (
      tx: Prisma.TransactionClient,
      gateway: {
        areaId: string | null;
        buildingId: string | null;
        companyId: string;
        id: string;
        serialNumber: string;
      },
    ) => Promise<{
      commandNumber: number;
      commandType: GatewayCommandType;
      payload: Record<string, unknown>;
      topic: string;
    }>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockGateway(gatewayId, tx);
      const gateway = await this.getGatewayCommandContext(gatewayId, tx);
      const built = await build(tx, gateway);
      const expiresAt = new Date(
        Date.now() + (expiresInSeconds ?? this.env.MQTT_COMMAND_EXPIRES_IN_SECONDS) * 1000,
      );
      const created = await tx.gatewayCommand.create({
        data: {
          areaId: gateway.areaId,
          buildingId: gateway.buildingId,
          commandNumber: built.commandNumber,
          commandType: built.commandType,
          correlationKey: `${gateway.serialNumber}:${built.commandNumber}`,
          expiresAt,
          companyId: gateway.companyId,
          gatewayId,
          maxAttempts: this.env.MQTT_MAX_PUBLISH_ATTEMPTS,
          payload: built.payload as Prisma.InputJsonObject,
          requesterId: actor.sub,
          requesterType:
            actor.context === AUTH_CONTEXT.gssAdmin
              ? AuditActorType.GSS_ADMIN
              : AuditActorType.COMPANY_USER,
          scopeSnapshot: {
            areaId: gateway.areaId,
            buildingId: gateway.buildingId,
            companyId: gateway.companyId,
          },
          topic: built.topic,
        },
        select: gatewayCommandSelect,
      });
      const command = await this.finalizeCommandPayload(created.id, built.payload, tx);
      await this.auditLog.record(
        actor,
        {
          action: "gateway-command.create",
          entityId: command.id,
          entityType: "GatewayCommand",
          newValue: command,
        },
        tx,
      );
      return command;
    });
  }

  private async getGatewayCommandContext(gatewayId: string, executor: PrismaExecutor) {
    const gateway = await executor.gateway.findUnique({
      where: { id: gatewayId },
      select: {
        id: true,
        serialNumber: true,
        status: true,
        companyAssignments: {
          where: {
            company: { deletedAt: null, status: "ACTIVE" },
            status: AssignmentStatus.ACTIVE,
          },
          select: { companyId: true },
          take: 1,
        },
        buildingAssignments: {
          where: {
            building: {
              area: { deletedAt: null },
              company: { deletedAt: null, status: "ACTIVE" },
              deletedAt: null,
            },
            status: AssignmentStatus.ACTIVE,
          },
          select: { building: { select: { areaId: true } }, buildingId: true },
          take: 1,
        },
      },
    });
    if (!gateway) {
      throw new NotFoundException("The gateway was not found.");
    }
    if (gateway.status === DeviceLifecycleStatus.RETIRED) {
      throw new ConflictException("Retired gateways cannot receive commands.");
    }
    const companyId = gateway.companyAssignments[0]?.companyId;
    if (!companyId) {
      throw new BadRequestException("Gateway must be assigned to a company before commands.");
    }
    return {
      areaId: gateway.buildingAssignments[0]?.building.areaId ?? null,
      buildingId: gateway.buildingAssignments[0]?.buildingId ?? null,
      companyId,
      id: gateway.id,
      serialNumber: gateway.serialNumber,
    };
  }

  private async getGatewayProvisioningContext(
    gatewayId: string,
    buildingId: string,
    executor: PrismaExecutor,
  ) {
    const gateway = await executor.gateway.findUnique({
      where: { id: gatewayId },
      select: {
        id: true,
        serialNumber: true,
        status: true,
        companyAssignments: {
          where: {
            company: { deletedAt: null, status: "ACTIVE" },
            status: AssignmentStatus.ACTIVE,
          },
          select: { companyId: true },
          take: 1,
        },
        buildingAssignments: {
          where: {
            building: {
              area: { deletedAt: null },
              company: { deletedAt: null, status: "ACTIVE" },
              deletedAt: null,
            },
            status: AssignmentStatus.ACTIVE,
          },
          select: {
            buildingId: true,
            building: { select: { areaId: true, companyId: true, id: true } },
          },
          take: 1,
        },
      },
    });
    if (!gateway) {
      throw new NotFoundException("The gateway was not found.");
    }
    if (gateway.status === DeviceLifecycleStatus.RETIRED) {
      throw new ConflictException("Retired gateways cannot be provisioned.");
    }
    const companyId = gateway.companyAssignments[0]?.companyId;
    if (!companyId) {
      throw new BadRequestException("Gateway must be assigned to a company before provisioning.");
    }
    const buildingAssignment = gateway.buildingAssignments[0];
    if (!buildingAssignment) {
      throw new BadRequestException("Gateway must be assigned to a building before provisioning.");
    }
    if (buildingAssignment.buildingId !== buildingId) {
      throw new BadRequestException("Gateway is not assigned to the selected building.");
    }
    if (buildingAssignment.building.companyId !== companyId) {
      throw new ConflictException("Gateway company and building company do not match.");
    }
    return {
      areaId: buildingAssignment.building.areaId,
      buildingId,
      companyId,
      id: gateway.id,
      serialNumber: gateway.serialNumber,
    };
  }

  private async getNodeTypeOrThrow(nodeTypeId: string, executor: PrismaExecutor) {
    const nodeType = await executor.nodeType.findUnique({
      where: { id: nodeTypeId },
      select: { id: true, numericCode: true },
    });
    if (!nodeType) {
      throw new NotFoundException("The node type was not found.");
    }
    return nodeType;
  }

  private async getNodesForGatewayCommand(
    nodeIds: string[],
    companyId: string,
    executor: Prisma.TransactionClient,
  ) {
    const uniqueNodeIds = [...new Set(nodeIds)];
    for (const nodeId of [...uniqueNodeIds].sort()) {
      await this.lockNode(nodeId, executor);
    }
    const nodes = await executor.node.findMany({
      where: {
        id: { in: uniqueNodeIds },
        status: { not: DeviceLifecycleStatus.RETIRED },
        companyAssignments: { some: { companyId, status: AssignmentStatus.ACTIVE } },
      },
      select: {
        id: true,
        nodeTypeId: true,
        number: true,
        gatewayAssignments: {
          where: { status: AssignmentStatus.ACTIVE },
          select: { gatewayId: true },
          take: 1,
        },
      },
    });
    if (nodes.length !== uniqueNodeIds.length) {
      throw new BadRequestException(
        "All nodes must be active inventory devices and belong to the gateway company.",
      );
    }
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    return nodeIds.map((nodeId) => nodesById.get(nodeId)!);
  }

  private async assertGatewayNotRetired(gatewayId: string, executor: PrismaExecutor) {
    const gateway = await executor.gateway.findUnique({
      where: { id: gatewayId },
      select: { status: true },
    });
    if (!gateway) throw new NotFoundException("The gateway was not found.");
    if (gateway.status === DeviceLifecycleStatus.RETIRED) {
      throw new ConflictException("Retired gateways cannot receive commands.");
    }
  }

  private async lockGateway(gatewayId: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT "id" FROM "Gateway" WHERE "id" = ${gatewayId}::uuid FOR UPDATE`;
  }

  private async lockNode(nodeId: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT "id" FROM "Node" WHERE "id" = ${nodeId}::uuid FOR UPDATE`;
  }

  private async getCommandOrThrow(commandId: string, executor: PrismaExecutor) {
    const command = await executor.gatewayCommand.findUnique({
      where: { id: commandId },
      select: gatewayCommandSelect,
    });
    if (!command) {
      throw new NotFoundException("The gateway command was not found.");
    }
    return command;
  }

  private async finalizeCommandPayload(
    commandId: string,
    payload: Record<string, unknown>,
    executor: PrismaExecutor,
  ) {
    return executor.gatewayCommand.update({
      where: { id: commandId },
      data: { payload: this.withRequestId(commandId, payload) },
      select: gatewayCommandSelect,
    });
  }

  private withRequestId(
    commandId: string,
    payload: Record<string, unknown>,
  ): Prisma.InputJsonObject {
    const { cmd, ...rest } = payload;
    return { cmd, requestId: commandId, ...rest } as Prisma.InputJsonObject;
  }

  private responseIneligibleReason(
    command: SelectedGatewayCommand,
    allowPublishSelectedPending: boolean,
  ): string | null {
    if (command.status === GatewayCommandStatus.ACKNOWLEDGED) {
      return "duplicate_response_ignored";
    }
    if (
      command.status === GatewayCommandStatus.EXPIRED ||
      command.status === GatewayCommandStatus.CANCELLED ||
      command.status === GatewayCommandStatus.FAILED
    ) {
      return "late_response_ignored";
    }
    if (command.status === GatewayCommandStatus.SENT) {
      return null;
    }
    if (
      allowPublishSelectedPending &&
      command.status === GatewayCommandStatus.PENDING &&
      command.attemptCount > 0 &&
      command.lastAttemptAt
    ) {
      return null;
    }
    return "command_not_selected_for_publish";
  }

  private terminalResponseReason(status: GatewayCommandStatus): string {
    return status === GatewayCommandStatus.ACKNOWLEDGED
      ? "duplicate_response_ignored"
      : "late_response_ignored";
  }

  private validateSuccessfulResponsePayload(
    command: SelectedGatewayCommand,
    responsePayload: Record<string, unknown>,
  ): string | null {
    const commandPayload = this.jsonRecord(command.payload);
    if (!commandPayload) {
      return "stored_command_payload_invalid";
    }
    if (command.commandType === "REGISTER_NODES") {
      return this.validateNodeCommandResponse(commandPayload, responsePayload, true);
    }
    if (command.commandType === "SET_FAULT_FILTER") {
      return this.validateNodeCommandResponse(commandPayload, responsePayload, false);
    }
    if (
      command.commandType === "SET_ALARM_LEVELS" &&
      responsePayload.nodeType !== undefined &&
      Number(responsePayload.nodeType) !== Number(commandPayload.nodeType)
    ) {
      return "response_node_type_mismatch";
    }
    return null;
  }

  private validateNodeCommandResponse(
    commandPayload: Record<string, unknown>,
    responsePayload: Record<string, unknown>,
    requireFields: boolean,
  ): string | null {
    const hasNodeType = responsePayload.nodeType !== undefined;
    const hasNumNodes = responsePayload.numNodes !== undefined;
    const hasNodes = responsePayload.nodes !== undefined;
    if (requireFields && (!hasNodeType || !hasNumNodes || !hasNodes)) {
      return "response_missing_node_identifiers";
    }
    if (hasNodeType && Number(responsePayload.nodeType) !== Number(commandPayload.nodeType)) {
      return "response_node_type_mismatch";
    }
    if (hasNumNodes && Number(responsePayload.numNodes) !== Number(commandPayload.numNodes)) {
      return "response_num_nodes_mismatch";
    }
    if (hasNodes) {
      const commandNodes = this.numberArray(commandPayload.nodes);
      const responseNodes = this.numberArray(responsePayload.nodes);
      if (!commandNodes || !responseNodes || !this.sameNumberSet(commandNodes, responseNodes)) {
        return "response_nodes_mismatch";
      }
    }
    return null;
  }

  private jsonRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private numberArray(value: unknown): number[] | null {
    if (!Array.isArray(value)) {
      return null;
    }
    const numbers = value.map((entry) => Number(entry));
    return numbers.every((entry) => Number.isSafeInteger(entry)) ? numbers : null;
  }

  private sameNumberSet(left: number[], right: number[]): boolean {
    if (left.length !== right.length) {
      return false;
    }
    const normalize = (values: number[]) => [...values].sort((a, b) => a - b).join(",");
    return normalize(left) === normalize(right);
  }

  private gatewaySerialMatches(storedSerial: string, topicSerial: string): boolean {
    return storedSerial === topicSerial || storedSerial.endsWith(topicSerial);
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private systemActor(): AuthTokenPayload {
    return {
      aud: AUTH_CONTEXT.gssAdmin,
      context: AUTH_CONTEXT.gssAdmin,
      sub: "00000000-0000-0000-0000-000000000000",
      tokenVersion: 0,
    };
  }
}
