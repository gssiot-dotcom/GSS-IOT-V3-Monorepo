import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { loadApiEnv } from "@gss-iot/config";
import { AssignmentStatus, AuditActorType, GatewayCommandStatus } from "@prisma/client";
import type { GatewayCommandType, Prisma } from "@prisma/client";

import type { AuthTokenPayload } from "../../common/auth.types";
import { AUTH_CONTEXT } from "../../common/auth.types";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { PrismaService } from "../../prisma/prisma.service";
import { GatewayCommandAdapterRegistry } from "./adapters/gateway-command-adapters";
import type {
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
          assignmentId: true,
          appliedAt: true,
          failureReason: true,
          node: { select: { number: true } },
        },
      },
    },
  },
} satisfies Prisma.GatewayCommandSelect;

type SelectedGatewayCommand = Prisma.GatewayCommandGetPayload<{
  select: typeof gatewayCommandSelect;
}>;

@Injectable()
export class GatewayCommandsService {
  private readonly env = loadApiEnv();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
    @Inject(GatewayCommandAdapterRegistry) private readonly adapters: GatewayCommandAdapterRegistry,
  ) {}

  listCommands(status?: GatewayCommandStatus, gatewayId?: string) {
    return this.prisma.gatewayCommand.findMany({
      orderBy: { createdAt: "desc" },
      select: gatewayCommandSelect,
      where: { gatewayId, status },
    });
  }

  async getCommand(commandId: string) {
    return this.getCommandOrThrow(commandId, this.prisma);
  }

  async createRegisterNodesCommand(actor: AuthTokenPayload, dto: RegisterNodesCommandDto) {
    return this.prisma.$transaction(async (tx) => {
      const gateway = await this.getGatewayProvisioningContext(dto.gatewayId, dto.buildingId, tx);
      const nodeType = await this.getNodeTypeOrThrow(dto.nodeTypeId, tx);
      const nodes = await this.getNodesForGatewayCommand(dto.nodeIds, gateway.companyId, tx);
      if (nodes.some((node) => node.nodeTypeId !== nodeType.id)) {
        throw new BadRequestException("All nodes must use the selected node type.");
      }
      if (nodes.some((node) => node.gatewayAssignments.length > 0)) {
        throw new ConflictException("Selected nodes must be unassigned before provisioning.");
      }
      const built = this.adapters.buildRegisterNodes({
        gatewaySerial: gateway.serialNumber,
        nodeNumbers: nodes.map((node) => node.number),
        nodeTypeNumericCode: nodeType.numericCode,
      });
      const expiresAt = new Date(
        Date.now() + (dto.expiresInSeconds ?? this.env.MQTT_COMMAND_EXPIRES_IN_SECONDS) * 1000,
      );
      const requesterType =
        actor.context === AUTH_CONTEXT.gssAdmin
          ? AuditActorType.GSS_ADMIN
          : AuditActorType.COMPANY_USER;
      const command = await tx.gatewayCommand.create({
        data: {
          commandNumber: built.commandNumber,
          commandType: built.commandType,
          correlationKey: `${gateway.serialNumber}:${built.commandNumber}`,
          expiresAt,
          gatewayId: gateway.id,
          maxAttempts: this.env.MQTT_MAX_PUBLISH_ATTEMPTS,
          payload: built.payload as Prisma.InputJsonObject,
          requesterId: actor.sub,
          requesterType,
          topic: built.topic,
        },
        select: gatewayCommandSelect,
      });
      const request = await tx.nodeGatewayProvisioningRequest.create({
        data: {
          buildingId: gateway.buildingId,
          commandId: command.id,
          companyId: gateway.companyId,
          gatewayId: gateway.id,
          items: { createMany: { data: nodes.map((node) => ({ nodeId: node.id })) } },
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
          newValue: request,
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
      const command = await tx.gatewayCommand.update({
        where: { id: commandId },
        data: {
          attemptCount: { increment: 1 },
          failureReason: null,
          lastAttemptAt: now,
          sentAt: now,
          status: GatewayCommandStatus.SENT,
        },
        select: gatewayCommandSelect,
      });
      await tx.nodeGatewayProvisioningRequest.updateMany({
        where: { commandId },
        data: { failureReason: null, status: GatewayCommandStatus.SENT },
      });
      return command;
    });
  }

  async markFailed(commandId: string, reason: string) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const command = await tx.gatewayCommand.update({
        where: { id: commandId },
        data: { failedAt: now, failureReason: reason, status: GatewayCommandStatus.FAILED },
        select: gatewayCommandSelect,
      });
      await tx.nodeGatewayProvisioningRequest.updateMany({
        where: { commandId },
        data: { failedAt: now, failureReason: reason, status: GatewayCommandStatus.FAILED },
      });
      await tx.nodeGatewayProvisioningItem.updateMany({
        where: { request: { commandId } },
        data: { failureReason: reason },
      });
      return command;
    });
  }

  async acknowledgeSentCommand(
    gatewaySerial: string,
    commandNumber: number,
    responsePayload: Prisma.InputJsonValue,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const command = await this.findSentCommand(gatewaySerial, commandNumber, tx);
      if (!command) {
        return null;
      }
      if (command.commandType === "REGISTER_NODES") {
        const failureReason = await this.validateProvisioningApply(command.id, tx);
        if (failureReason) {
          return this.failSentCommand(command, responsePayload, failureReason, tx);
        }
      }
      const acknowledged = await tx.gatewayCommand.update({
        where: { id: command.id },
        data: {
          acknowledgedAt: new Date(),
          activeKey: command.id,
          responsePayload,
          status: GatewayCommandStatus.ACKNOWLEDGED,
        },
        select: gatewayCommandSelect,
      });
      if (command.commandType === "REGISTER_NODES") {
        await this.applyProvisioningRequest(command.id, responsePayload, tx);
      }
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
      return this.getCommandOrThrow(command.id, tx);
    });
  }

  async failSentGatewayResponse(
    gatewaySerial: string,
    commandNumber: number,
    responsePayload: Prisma.InputJsonValue,
    reason: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const command = await this.findSentCommand(gatewaySerial, commandNumber, tx);
      if (!command) {
        return null;
      }
      return this.failSentCommand(command, responsePayload, reason, tx);
    });
  }

  async retryCommand(actor: AuthTokenPayload, commandId: string) {
    return this.prisma.$transaction(async (tx) => {
      const command = await this.getCommandOrThrow(commandId, tx);
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
          in: [
            GatewayCommandStatus.PENDING,
            GatewayCommandStatus.SENT,
            GatewayCommandStatus.FAILED,
          ],
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

  private async findSentCommand(
    gatewaySerial: string,
    commandNumber: number,
    executor: PrismaExecutor,
  ) {
    return executor.gatewayCommand.findFirst({
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

  private async failSentCommand(
    command: SelectedGatewayCommand,
    responsePayload: Prisma.InputJsonValue,
    reason: string,
    tx: Prisma.TransactionClient,
  ) {
    const now = new Date();
    const failed = await tx.gatewayCommand.update({
      where: { id: command.id },
      data: {
        failedAt: now,
        failureReason: reason,
        responsePayload,
        status: GatewayCommandStatus.FAILED,
      },
      select: gatewayCommandSelect,
    });
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
      where: { id: { in: nodeIds } },
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
  ) {
    const request = await tx.nodeGatewayProvisioningRequest.findUnique({
      where: { commandId },
      include: { items: true },
    });
    if (!request || request.status === GatewayCommandStatus.ACKNOWLEDGED) {
      return;
    }
    const now = new Date();
    const appliedAssignments: Array<{ gatewayId: string; id: string; nodeId: string }> = [];
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
          itemCount: applied.items.length,
        },
        oldValue: request,
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
      gateway: { companyId: string; id: string; serialNumber: string },
    ) => Promise<{
      commandNumber: number;
      commandType: GatewayCommandType;
      payload: Record<string, unknown>;
      topic: string;
    }>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const gateway = await this.getGatewayCommandContext(gatewayId, tx);
      const built = await build(tx, gateway);
      const expiresAt = new Date(
        Date.now() + (expiresInSeconds ?? this.env.MQTT_COMMAND_EXPIRES_IN_SECONDS) * 1000,
      );
      const command = await tx.gatewayCommand.create({
        data: {
          commandNumber: built.commandNumber,
          commandType: built.commandType,
          correlationKey: `${gateway.serialNumber}:${built.commandNumber}`,
          expiresAt,
          gatewayId,
          maxAttempts: this.env.MQTT_MAX_PUBLISH_ATTEMPTS,
          payload: built.payload as Prisma.InputJsonObject,
          requesterId: actor.sub,
          requesterType:
            actor.context === AUTH_CONTEXT.gssAdmin
              ? AuditActorType.GSS_ADMIN
              : AuditActorType.COMPANY_USER,
          topic: built.topic,
        },
        select: gatewayCommandSelect,
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
      return command;
    });
  }

  private async getGatewayCommandContext(gatewayId: string, executor: PrismaExecutor) {
    const gateway = await executor.gateway.findUnique({
      where: { id: gatewayId },
      select: {
        id: true,
        serialNumber: true,
        companyAssignments: {
          where: { status: AssignmentStatus.ACTIVE },
          select: { companyId: true },
          take: 1,
        },
      },
    });
    if (!gateway) {
      throw new NotFoundException("The gateway was not found.");
    }
    const companyId = gateway.companyAssignments[0]?.companyId;
    if (!companyId) {
      throw new BadRequestException("Gateway must be assigned to a company before commands.");
    }
    return { companyId, id: gateway.id, serialNumber: gateway.serialNumber };
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
        companyAssignments: {
          where: { status: AssignmentStatus.ACTIVE },
          select: { companyId: true },
          take: 1,
        },
        buildingAssignments: {
          where: { status: AssignmentStatus.ACTIVE },
          select: {
            buildingId: true,
            building: { select: { companyId: true, id: true } },
          },
          take: 1,
        },
      },
    });
    if (!gateway) {
      throw new NotFoundException("The gateway was not found.");
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
    return { buildingId, companyId, id: gateway.id, serialNumber: gateway.serialNumber };
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
    executor: PrismaExecutor,
  ) {
    const nodes = await executor.node.findMany({
      where: {
        id: { in: nodeIds },
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
    if (nodes.length !== new Set(nodeIds).size) {
      throw new BadRequestException("All nodes must exist and belong to the gateway company.");
    }
    return nodes;
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

  private systemActor(): AuthTokenPayload {
    return {
      aud: AUTH_CONTEXT.gssAdmin,
      context: AUTH_CONTEXT.gssAdmin,
      sub: "00000000-0000-0000-0000-000000000000",
      tokenVersion: 0,
    };
  }
}
