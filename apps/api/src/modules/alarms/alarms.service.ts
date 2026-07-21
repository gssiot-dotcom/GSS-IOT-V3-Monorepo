import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AssignmentStatus,
  AlarmEventStatus,
  AlarmNotificationStatus,
  AlarmResolutionReason,
  AlarmTargetType,
  AuditActorType,
  SensorReadingStatus,
} from "@prisma/client";
import type { AlarmChannel, Prisma } from "@prisma/client";

import type { AuthTokenPayload } from "../../common/auth.types";
import { AUTH_CONTEXT } from "../../common/auth.types";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { PermissionResolverService } from "../rbac/permission-resolver.service";
import { AlarmNotificationDispatchService } from "./alarm-notification-dispatch.service";
import { AlarmOccurrenceEvaluatorService } from "./alarm-occurrence-evaluator.service";
import { AlarmRealtimeService } from "./alarm-realtime.service";
import type {
  CreateAlarmRecipientPolicyDto,
  CreateAlarmRuleDto,
  ListAlarmsQueryDto,
  UpdateAlarmRecipientPolicyDto,
  UpdateAlarmRuleDto,
} from "./dto/alarms.dto";

const ruleInclude = {
  building: { select: { areaId: true, companyId: true, id: true, title: true } },
  nodeType: { select: { displayName: true, id: true, key: true, numericCode: true } },
  recipientPolicies: true,
} satisfies Prisma.AlarmRuleInclude;

@Injectable()
export class AlarmsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
    @Inject(PermissionResolverService) private readonly permissions: PermissionResolverService,
    @Inject(AlarmNotificationDispatchService)
    private readonly notificationDispatch: AlarmNotificationDispatchService,
    @Inject(AlarmRealtimeService) private readonly realtime: AlarmRealtimeService,
    @Inject(AlarmOccurrenceEvaluatorService)
    private readonly evaluator: AlarmOccurrenceEvaluatorService,
  ) {}

  async listRules(auth: AuthTokenPayload, query: { buildingId?: string }) {
    await this.assertPermission(auth, "alarm-rules.view");
    const where: Prisma.AlarmRuleWhereInput = query.buildingId
      ? { buildingId: query.buildingId }
      : {};
    if (auth.context === AUTH_CONTEXT.companyUser) {
      const scope = await this.companyScope(auth.sub);
      where.companyId = scope.companyId;
      where.buildingId = query.buildingId
        ? query.buildingId
        : { in: await this.accessibleBuildingIds(scope) };
      if (query.buildingId && !(await this.hasBuildingScope(scope, query.buildingId))) {
        throw new ForbiddenException("The requested alarm rule scope is not assigned.");
      }
    }
    const rules = await this.prisma.alarmRule.findMany({
      include: ruleInclude,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      where,
    });
    return { items: rules.map((rule) => this.mapRule(rule)) };
  }

  async getRule(auth: AuthTokenPayload, ruleId: string) {
    await this.assertPermission(auth, "alarm-rules.view");
    const rule = await this.getRuleOrThrow(ruleId);
    await this.assertRuleScope(auth, rule);
    return this.mapRule(rule);
  }

  async getRuleOptions(auth: AuthTokenPayload) {
    await this.assertPermission(auth, "alarm-rules.view");
    const nodeTypes = await this.prisma.nodeType.findMany({ orderBy: { numericCode: "asc" } });
    if (auth.context === AUTH_CONTEXT.gssAdmin) {
      const [buildings, positions, users] = await Promise.all([
        this.prisma.constructionBuilding.findMany({
          include: { area: true, company: true },
          orderBy: [{ companyId: "asc" }, { title: "asc" }],
        }),
        this.prisma.companyPosition.findMany({ orderBy: [{ companyId: "asc" }, { name: "asc" }] }),
        this.prisma.companyUser.findMany({
          orderBy: [{ companyId: "asc" }, { name: "asc" }],
          where: { isActive: true },
        }),
      ]);
      return { buildings, nodeTypes, positions, users };
    }
    const scope = await this.companyScope(auth.sub);
    const buildingIds = await this.accessibleBuildingIds(scope);
    const [buildings, positions, users] = await Promise.all([
      this.prisma.constructionBuilding.findMany({
        include: { area: true, company: true },
        orderBy: { title: "asc" },
        where: { companyId: scope.companyId, id: { in: buildingIds } },
      }),
      this.prisma.companyPosition.findMany({
        orderBy: { name: "asc" },
        where: { companyId: scope.companyId, isActive: true },
      }),
      this.prisma.companyUser.findMany({
        orderBy: { name: "asc" },
        where: { companyId: scope.companyId, isActive: true },
      }),
    ]);
    return { buildings, nodeTypes, positions, users };
  }

  async createRule(auth: AuthTokenPayload, dto: CreateAlarmRuleDto) {
    await this.assertPermission(auth, "alarm-rules.manage");
    const building = await this.getBuildingForMutation(auth, dto.buildingId);
    await this.getNodeTypeOrThrow(dto.nodeTypeId);
    const actorType = this.actorType(auth);
    const name = this.normalizeRuleName(dto.name);
    const rule = await this.prisma.alarmRule.create({
      data: {
        areaId: building.areaId,
        buildingId: building.id,
        companyId: building.companyId,
        createdById: auth.sub,
        createdByType: actorType,
        name,
        nodeTypeId: dto.nodeTypeId,
        severity: dto.severity,
        updatedById: auth.sub,
        updatedByType: actorType,
      },
      include: ruleInclude,
    });
    await this.auditLog.record(auth, {
      action: "alarm-rule.create",
      entityId: rule.id,
      entityType: "AlarmRule",
      newValue: rule,
    });
    return this.mapRule(rule);
  }

  async updateRule(auth: AuthTokenPayload, ruleId: string, dto: UpdateAlarmRuleDto) {
    await this.assertPermission(auth, "alarm-rules.manage");
    const current = await this.getRuleOrThrow(ruleId);
    await this.assertRuleScope(auth, current);
    if (!current.isActive) {
      throw new BadRequestException("Disabled alarm rules cannot be updated.");
    }
    const material = dto.severity !== undefined && dto.severity !== current.severity;
    const name = dto.name === undefined ? undefined : this.normalizeRuleName(dto.name);
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.alarmRule.update({
        data: {
          evaluationVersion: material ? { increment: 1 } : undefined,
          name,
          severity: dto.severity,
          updatedById: auth.sub,
          updatedByType: this.actorType(auth),
        },
        include: ruleInclude,
        where: { id: ruleId },
      });
      if (material) {
        await tx.alarmCounterState.updateMany({
          data: { currentCount: 0, status: "RESET", version: { increment: 1 } },
          where: { ruleId },
        });
      }
      await this.auditLog.record(
        auth,
        {
          action: "alarm-rule.update",
          entityId: ruleId,
          entityType: "AlarmRule",
          newValue: saved,
          oldValue: current,
        },
        tx,
      );
      return saved;
    });
    if (material) {
      await this.evaluator.resetRuleStates(ruleId, AlarmResolutionReason.CONFIGURATION_CHANGED);
    }
    return this.mapRule(updated);
  }

  async disableRule(auth: AuthTokenPayload, ruleId: string) {
    await this.assertPermission(auth, "alarm-rules.manage");
    const current = await this.getRuleOrThrow(ruleId);
    await this.assertRuleScope(auth, current);
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.alarmRule.update({
        data: {
          activeKey: ruleId,
          disabledAt: new Date(),
          isActive: false,
          updatedById: auth.sub,
          updatedByType: this.actorType(auth),
        },
        include: ruleInclude,
        where: { id: ruleId },
      });
      await tx.alarmCounterState.updateMany({
        data: { currentCount: 0, status: "RESET", version: { increment: 1 } },
        where: { ruleId },
      });
      await this.auditLog.record(
        auth,
        {
          action: "alarm-rule.disable",
          entityId: ruleId,
          entityType: "AlarmRule",
          newValue: saved,
          oldValue: current,
        },
        tx,
      );
      return saved;
    });
    await this.evaluator.resetRuleStates(ruleId, AlarmResolutionReason.RULE_DISABLED);
    return this.mapRule(updated);
  }

  async listPolicies(auth: AuthTokenPayload, ruleId: string) {
    const rule = await this.getRuleOrThrow(ruleId);
    await this.assertRuleScope(auth, rule);
    await this.assertPermission(auth, "alarm-rules.view");
    const policies = await this.prisma.alarmRecipientPolicy.findMany({
      orderBy: { createdAt: "asc" },
      where: { ruleId },
    });
    return { items: policies.map((policy) => this.mapPolicy(policy)) };
  }

  async createPolicy(auth: AuthTokenPayload, ruleId: string, dto: CreateAlarmRecipientPolicyDto) {
    await this.assertPermission(auth, "alarm-rules.manage");
    const rule = await this.getRuleOrThrow(ruleId);
    await this.assertRuleScope(auth, rule);
    const target = await this.validateTarget(rule.companyId, dto);
    const actorType = this.actorType(auth);
    const policy = await this.prisma.alarmRecipientPolicy.create({
      data: {
        channel: dto.channel,
        channelKey: this.channelKey(dto.channel),
        channelMetadata: (dto.channelMetadata ?? {}) as Prisma.InputJsonValue,
        countIntervalSeconds: dto.countIntervalSeconds,
        createdById: auth.sub,
        createdByType: actorType,
        positionId: target.positionId,
        requiredOccurrenceCount: dto.requiredOccurrenceCount,
        ruleId,
        specificUserId: target.specificUserId,
        targetKey: target.targetKey,
        targetType: dto.targetType,
        updatedById: auth.sub,
        updatedByType: actorType,
      },
    });
    await this.auditLog.record(auth, {
      action: "alarm-recipient-policy.create",
      entityId: policy.id,
      entityType: "AlarmRecipientPolicy",
      newValue: policy,
    });
    return this.mapPolicy(policy);
  }

  async updatePolicy(auth: AuthTokenPayload, policyId: string, dto: UpdateAlarmRecipientPolicyDto) {
    await this.assertPermission(auth, "alarm-rules.manage");
    const current = await this.getPolicyOrThrow(policyId);
    const rule = await this.getRuleOrThrow(current.ruleId);
    await this.assertRuleScope(auth, rule);
    const targetType = dto.targetType ?? current.targetType;
    const merged = {
      channel: dto.channel ?? current.channel,
      countIntervalSeconds: dto.countIntervalSeconds ?? current.countIntervalSeconds,
      positionId:
        targetType === AlarmTargetType.POSITION
          ? (dto.positionId ?? current.positionId ?? undefined)
          : undefined,
      requiredOccurrenceCount: dto.requiredOccurrenceCount ?? current.requiredOccurrenceCount,
      specificUserId:
        targetType === AlarmTargetType.SPECIFIC_USER
          ? (dto.specificUserId ?? current.specificUserId ?? undefined)
          : undefined,
      targetType,
    };
    const target = await this.validateTarget(rule.companyId, merged);
    const material =
      merged.channel !== current.channel ||
      merged.countIntervalSeconds !== current.countIntervalSeconds ||
      merged.positionId !== current.positionId ||
      merged.requiredOccurrenceCount !== current.requiredOccurrenceCount ||
      merged.specificUserId !== current.specificUserId ||
      merged.targetType !== current.targetType ||
      dto.channelMetadata !== undefined;
    const policy = await this.prisma.alarmRecipientPolicy.update({
      data: {
        channel: merged.channel,
        channelKey: this.channelKey(merged.channel),
        channelMetadata:
          dto.channelMetadata === undefined
            ? undefined
            : (dto.channelMetadata as Prisma.InputJsonValue),
        countIntervalSeconds: merged.countIntervalSeconds,
        evaluationVersion: material ? { increment: 1 } : undefined,
        positionId: target.positionId,
        requiredOccurrenceCount: merged.requiredOccurrenceCount,
        specificUserId: target.specificUserId,
        targetKey: target.targetKey,
        targetType: merged.targetType,
        updatedById: auth.sub,
        updatedByType: this.actorType(auth),
      },
      where: { id: policyId },
    });
    if (material) {
      await this.evaluator.resetPolicyStates(policyId, AlarmResolutionReason.CONFIGURATION_CHANGED);
    }
    await this.auditLog.record(auth, {
      action: "alarm-recipient-policy.update",
      entityId: policy.id,
      entityType: "AlarmRecipientPolicy",
      newValue: policy,
      oldValue: current,
    });
    return this.mapPolicy(policy);
  }

  async disablePolicy(auth: AuthTokenPayload, policyId: string) {
    await this.assertPermission(auth, "alarm-rules.manage");
    const current = await this.getPolicyOrThrow(policyId);
    const rule = await this.getRuleOrThrow(current.ruleId);
    await this.assertRuleScope(auth, rule);
    const policy = await this.prisma.alarmRecipientPolicy.update({
      data: {
        activeKey: policyId,
        disabledAt: new Date(),
        isActive: false,
        updatedById: auth.sub,
        updatedByType: this.actorType(auth),
      },
      where: { id: policyId },
    });
    await this.evaluator.resetPolicyStates(policyId, AlarmResolutionReason.POLICY_DISABLED);
    await this.auditLog.record(auth, {
      action: "alarm-recipient-policy.disable",
      entityId: policy.id,
      entityType: "AlarmRecipientPolicy",
      newValue: policy,
      oldValue: current,
    });
    return this.mapPolicy(policy);
  }

  async listCounters(auth: AuthTokenPayload, query: { buildingId?: string }) {
    await this.assertPermission(auth, "alarms.view");
    const where = await this.alarmReadRuleWhere(auth, query.buildingId);
    const items = await this.prisma.alarmCounterState.findMany({
      include: { node: { select: { id: true, number: true } }, policy: true, rule: true },
      orderBy: [{ updatedAt: "desc" }],
      take: 100,
      where: { rule: where },
    });
    return { items };
  }

  async listEvents(auth: AuthTokenPayload, query: { buildingId?: string }) {
    await this.assertPermission(auth, "alarms.view");
    const where = await this.alarmReadEventWhere(auth, query.buildingId);
    const items = await this.prisma.alarmEvent.findMany({
      orderBy: [{ openedAt: "desc" }],
      take: 100,
      where,
    });
    return { items };
  }

  async listTriggers(auth: AuthTokenPayload, query: { buildingId?: string }) {
    await this.assertPermission(auth, "alarms.view");
    const where = await this.alarmReadRuleWhere(auth, query.buildingId);
    const items = await this.prisma.alarmPolicyTrigger.findMany({
      include: { alarmEvent: true, policy: true, rule: true },
      orderBy: [{ triggeredAt: "desc" }],
      take: 100,
      where: { rule: where },
    });
    return { items };
  }

  async listAlarms(auth: AuthTokenPayload, query: ListAlarmsQueryDto) {
    await this.assertPermission(auth, "alarms.view");
    const where = await this.alarmReadEventWhere(auth, query.buildingId);
    if (query.severity) where.severity = query.severity;
    if (query.status) where.status = query.status;
    const items = await this.prisma.alarmEvent.findMany({
      include: this.eventListInclude(),
      orderBy: [{ openedAt: "desc" }],
      take: 100,
      where,
    });
    return { items: items.map((event) => this.mapEvent(event)) };
  }

  async getAlarm(auth: AuthTokenPayload, alarmEventId: string) {
    await this.assertPermission(auth, "alarms.view");
    const event = await this.prisma.alarmEvent.findUnique({
      include: {
        ...this.eventListInclude(),
        notifications: {
          include: { deliveryLogs: { orderBy: { attemptNumber: "asc" } }, recipientUser: true },
          orderBy: { createdAt: "asc" },
        },
        policyTriggers: { include: { policy: true }, orderBy: { triggeredAt: "asc" } },
      },
      where: { id: alarmEventId },
    });
    if (!event) throw new NotFoundException("The alarm event was not found.");
    await this.assertEventScope(auth, event);
    return this.mapEvent(event);
  }

  async listAlarmTriggers(auth: AuthTokenPayload, alarmEventId: string) {
    const event = await this.getEventForAction(auth, alarmEventId, "alarms.view");
    const items = await this.prisma.alarmPolicyTrigger.findMany({
      include: { policy: true },
      orderBy: { triggeredAt: "asc" },
      where: { alarmEventId: event.id },
    });
    return { items };
  }

  async listAlarmNotifications(auth: AuthTokenPayload, alarmEventId: string) {
    const event = await this.getEventForAction(auth, alarmEventId, "alarms.view");
    const items = await this.prisma.alarmNotification.findMany({
      include: { deliveryLogs: { orderBy: { attemptNumber: "asc" } }, recipientUser: true },
      orderBy: { createdAt: "asc" },
      where: { alarmEventId: event.id },
    });
    return { items: items.map((item) => this.mapNotification(item)) };
  }

  async acknowledgeAlarm(auth: AuthTokenPayload, alarmEventId: string, note?: string) {
    const event = await this.getEventForAction(auth, alarmEventId, "alarms.acknowledge");
    if (event.status === AlarmEventStatus.RESOLVED) {
      return this.getAlarm(auth, event.id);
    }
    if (event.status === AlarmEventStatus.ACKNOWLEDGED) {
      return this.getAlarm(auth, event.id);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.alarmEvent.update({
        data: {
          acknowledgeNote: note,
          acknowledgedAt: new Date(),
          acknowledgedById: auth.sub,
          acknowledgedByType: this.actorType(auth),
          status: AlarmEventStatus.ACKNOWLEDGED,
        },
        where: { id: alarmEventId },
      });
      await this.auditLog.record(
        auth,
        {
          action: "alarm-event.acknowledge",
          entityId: alarmEventId,
          entityType: "AlarmEvent",
          newValue: saved,
          oldValue: event,
        },
        tx,
      );
      return saved;
    });
    this.realtime.emitToPrincipal(auth, "alarms:acknowledged", { alarmEventId: updated.id });
    return this.getAlarm(auth, updated.id);
  }

  async resolveAlarm(auth: AuthTokenPayload, alarmEventId: string, note?: string) {
    const event = await this.getEventForAction(auth, alarmEventId, "alarms.resolve");
    if (event.status === AlarmEventStatus.RESOLVED) {
      return this.getAlarm(auth, event.id);
    }
    if (await this.isLatestStateStillUnsafe(event)) {
      throw new ConflictException(
        "The alarm cannot be manually resolved while the latest state is unsafe.",
      );
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.alarmEvent.update({
        data: {
          activeKey: alarmEventId,
          resolutionReason: AlarmResolutionReason.MANUAL_RESOLVE,
          resolvedAt: new Date(),
          resolvedById: auth.sub,
          resolvedByType: this.actorType(auth),
          resolveNote: note,
          status: AlarmEventStatus.RESOLVED,
        },
        where: { id: alarmEventId },
      });
      await this.auditLog.record(
        auth,
        {
          action: "alarm-event.resolve",
          entityId: alarmEventId,
          entityType: "AlarmEvent",
          newValue: saved,
          oldValue: event,
        },
        tx,
      );
      return saved;
    });
    this.realtime.emitToPrincipal(auth, "alarms:resolved", { alarmEventId: updated.id });
    return this.getAlarm(auth, updated.id);
  }

  async listNotifications(auth: AuthTokenPayload) {
    await this.assertPermission(auth, "notifications.view");
    if (auth.context === AUTH_CONTEXT.gssAdmin) {
      return { items: [] };
    }
    const items = await this.prisma.alarmNotification.findMany({
      include: { alarmEvent: { include: { building: true, node: true, nodeType: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
      where: { recipientUserId: auth.sub },
    });
    return { items: items.map((item) => this.mapNotification(item)) };
  }

  async unreadNotificationCount(auth: AuthTokenPayload) {
    await this.assertPermission(auth, "notifications.view");
    if (auth.context === AUTH_CONTEXT.gssAdmin) {
      return { unreadCount: 0 };
    }
    const unreadCount = await this.prisma.alarmNotification.count({
      where: {
        readAt: null,
        recipientUserId: auth.sub,
        status: AlarmNotificationStatus.SENT,
      },
    });
    return { unreadCount };
  }

  async markNotificationRead(auth: AuthTokenPayload, notificationId: string) {
    await this.assertPermission(auth, "notifications.view");
    if (auth.context === AUTH_CONTEXT.gssAdmin) {
      throw new NotFoundException("The notification was not found.");
    }
    const notification = await this.prisma.alarmNotification.findFirst({
      where: { id: notificationId, recipientUserId: auth.sub },
    });
    if (!notification) throw new NotFoundException("The notification was not found.");
    const updated = await this.prisma.alarmNotification.update({
      data: { readAt: notification.readAt ?? new Date() },
      where: { id: notification.id },
    });
    const { unreadCount } = await this.unreadNotificationCount(auth);
    this.realtime.emitToPrincipal(auth, "notifications:update", {
      notificationId,
      unreadCount,
    });
    return this.mapNotification(updated);
  }

  async markAllNotificationsRead(auth: AuthTokenPayload) {
    await this.assertPermission(auth, "notifications.view");
    if (auth.context === AUTH_CONTEXT.companyUser) {
      await this.prisma.alarmNotification.updateMany({
        data: { readAt: new Date() },
        where: {
          readAt: null,
          recipientUserId: auth.sub,
          status: AlarmNotificationStatus.SENT,
        },
      });
    }
    this.realtime.emitToPrincipal(auth, "notifications:update", { unreadCount: 0 });
    return { unreadCount: 0 };
  }

  providersStatus(auth: AuthTokenPayload) {
    return this.assertPermission(auth, "notifications.manage").then(() =>
      this.notificationDispatch.providerStatuses(),
    );
  }

  private eventListInclude() {
    return {
      building: { select: { id: true, title: true } },
      node: { select: { id: true, number: true } },
      nodeType: { select: { displayName: true, id: true, key: true, numericCode: true } },
      rule: { select: { id: true, name: true, severity: true } },
    } satisfies Prisma.AlarmEventInclude;
  }

  private async getEventForAction(
    auth: AuthTokenPayload,
    alarmEventId: string,
    permission: string,
  ) {
    await this.assertPermission(auth, permission);
    const event = await this.prisma.alarmEvent.findUnique({ where: { id: alarmEventId } });
    if (!event) throw new NotFoundException("The alarm event was not found.");
    await this.assertEventScope(auth, event);
    return event;
  }

  private async assertEventScope(
    auth: AuthTokenPayload,
    event: { buildingId: string; companyId: string },
  ): Promise<void> {
    if (auth.context === AUTH_CONTEXT.gssAdmin) return;
    const scope = await this.companyScope(auth.sub);
    if (
      event.companyId !== scope.companyId ||
      !(await this.hasBuildingScope(scope, event.buildingId))
    ) {
      throw new ForbiddenException("The requested alarm event is outside the assigned scope.");
    }
  }

  private async isLatestStateStillUnsafe(event: {
    buildingId: string;
    gatewayId: string;
    nodeId: string;
    nodeTypeId: string;
  }): Promise<boolean> {
    const latest = await this.prisma.latestNodeState.findUnique({
      where: { nodeId: event.nodeId },
    });
    if (!latest) return false;
    if (latest.faultFiltered) return false;
    const unsafeStatuses: SensorReadingStatus[] = [
      SensorReadingStatus.CAUTION,
      SensorReadingStatus.WARNING,
      SensorReadingStatus.DANGER,
    ];
    const unsafe = unsafeStatuses.includes(latest.status);
    if (!unsafe) return false;
    const [nodeCompany, nodeGateway, gatewayBuilding, application] = await Promise.all([
      this.prisma.companyDeviceAssignment.findFirst({
        where: { activeKey: "active", nodeId: event.nodeId, status: AssignmentStatus.ACTIVE },
      }),
      this.prisma.nodeGatewayAssignment.findFirst({
        where: {
          activeKey: "active",
          gatewayId: event.gatewayId,
          nodeId: event.nodeId,
          status: AssignmentStatus.ACTIVE,
        },
      }),
      this.prisma.gatewayBuildingAssignment.findFirst({
        where: {
          activeKey: "active",
          buildingId: event.buildingId,
          gatewayId: event.gatewayId,
          status: AssignmentStatus.ACTIVE,
        },
      }),
      this.prisma.gatewayAlarmLevelApplication.findUnique({
        where: {
          buildingId_gatewayId_nodeTypeId: {
            buildingId: event.buildingId,
            gatewayId: event.gatewayId,
            nodeTypeId: event.nodeTypeId,
          },
        },
      }),
    ]);
    if (!nodeCompany || !nodeGateway || !gatewayBuilding) return false;
    if (application?.desiredEnabled === false) return false;
    return true;
  }

  private mapEvent(event: {
    acknowledgedAt?: Date | null;
    createdAt: Date;
    disabledAt?: Date | null;
    lastTriggeredAt: Date;
    notifications?: unknown[];
    openedAt: Date;
    policyTriggers?: unknown[];
    resolvedAt?: Date | null;
    updatedAt: Date;
    [key: string]: unknown;
  }) {
    return {
      ...event,
      acknowledgedAt: event.acknowledgedAt?.toISOString() ?? null,
      createdAt: event.createdAt.toISOString(),
      lastTriggeredAt: event.lastTriggeredAt.toISOString(),
      openedAt: event.openedAt.toISOString(),
      resolvedAt: event.resolvedAt?.toISOString() ?? null,
      updatedAt: event.updatedAt.toISOString(),
    };
  }

  private mapNotification(notification: {
    createdAt: Date;
    lastAttemptAt?: Date | null;
    nextAttemptAt?: Date | null;
    readAt?: Date | null;
    sentAt?: Date | null;
    updatedAt: Date;
    [key: string]: unknown;
  }) {
    return {
      ...notification,
      createdAt: notification.createdAt.toISOString(),
      lastAttemptAt: notification.lastAttemptAt?.toISOString() ?? null,
      nextAttemptAt: notification.nextAttemptAt?.toISOString() ?? null,
      readAt: notification.readAt?.toISOString() ?? null,
      sentAt: notification.sentAt?.toISOString() ?? null,
      updatedAt: notification.updatedAt.toISOString(),
    };
  }

  private async alarmReadRuleWhere(auth: AuthTokenPayload, buildingId?: string) {
    const where: Prisma.AlarmRuleWhereInput = buildingId ? { buildingId } : {};
    if (auth.context === AUTH_CONTEXT.companyUser) {
      const scope = await this.companyScope(auth.sub);
      where.companyId = scope.companyId;
      where.buildingId = buildingId ? buildingId : { in: await this.accessibleBuildingIds(scope) };
      if (buildingId && !(await this.hasBuildingScope(scope, buildingId))) {
        throw new ForbiddenException("The requested alarm scope is not assigned.");
      }
    }
    return where;
  }

  private async alarmReadEventWhere(auth: AuthTokenPayload, buildingId?: string) {
    const where: Prisma.AlarmEventWhereInput = buildingId ? { buildingId } : {};
    if (auth.context === AUTH_CONTEXT.companyUser) {
      const scope = await this.companyScope(auth.sub);
      where.companyId = scope.companyId;
      where.buildingId = buildingId ? buildingId : { in: await this.accessibleBuildingIds(scope) };
      if (buildingId && !(await this.hasBuildingScope(scope, buildingId))) {
        throw new ForbiddenException("The requested alarm scope is not assigned.");
      }
    }
    return where;
  }

  private async assertPermission(auth: AuthTokenPayload, permission: string): Promise<void> {
    const allowed = await this.permissions.hasPermission(auth.context, auth.sub, permission);
    if (!allowed) {
      throw new ForbiddenException("The alarm permission is missing.");
    }
  }

  private async getBuildingForMutation(auth: AuthTokenPayload, buildingId: string) {
    const building = await this.prisma.constructionBuilding.findUnique({
      where: { id: buildingId },
    });
    if (!building) {
      throw new NotFoundException("The construction building was not found.");
    }
    if (auth.context === AUTH_CONTEXT.gssAdmin) {
      return building;
    }
    const scope = await this.companyScope(auth.sub);
    if (
      building.companyId !== scope.companyId ||
      !(await this.hasBuildingScope(scope, buildingId))
    ) {
      throw new ForbiddenException("The requested building is outside the assigned scope.");
    }
    return building;
  }

  private async assertRuleScope(
    auth: AuthTokenPayload,
    rule: { buildingId: string; companyId: string },
  ): Promise<void> {
    if (auth.context === AUTH_CONTEXT.gssAdmin) return;
    const scope = await this.companyScope(auth.sub);
    if (
      rule.companyId !== scope.companyId ||
      !(await this.hasBuildingScope(scope, rule.buildingId))
    ) {
      throw new ForbiddenException("The requested alarm rule is outside the assigned scope.");
    }
  }

  private async companyScope(userId: string) {
    const user = await this.prisma.companyUser.findUnique({
      include: { role: true },
      where: { id: userId },
    });
    if (!user) throw new ForbiddenException("The company user was not found.");
    return {
      companyId: user.companyId,
      isOwner: user.role.isCompanyOwnerRole,
      userId: user.id,
    };
  }

  private async accessibleBuildingIds(scope: {
    companyId: string;
    isOwner: boolean;
    userId: string;
  }): Promise<string[]> {
    if (scope.isOwner) {
      const buildings = await this.prisma.constructionBuilding.findMany({
        select: { id: true },
        where: { companyId: scope.companyId },
      });
      return buildings.map((building) => building.id);
    }
    const [direct, areas] = await Promise.all([
      this.prisma.companyUserBuildingAccess.findMany({
        select: { buildingId: true },
        where: { companyUserId: scope.userId },
      }),
      this.prisma.companyUserAreaAccess.findMany({
        select: { areaId: true },
        where: { companyUserId: scope.userId },
      }),
    ]);
    const inherited = areas.length
      ? await this.prisma.constructionBuilding.findMany({
          select: { id: true },
          where: { areaId: { in: areas.map((area) => area.areaId) }, companyId: scope.companyId },
        })
      : [];
    return [
      ...new Set([...direct.map((item) => item.buildingId), ...inherited.map((item) => item.id)]),
    ];
  }

  private async hasBuildingScope(
    scope: { companyId: string; isOwner: boolean; userId: string },
    buildingId: string,
  ): Promise<boolean> {
    const building = await this.prisma.constructionBuilding.findUnique({
      where: { id: buildingId },
    });
    if (!building || building.companyId !== scope.companyId) return false;
    if (scope.isOwner) return true;
    const [direct, area] = await Promise.all([
      this.prisma.companyUserBuildingAccess.findUnique({
        where: { companyUserId_buildingId: { buildingId, companyUserId: scope.userId } },
      }),
      this.prisma.companyUserAreaAccess.findUnique({
        where: { companyUserId_areaId: { areaId: building.areaId, companyUserId: scope.userId } },
      }),
    ]);
    return Boolean(direct || area);
  }

  private async validateTarget(
    companyId: string,
    dto: {
      positionId?: string;
      specificUserId?: string;
      targetType: AlarmTargetType;
    },
  ): Promise<{ positionId?: string; specificUserId?: string; targetKey: string }> {
    if (dto.targetType === AlarmTargetType.POSITION) {
      if (!dto.positionId || dto.specificUserId) {
        throw new BadRequestException(
          "A position-targeted alarm policy requires exactly one position.",
        );
      }
      const position = await this.prisma.companyPosition.findUnique({
        where: { id: dto.positionId },
      });
      if (!position || position.companyId !== companyId || !position.isActive) {
        throw new BadRequestException(
          "The alarm recipient position is not active in this company.",
        );
      }
      return { positionId: position.id, targetKey: `position:${position.id}` };
    }
    if (!dto.specificUserId || dto.positionId) {
      throw new BadRequestException("A specific-user alarm policy requires exactly one user.");
    }
    const user = await this.prisma.companyUser.findUnique({ where: { id: dto.specificUserId } });
    if (!user || user.companyId !== companyId) {
      throw new BadRequestException("The alarm recipient user does not belong to this company.");
    }
    return { specificUserId: user.id, targetKey: `user:${user.id}` };
  }

  private getRuleOrThrow(ruleId: string) {
    return this.prisma.alarmRule
      .findUnique({ include: ruleInclude, where: { id: ruleId } })
      .then((rule) => {
        if (!rule) throw new NotFoundException("The alarm rule was not found.");
        return rule;
      });
  }

  private getPolicyOrThrow(policyId: string) {
    return this.prisma.alarmRecipientPolicy
      .findUnique({ where: { id: policyId } })
      .then((policy) => {
        if (!policy) throw new NotFoundException("The alarm recipient policy was not found.");
        return policy;
      });
  }

  private async getNodeTypeOrThrow(nodeTypeId: string): Promise<void> {
    const nodeType = await this.prisma.nodeType.findUnique({ where: { id: nodeTypeId } });
    if (!nodeType) throw new NotFoundException("The node type was not found.");
  }

  private actorType(auth: AuthTokenPayload): AuditActorType {
    return auth.context === AUTH_CONTEXT.gssAdmin
      ? AuditActorType.GSS_ADMIN
      : AuditActorType.COMPANY_USER;
  }

  private channelKey(channel: AlarmChannel): string {
    return channel.toLowerCase();
  }

  private normalizeRuleName(name: string | undefined): string | undefined {
    if (name === undefined) return undefined;
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException("Alarm rule name cannot be empty.");
    if (trimmed.length > 120) throw new BadRequestException("Alarm rule name is too long.");
    return trimmed;
  }

  private mapRule(rule: Prisma.AlarmRuleGetPayload<{ include: typeof ruleInclude }>) {
    return {
      ...rule,
      createdAt: rule.createdAt.toISOString(),
      disabledAt: rule.disabledAt?.toISOString() ?? null,
      recipientPolicies: rule.recipientPolicies.map((policy) => this.mapPolicy(policy)),
      updatedAt: rule.updatedAt.toISOString(),
    };
  }

  private mapPolicy(policy: Prisma.AlarmRecipientPolicyGetPayload<object>) {
    return {
      ...policy,
      createdAt: policy.createdAt.toISOString(),
      disabledAt: policy.disabledAt?.toISOString() ?? null,
      updatedAt: policy.updatedAt.toISOString(),
    };
  }
}
