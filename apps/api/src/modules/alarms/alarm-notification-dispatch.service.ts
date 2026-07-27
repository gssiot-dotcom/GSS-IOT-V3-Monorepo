import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnModuleInit } from "@nestjs/common";
import {
  AlarmChannel,
  AlarmDeliveryAttemptStatus,
  AlarmNotificationStatus,
  AlarmTargetType,
  AlarmTriggerDispatchStatus,
  PositionAssignmentStatus,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { AUTH_CONTEXT } from "../../common/auth.types";
import { PrismaService } from "../../prisma/prisma.service";
import { PermissionResolverService } from "../rbac/permission-resolver.service";
import { AlarmDomainEventsService } from "./alarm-domain-events.service";
import { AlarmRealtimeService } from "./alarm-realtime.service";

type TriggerWithContext = Prisma.AlarmPolicyTriggerGetPayload<{
  include: {
    alarmEvent: { include: { building: true; node: true; nodeType: true } };
    policy: { include: { position: true; specificUser: true } };
    rule: true;
  };
}>;

interface ResolvedRecipient {
  failureCode?: string;
  failureMessage?: string;
  userId: string;
}

@Injectable()
export class AlarmNotificationDispatchService implements OnModuleInit {
  private readonly logger = new Logger(AlarmNotificationDispatchService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PermissionResolverService) private readonly permissions: PermissionResolverService,
    @Inject(AlarmDomainEventsService) private readonly domainEvents: AlarmDomainEventsService,
    @Inject(AlarmRealtimeService) private readonly realtime: AlarmRealtimeService,
  ) {}

  onModuleInit(): void {
    this.domainEvents.onPolicyTriggered((event) => {
      void this.processTrigger(event.triggerId).catch((error) => {
        this.logger.error(`Alarm trigger dispatch failed triggerId=${event.triggerId}`, error);
      });
    });
    setTimeout(() => {
      void this.processPendingTriggers().catch((error) => {
        this.logger.error("Alarm trigger reconciliation failed", error);
      });
    }, 0);
  }

  async processPendingTriggers(limit = 25): Promise<number> {
    const triggers = await this.prisma.alarmPolicyTrigger.findMany({
      orderBy: { triggeredAt: "asc" },
      select: { id: true },
      take: limit,
      where: { dispatchStatus: AlarmTriggerDispatchStatus.PENDING },
    });
    for (const trigger of triggers) {
      await this.processTrigger(trigger.id);
    }
    return triggers.length;
  }

  async processTrigger(triggerId: string): Promise<void> {
    const claimed = await this.prisma.alarmPolicyTrigger.updateMany({
      data: {
        dispatchAttemptCount: { increment: 1 },
        dispatchClaimedAt: new Date(),
        dispatchFailureReason: null,
        dispatchStatus: AlarmTriggerDispatchStatus.PROCESSING,
      },
      where: {
        dispatchStatus: {
          in: [AlarmTriggerDispatchStatus.PENDING, AlarmTriggerDispatchStatus.FAILED],
        },
        id: triggerId,
      },
    });
    if (claimed.count === 0) return;

    try {
      const trigger = await this.getTrigger(triggerId);
      if (!trigger) {
        throw new Error("Alarm policy trigger was not found during dispatch.");
      }
      const recipients = await this.resolveRecipients(trigger);
      if (!recipients.length) {
        await this.prisma.alarmPolicyTrigger.updateMany({
          data: {
            dispatchCompletedAt: new Date(),
            dispatchFailureReason: "NO_RECIPIENT",
            dispatchStatus: AlarmTriggerDispatchStatus.DISPATCHED,
          },
          where: { id: triggerId },
        });
        return;
      }

      for (const recipient of recipients) {
        const notification = await this.createNotification(trigger, recipient);
        if (notification.status === AlarmNotificationStatus.PENDING) {
          await this.deliverNotification(notification.id);
        } else {
          await this.emitBadge(recipient.userId);
        }
      }

      await this.prisma.alarmPolicyTrigger.updateMany({
        data: {
          dispatchCompletedAt: new Date(),
          dispatchFailureReason: null,
          dispatchStatus: AlarmTriggerDispatchStatus.DISPATCHED,
        },
        where: { id: triggerId },
      });
    } catch (error) {
      await this.prisma.alarmPolicyTrigger.updateMany({
        data: {
          dispatchFailureReason: error instanceof Error ? error.message : "Unknown dispatch error.",
          dispatchStatus: AlarmTriggerDispatchStatus.FAILED,
        },
        where: { id: triggerId },
      });
      throw error;
    }
  }

  async deliverNotification(notificationId: string): Promise<void> {
    const now = new Date();
    const claimed = await this.prisma.alarmNotification.updateMany({
      data: { lastAttemptAt: now, status: AlarmNotificationStatus.PROCESSING },
      where: {
        id: notificationId,
        nextAttemptAt: { lte: now },
        status: AlarmNotificationStatus.PENDING,
      },
    });
    if (claimed.count === 0) return;

    const notification = await this.prisma.alarmNotification.findUnique({
      include: { policy: true },
      where: { id: notificationId },
    });
    if (!notification) return;

    const attemptNumber = notification.attemptCount + 1;
    const startedAt = new Date();
    const result = this.providerResult(notification);
    const completedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.alarmDeliveryLog.create({
        data: {
          attemptNumber,
          channel: notification.channel,
          completedAt,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
          notificationId,
          providerKey: result.providerKey,
          retryable: result.retryable,
          sanitizedRequestMetadata: result.requestMetadata as Prisma.InputJsonValue,
          sanitizedResponseMetadata: result.responseMetadata as Prisma.InputJsonValue,
          startedAt,
          status: result.logStatus,
        },
      });

      await tx.alarmNotification.update({
        data: {
          attemptCount: attemptNumber,
          failureCode: result.failureCode,
          failureMessage: result.failureMessage,
          nextAttemptAt: result.nextAttemptAt,
          sentAt: result.sentAt,
          status: result.notificationStatus,
        },
        where: { id: notificationId },
      });
    });

    this.realtime.emitToCompanyUser(notification.recipientUserId, "notifications:update", {
      notificationId,
      unreadCount: await this.unreadCount(notification.recipientUserId),
    });
  }

  providerStatuses() {
    return {
      providers: [
        { channel: AlarmChannel.IN_APP, configured: true, providerKey: "in_app" },
        { channel: AlarmChannel.SMS, configured: false, providerKey: "unconfigured_sms" },
        { channel: AlarmChannel.TELEGRAM, configured: false, providerKey: "unconfigured_telegram" },
        { channel: AlarmChannel.EMAIL, configured: false, providerKey: "unconfigured_email" },
        { channel: AlarmChannel.WEB_PUSH, configured: false, providerKey: "unconfigured_web_push" },
      ],
    };
  }

  private async getTrigger(triggerId: string) {
    return this.prisma.alarmPolicyTrigger.findUnique({
      include: {
        alarmEvent: { include: { building: true, node: true, nodeType: true } },
        policy: { include: { position: true, specificUser: true } },
        rule: true,
      },
      where: { id: triggerId },
    });
  }

  private async resolveRecipients(trigger: TriggerWithContext): Promise<ResolvedRecipient[]> {
    const policy = trigger.policy;
    if (policy.targetType === AlarmTargetType.SPECIFIC_USER) {
      if (!policy.specificUserId || !policy.specificUser?.isActive) return [];
      if (
        policy.specificUser.companyId !== trigger.alarmEvent.companyId ||
        !(await this.userHasBuildingScope(policy.specificUserId, trigger.alarmEvent.buildingId))
      ) {
        return [
          {
            failureCode: "MISSING_ALARM_SCOPE",
            failureMessage: "The specific recipient no longer has effective building scope.",
            userId: policy.specificUserId,
          },
        ];
      }
      return [await this.withInAppPermission(policy.specificUserId, policy.channel)];
    }

    if (!policy.positionId) return [];
    const assignments = await this.prisma.companyUserPositionAssignment.findMany({
      include: { companyUser: true },
      where: {
        endedAt: null,
        positionId: policy.positionId,
        status: PositionAssignmentStatus.ACTIVE,
      },
    });
    const userIds = new Set<string>();
    const recipients: ResolvedRecipient[] = [];
    for (const assignment of assignments) {
      if (!assignment.companyUser.isActive) continue;
      if (assignment.companyUser.companyId !== trigger.alarmEvent.companyId) continue;
      if (!this.assignmentIntersects(assignment, trigger)) continue;
      if (userIds.has(assignment.companyUserId)) continue;
      userIds.add(assignment.companyUserId);
      recipients.push(await this.withInAppPermission(assignment.companyUserId, policy.channel));
    }
    return recipients;
  }

  private async withInAppPermission(
    userId: string,
    channel: AlarmChannel,
  ): Promise<ResolvedRecipient> {
    if (channel !== AlarmChannel.IN_APP) return { userId };
    const allowed = await this.permissions.hasPermission(
      AUTH_CONTEXT.companyUser,
      userId,
      "notifications.view",
    );
    return allowed
      ? { userId }
      : {
          failureCode: "MISSING_NOTIFICATIONS_VIEW",
          failureMessage: "The recipient lacks notifications.view for in-app delivery.",
          userId,
        };
  }

  private assignmentIntersects(
    assignment: { areaId: string | null; buildingId: string | null },
    trigger: TriggerWithContext,
  ): boolean {
    if (assignment.buildingId) {
      return assignment.buildingId === trigger.alarmEvent.buildingId;
    }
    if (assignment.areaId) {
      return assignment.areaId === trigger.alarmEvent.areaId;
    }
    return true;
  }

  private async userHasBuildingScope(userId: string, buildingId: string): Promise<boolean> {
    const user = await this.prisma.companyUser.findUnique({
      include: { role: true },
      where: { id: userId },
    });
    if (!user || !user.isActive) return false;
    if (user.role.isCompanyOwnerRole) return true;
    const building = await this.prisma.constructionBuilding.findUnique({
      where: { id: buildingId },
    });
    if (!building || building.companyId !== user.companyId) return false;
    const [direct, area] = await Promise.all([
      this.prisma.companyUserBuildingAccess.findUnique({
        where: { companyUserId_buildingId: { buildingId, companyUserId: userId } },
      }),
      this.prisma.companyUserAreaAccess.findUnique({
        where: { companyUserId_areaId: { areaId: building.areaId, companyUserId: userId } },
      }),
    ]);
    return Boolean(direct || area);
  }

  private async createNotification(trigger: TriggerWithContext, recipient: ResolvedRecipient) {
    const status = recipient.failureCode
      ? AlarmNotificationStatus.SKIPPED
      : AlarmNotificationStatus.PENDING;
    const title = `${trigger.alarmEvent.severity} alarm`;
    const body = `${trigger.alarmEvent.building.title} node ${trigger.alarmEvent.node.number} reached ${trigger.triggerOccurrenceCount}/${trigger.policy.requiredOccurrenceCount}.`;
    const notification = await this.prisma.alarmNotification.upsert({
      create: {
        alarmEventId: trigger.alarmEventId,
        body,
        channel: trigger.policy.channel,
        destinationMetadata: this.destinationMetadata(trigger.policy.channel),
        failureCode: recipient.failureCode,
        failureMessage: recipient.failureMessage,
        nextAttemptAt: status === AlarmNotificationStatus.PENDING ? new Date() : null,
        policyId: trigger.policyId,
        policyTriggerId: trigger.id,
        recipientUserId: recipient.userId,
        scopeSnapshot: {
          areaId: trigger.alarmEvent.areaId,
          buildingId: trigger.alarmEvent.buildingId,
          companyId: trigger.alarmEvent.companyId,
        },
        severitySnapshot: {
          severity: trigger.alarmEvent.severity,
          status: trigger.alarmEvent.status,
        },
        status,
        templateSnapshot: { key: "alarm.policy.triggered.v1" },
        title,
        triggerSnapshot: {
          countIntervalSeconds: trigger.countIntervalSeconds,
          policyId: trigger.policyId,
          triggerCycleNo: trigger.triggerCycleNo,
          triggerOccurrenceCount: trigger.triggerOccurrenceCount,
          triggeredAt: trigger.triggeredAt.toISOString(),
        },
      },
      update: {},
      where: {
        policyTriggerId_recipientUserId_channel: {
          channel: trigger.policy.channel,
          policyTriggerId: trigger.id,
          recipientUserId: recipient.userId,
        },
      },
    });

    if (status === AlarmNotificationStatus.SKIPPED) {
      await this.prisma.alarmDeliveryLog.create({
        data: {
          attemptNumber: 1,
          channel: trigger.policy.channel,
          completedAt: new Date(),
          errorCode: recipient.failureCode,
          errorMessage: recipient.failureMessage,
          notificationId: notification.id,
          providerKey: "policy_guard",
          retryable: false,
          startedAt: new Date(),
          status: AlarmDeliveryAttemptStatus.SKIPPED,
        },
      });
    }

    return notification;
  }

  private providerResult(notification: {
    attemptCount: number;
    channel: AlarmChannel;
    maxAttempts: number;
    policy: { channelMetadata: Prisma.JsonValue | null };
  }) {
    const testMode =
      typeof notification.policy.channelMetadata === "object" &&
      notification.policy.channelMetadata !== null &&
      "testProvider" in notification.policy.channelMetadata
        ? String(notification.policy.channelMetadata.testProvider)
        : "";
    if (testMode === "retryable_failure") {
      const attemptNumber = notification.attemptCount + 1;
      const terminal = attemptNumber >= notification.maxAttempts;
      return {
        errorCode: "TEST_PROVIDER_FAILURE",
        errorMessage: "Deterministic test provider failure.",
        failureCode: terminal ? "TEST_PROVIDER_FAILURE" : null,
        failureMessage: terminal ? "Deterministic test provider failure." : null,
        logStatus: AlarmDeliveryAttemptStatus.FAILED,
        nextAttemptAt: terminal ? null : new Date(Date.now() + 1_000),
        notificationStatus: terminal
          ? AlarmNotificationStatus.FAILED
          : AlarmNotificationStatus.PENDING,
        providerKey: "test_retryable_failure",
        requestMetadata: { channel: notification.channel },
        responseMetadata: { terminal },
        retryable: !terminal,
        sentAt: null,
      };
    }

    if (notification.channel === AlarmChannel.IN_APP) {
      const sentAt = new Date();
      return {
        errorCode: null,
        errorMessage: null,
        failureCode: null,
        failureMessage: null,
        logStatus: AlarmDeliveryAttemptStatus.SENT,
        nextAttemptAt: null,
        notificationStatus: AlarmNotificationStatus.SENT,
        providerKey: "in_app",
        requestMetadata: { channel: notification.channel },
        responseMetadata: { stored: true },
        retryable: false,
        sentAt,
      };
    }

    return {
      errorCode: "PROVIDER_UNCONFIGURED",
      errorMessage: "No approved provider is configured for this channel.",
      failureCode: "PROVIDER_UNCONFIGURED",
      failureMessage: "No approved provider is configured for this channel.",
      logStatus: AlarmDeliveryAttemptStatus.SKIPPED,
      nextAttemptAt: null,
      notificationStatus: AlarmNotificationStatus.SKIPPED,
      providerKey: `unconfigured_${notification.channel.toLowerCase()}`,
      requestMetadata: { channel: notification.channel },
      responseMetadata: { configured: false },
      retryable: false,
      sentAt: null,
    };
  }

  private destinationMetadata(channel: AlarmChannel) {
    return channel === AlarmChannel.IN_APP
      ? { type: "in_app" }
      : { configured: false, type: channel.toLowerCase() };
  }

  private async emitBadge(userId: string): Promise<void> {
    this.realtime.emitToCompanyUser(userId, "notifications:update", {
      unreadCount: await this.unreadCount(userId),
    });
  }

  private async unreadCount(userId: string): Promise<number> {
    return this.prisma.alarmNotification.count({
      where: {
        deletedAt: null,
        readAt: null,
        recipientUserId: userId,
        status: AlarmNotificationStatus.SENT,
      },
    });
  }
}
