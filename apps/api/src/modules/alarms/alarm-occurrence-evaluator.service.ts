import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AlarmCounterStatus,
  AlarmEventStatus,
  AlarmResolutionReason,
  AlarmSeverity,
  SensorReadingStatus,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import type { AlarmPolicyTriggeredEvent } from "./alarm-domain-events.service";

export interface AlarmAssignmentProvenance {
  gatewayCompanyAssignmentId: string;
  gatewayBuildingAssignmentId: string;
  nodeCompanyAssignmentId: string;
  nodeGatewayAssignmentId: string;
}

export interface AlarmEvaluationInput {
  areaId: string;
  assignmentProvenance: AlarmAssignmentProvenance;
  buildingId: string;
  classificationEvidence: unknown;
  companyId: string;
  faultFiltered: boolean;
  gatewayId: string;
  nodeId: string;
  nodeTypeId: string;
  readingId: string;
  receivedAt: Date;
  status: SensorReadingStatus;
  values: unknown;
}

type Tx = Prisma.TransactionClient;

const unsafeStatusToSeverity: Partial<Record<SensorReadingStatus, AlarmSeverity>> = {
  [SensorReadingStatus.CAUTION]: AlarmSeverity.CAUTION,
  [SensorReadingStatus.WARNING]: AlarmSeverity.WARNING,
  [SensorReadingStatus.DANGER]: AlarmSeverity.DANGER,
};

@Injectable()
export class AlarmOccurrenceEvaluatorService {
  private readonly logger = new Logger(AlarmOccurrenceEvaluatorService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async evaluate(tx: Tx, input: AlarmEvaluationInput): Promise<AlarmPolicyTriggeredEvent[]> {
    if (input.status === SensorReadingStatus.SAFE) {
      await this.resetNode(tx, input, AlarmResolutionReason.SAFE);
      return [];
    }

    if (input.faultFiltered) {
      await this.resetNode(tx, input, AlarmResolutionReason.FAULT_FILTERED);
      return [];
    }

    const desiredEnabled = await this.isDesiredAlarmEnabled(tx, input);
    if (!desiredEnabled) {
      await this.resetNode(tx, input, AlarmResolutionReason.ALARM_DESIRED_DISABLED);
      return [];
    }

    const severity = unsafeStatusToSeverity[input.status];
    if (!severity) {
      return [];
    }

    await this.resetOtherSeverities(tx, input, severity);

    const rule = await tx.alarmRule.findFirst({
      include: {
        recipientPolicies: {
          orderBy: { createdAt: "asc" },
          where: { deletedAt: null, isActive: true },
        },
      },
      where: {
        activeKey: "active",
        buildingId: input.buildingId,
        deletedAt: null,
        isActive: true,
        nodeTypeId: input.nodeTypeId,
        severity,
      },
    });
    if (!rule) {
      return [];
    }

    const events: AlarmPolicyTriggeredEvent[] = [];
    for (const policy of rule.recipientPolicies) {
      const event = await this.evaluatePolicy(tx, input, rule, policy);
      if (event) {
        events.push(event);
      }
    }
    return events;
  }

  async resetPolicyStates(policyId: string, reason: AlarmResolutionReason): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const policy = await tx.alarmRecipientPolicy.findUnique({
        include: { rule: true },
        where: { id: policyId },
      });
      if (!policy) return;
      await tx.alarmCounterState.updateMany({
        data: {
          currentCount: 0,
          cycleStartedAt: null,
          firstCountedReadingId: null,
          lastCountedAt: null,
          lastCountedReadingId: null,
          nextCountAt: null,
          status: AlarmCounterStatus.RESET,
          version: { increment: 1 },
        },
        where: { policyId },
      });
      await this.resolveActiveEventsForRule(tx, policy.ruleId, reason);
    });
  }

  async resetRuleStates(ruleId: string, reason: AlarmResolutionReason): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.alarmCounterState.updateMany({
        data: {
          currentCount: 0,
          cycleStartedAt: null,
          firstCountedReadingId: null,
          lastCountedAt: null,
          lastCountedReadingId: null,
          nextCountAt: null,
          status: AlarmCounterStatus.RESET,
          version: { increment: 1 },
        },
        where: { ruleId },
      });
      await this.resolveActiveEventsForRule(tx, ruleId, reason);
    });
  }

  private async evaluatePolicy(
    tx: Tx,
    input: AlarmEvaluationInput,
    rule: {
      id: string;
      severity: AlarmSeverity;
    },
    policy: {
      countIntervalSeconds: number;
      evaluationVersion: number;
      id: string;
      requiredOccurrenceCount: number;
      targetKey: string;
    },
  ): Promise<AlarmPolicyTriggeredEvent | null> {
    const existing = await tx.alarmCounterState.findUnique({
      where: { policyId_nodeId: { nodeId: input.nodeId, policyId: policy.id } },
    });
    const nextCountAt = existing?.nextCountAt ?? null;
    if (nextCountAt && input.receivedAt < nextCountAt) {
      return null;
    }

    const cycleNo = existing?.cycleNo ?? 1;
    const firstCountedReadingId =
      existing?.currentCount && existing.firstCountedReadingId
        ? existing.firstCountedReadingId
        : input.readingId;
    const currentCount =
      existing?.evaluationVersion === policy.evaluationVersion &&
      existing.status === AlarmCounterStatus.ACTIVE
        ? existing.currentCount
        : 0;
    const newCount = currentCount + 1;
    const evidence = this.evidence(input, policy);
    const nextEligibleAt = this.addSeconds(input.receivedAt, policy.countIntervalSeconds);

    if (newCount < policy.requiredOccurrenceCount) {
      await tx.alarmCounterState.upsert({
        create: {
          assignmentProvenance: input.assignmentProvenance as unknown as Prisma.InputJsonValue,
          currentCount: newCount,
          cycleNo,
          cycleStartedAt: existing?.cycleStartedAt ?? input.receivedAt,
          evaluationVersion: policy.evaluationVersion,
          evidence: evidence as Prisma.InputJsonValue,
          firstCountedReadingId,
          lastCountedAt: input.receivedAt,
          lastCountedReadingId: input.readingId,
          latestValue: input.values as Prisma.InputJsonValue,
          nextCountAt: nextEligibleAt,
          nodeId: input.nodeId,
          nodeTypeId: input.nodeTypeId,
          policyId: policy.id,
          ruleId: rule.id,
          severity: rule.severity,
        },
        update: {
          assignmentProvenance: input.assignmentProvenance as unknown as Prisma.InputJsonValue,
          currentCount: newCount,
          cycleStartedAt: existing?.cycleStartedAt ?? input.receivedAt,
          evaluationVersion: policy.evaluationVersion,
          evidence: evidence as Prisma.InputJsonValue,
          firstCountedReadingId,
          lastCountedAt: input.receivedAt,
          lastCountedReadingId: input.readingId,
          latestValue: input.values as Prisma.InputJsonValue,
          nextCountAt: nextEligibleAt,
          nodeTypeId: input.nodeTypeId,
          ruleId: rule.id,
          severity: rule.severity,
          status: AlarmCounterStatus.ACTIVE,
          version: { increment: 1 },
        },
        where: { policyId_nodeId: { nodeId: input.nodeId, policyId: policy.id } },
      });
      return null;
    }

    const event = await tx.alarmEvent.upsert({
      create: {
        activeKey: "active",
        areaId: input.areaId,
        assignmentProvenance: input.assignmentProvenance as unknown as Prisma.InputJsonValue,
        buildingId: input.buildingId,
        companyId: input.companyId,
        evidence: evidence as Prisma.InputJsonValue,
        gatewayId: input.gatewayId,
        lastTriggeredAt: input.receivedAt,
        nodeId: input.nodeId,
        nodeTypeId: input.nodeTypeId,
        openedAt: input.receivedAt,
        ruleId: rule.id,
        severity: rule.severity,
        status: AlarmEventStatus.OPEN,
      },
      update: {
        assignmentProvenance: input.assignmentProvenance as unknown as Prisma.InputJsonValue,
        evidence: evidence as Prisma.InputJsonValue,
        gatewayId: input.gatewayId,
        lastTriggeredAt: input.receivedAt,
      },
      where: {
        nodeId_ruleId_severity_activeKey: {
          activeKey: "active",
          nodeId: input.nodeId,
          ruleId: rule.id,
          severity: rule.severity,
        },
      },
    });

    const trigger = await tx.alarmPolicyTrigger.create({
      data: {
        alarmEventId: event.id,
        assignmentProvenance: input.assignmentProvenance as unknown as Prisma.InputJsonValue,
        countIntervalSeconds: policy.countIntervalSeconds,
        evaluationVersion: policy.evaluationVersion,
        evidence: evidence as Prisma.InputJsonValue,
        firstCountedReadingId,
        lastCountedReadingId: input.readingId,
        nodeId: input.nodeId,
        policyId: policy.id,
        ruleId: rule.id,
        triggerCycleNo: cycleNo,
        triggerOccurrenceCount: newCount,
        triggerReadingId: input.readingId,
        triggeredAt: input.receivedAt,
      },
    });

    await tx.alarmCounterState.upsert({
      create: {
        assignmentProvenance: input.assignmentProvenance as unknown as Prisma.InputJsonValue,
        currentCount: 0,
        cycleNo: cycleNo + 1,
        evaluationVersion: policy.evaluationVersion,
        evidence: evidence as Prisma.InputJsonValue,
        lastCountedAt: input.receivedAt,
        latestValue: input.values as Prisma.InputJsonValue,
        nextCountAt: nextEligibleAt,
        nodeId: input.nodeId,
        nodeTypeId: input.nodeTypeId,
        policyId: policy.id,
        ruleId: rule.id,
        severity: rule.severity,
      },
      update: {
        assignmentProvenance: input.assignmentProvenance as unknown as Prisma.InputJsonValue,
        currentCount: 0,
        cycleNo: cycleNo + 1,
        cycleStartedAt: null,
        evaluationVersion: policy.evaluationVersion,
        evidence: evidence as Prisma.InputJsonValue,
        firstCountedReadingId: null,
        lastCountedAt: input.receivedAt,
        lastCountedReadingId: null,
        latestValue: input.values as Prisma.InputJsonValue,
        nextCountAt: nextEligibleAt,
        nodeTypeId: input.nodeTypeId,
        ruleId: rule.id,
        severity: rule.severity,
        status: AlarmCounterStatus.ACTIVE,
        version: { increment: 1 },
      },
      where: { policyId_nodeId: { nodeId: input.nodeId, policyId: policy.id } },
    });

    return {
      alarmEventId: event.id,
      nodeId: input.nodeId,
      policyId: policy.id,
      ruleId: rule.id,
      triggerId: trigger.id,
      triggeredAt: input.receivedAt.toISOString(),
    };
  }

  private async isDesiredAlarmEnabled(tx: Tx, input: AlarmEvaluationInput): Promise<boolean> {
    const application = await tx.gatewayAlarmLevelApplication.findUnique({
      where: {
        buildingId_gatewayId_nodeTypeId: {
          buildingId: input.buildingId,
          gatewayId: input.gatewayId,
          nodeTypeId: input.nodeTypeId,
        },
      },
    });
    return application?.desiredEnabled !== false;
  }

  private async resetNode(
    tx: Tx,
    input: AlarmEvaluationInput,
    reason: AlarmResolutionReason,
  ): Promise<void> {
    await tx.alarmCounterState.updateMany({
      data: {
        currentCount: 0,
        cycleStartedAt: null,
        firstCountedReadingId: null,
        lastCountedAt: null,
        lastCountedReadingId: null,
        nextCountAt: null,
        status: AlarmCounterStatus.RESET,
        version: { increment: 1 },
      },
      where: { nodeId: input.nodeId, status: AlarmCounterStatus.ACTIVE },
    });
    await this.resolveActiveEventsForNode(tx, input.nodeId, reason);
  }

  private async resetOtherSeverities(
    tx: Tx,
    input: AlarmEvaluationInput,
    severity: AlarmSeverity,
  ): Promise<void> {
    await tx.alarmCounterState.updateMany({
      data: {
        currentCount: 0,
        cycleStartedAt: null,
        firstCountedReadingId: null,
        lastCountedAt: null,
        lastCountedReadingId: null,
        nextCountAt: null,
        status: AlarmCounterStatus.RESET,
        version: { increment: 1 },
      },
      where: {
        nodeId: input.nodeId,
        severity: { not: severity },
        status: AlarmCounterStatus.ACTIVE,
      },
    });
    await this.resolveActiveEventsForNode(
      tx,
      input.nodeId,
      AlarmResolutionReason.SEVERITY_TRANSITION,
      severity,
    );
  }

  private async resolveActiveEventsForRule(
    tx: Tx,
    ruleId: string,
    reason: AlarmResolutionReason,
  ): Promise<void> {
    const events = await tx.alarmEvent.findMany({
      select: { id: true },
      where: {
        activeKey: "active",
        ruleId,
        status: { in: [AlarmEventStatus.OPEN, AlarmEventStatus.ACKNOWLEDGED] },
      },
    });
    await Promise.all(events.map((event) => this.resolveEvent(tx, event.id, reason)));
  }

  private async resolveActiveEventsForNode(
    tx: Tx,
    nodeId: string,
    reason: AlarmResolutionReason,
    exceptSeverity?: AlarmSeverity,
  ): Promise<void> {
    const events = await tx.alarmEvent.findMany({
      select: { id: true },
      where: {
        activeKey: "active",
        nodeId,
        severity: exceptSeverity ? { not: exceptSeverity } : undefined,
        status: { in: [AlarmEventStatus.OPEN, AlarmEventStatus.ACKNOWLEDGED] },
      },
    });
    await Promise.all(events.map((event) => this.resolveEvent(tx, event.id, reason)));
  }

  private async resolveEvent(
    tx: Tx,
    eventId: string,
    reason: AlarmResolutionReason,
  ): Promise<void> {
    await tx.alarmEvent.update({
      data: {
        activeKey: eventId,
        resolutionReason: reason,
        resolvedAt: new Date(),
        status: AlarmEventStatus.RESOLVED,
      },
      where: { id: eventId },
    });
  }

  private evidence(
    input: AlarmEvaluationInput,
    policy: {
      countIntervalSeconds: number;
      evaluationVersion: number;
      id: string;
      requiredOccurrenceCount: number;
      targetKey: string;
    },
  ) {
    return {
      classificationEvidence: input.classificationEvidence,
      policy: {
        countIntervalSeconds: policy.countIntervalSeconds,
        evaluationVersion: policy.evaluationVersion,
        id: policy.id,
        requiredOccurrenceCount: policy.requiredOccurrenceCount,
        targetKey: policy.targetKey,
      },
      reading: {
        id: input.readingId,
        receivedAt: input.receivedAt.toISOString(),
        status: input.status,
        values: input.values,
      },
    };
  }

  private addSeconds(date: Date, seconds: number): Date {
    return new Date(date.getTime() + seconds * 1_000);
  }
}
