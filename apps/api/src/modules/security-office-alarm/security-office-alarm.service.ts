import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { loadApiEnv } from "@gss-iot/config";
import {
  AssignmentStatus,
  CompanyStatus,
  DeviceLifecycleStatus,
  GatewayCommandStatus,
  GatewayType,
  SensorReadingStatus,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { GatewayCommandPublisherService } from "../gateway-commands/gateway-command-publisher.service";
import { GatewayCommandsService } from "../gateway-commands/gateway-commands.service";
import { desiredSecurityOfficeState, nodeAlarmSeverity } from "./security-office-alarm.policy";
import type {
  SecurityOfficeAlarmState,
  SecurityOfficeDecision,
} from "./security-office-alarm.policy";

const activeOrganization = { deletedAt: null, status: CompanyStatus.ACTIVE } as const;

function activeBuildingWhere(areaId?: string): Prisma.ConstructionBuildingWhereInput {
  return {
    ...(areaId ? { areaId } : {}),
    area: activeOrganization,
    company: activeOrganization,
    deletedAt: null,
    status: CompanyStatus.ACTIVE,
  };
}

function officeGatewayWhere(areaId?: string): Prisma.GatewayWhereInput {
  return {
    buildingAssignments: {
      some: { building: activeBuildingWhere(areaId), status: AssignmentStatus.ACTIVE },
    },
    companyAssignments: {
      some: { company: activeOrganization, status: AssignmentStatus.ACTIVE },
    },
    gatewayType: GatewayType.SECURITY_OFFICE_GATEWAY,
    status: DeviceLifecycleStatus.ACTIVE,
  };
}

export interface SecurityOfficeAreaSyncResult {
  areaId: string;
  /** `null` when the area has no eligible security-office gateway. */
  desired: SecurityOfficeAlarmState | null;
  gateways: Array<{
    commandId: string | null;
    decision: SecurityOfficeDecision["reason"] | "error";
    gatewayId: string;
  }>;
}

/**
 * Links SECURITY_OFFICE_GATEWAY devices to the alarm state of their construction site.
 *
 * Accepted readings request a coalesced per-area synchronization after their monitoring
 * transaction commits; a bounded periodic sweep reconciles configuration changes (alarm
 * disable, fault filters, assignments) and recovers from a crash between commit and sync.
 * Desired state is always recomputed from persisted LatestNodeState, so every run is
 * idempotent and safe to repeat on any API instance.
 */
@Injectable()
export class SecurityOfficeAlarmService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SecurityOfficeAlarmService.name);
  private readonly inFlight = new Map<string, Promise<void>>();
  private readonly dirtyAreas = new Set<string>();
  /**
   * Start of each Area's current continuous alarm episode as observed by this API instance. It is
   * not persisted: after a restart an episode that has not woken its office gateway yet waits the
   * full activation delay again (DEC-2026-11-25-01).
   */
  private readonly alarmSince = new Map<string, Date>();
  private readonly activationTimers = new Map<string, NodeJS.Timeout>();
  private activationDelayMs = 0;
  private sweeping = false;
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GatewayCommandsService) private readonly commands: GatewayCommandsService,
    @Inject(GatewayCommandPublisherService)
    private readonly publisher: GatewayCommandPublisherService,
  ) {}

  onModuleInit(): void {
    const env = loadApiEnv();
    this.activationDelayMs = env.SECURITY_OFFICE_ALARM_ACTIVATION_DELAY_MS;
    if (!env.SECURITY_OFFICE_ALARM_SWEEP_ENABLED) return;
    this.timer = setInterval(() => {
      void this.sweep().catch((error: unknown) => {
        this.logger.error("Security-office alarm sweep failed.", describeError(error));
      });
    }, env.SECURITY_OFFICE_ALARM_SWEEP_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    for (const timer of this.activationTimers.values()) clearTimeout(timer);
    this.activationTimers.clear();
  }

  /** Fire-and-forget request; concurrent requests for one area collapse into one rerun. */
  requestAreaSync(areaId: string): void {
    if (this.inFlight.has(areaId)) {
      this.dirtyAreas.add(areaId);
      return;
    }
    const run = (async () => {
      do {
        this.dirtyAreas.delete(areaId);
        await this.syncArea(areaId);
      } while (this.dirtyAreas.has(areaId));
    })()
      .catch((error: unknown) => {
        this.logger.error(
          `Security-office alarm sync failed areaId=${areaId}.`,
          describeError(error),
        );
      })
      .finally(() => {
        this.inFlight.delete(areaId);
      });
    this.inFlight.set(areaId, run);
  }

  /** Resolves when every requested area synchronization has settled. */
  async whenIdle(): Promise<void> {
    while (this.inFlight.size > 0) {
      await Promise.allSettled([...this.inFlight.values()]);
    }
  }

  async sweep(): Promise<number> {
    if (this.sweeping) return 0;
    this.sweeping = true;
    try {
      const gateways = await this.prisma.gateway.findMany({
        select: {
          buildingAssignments: {
            select: { building: { select: { areaId: true } } },
            take: 1,
            where: { building: activeBuildingWhere(), status: AssignmentStatus.ACTIVE },
          },
        },
        where: officeGatewayWhere(),
      });
      const areaIds = [
        ...new Set(
          gateways.flatMap((gateway) =>
            gateway.buildingAssignments.map((assignment) => assignment.building.areaId),
          ),
        ),
      ];
      for (const areaId of areaIds) {
        try {
          await this.syncArea(areaId);
        } catch (error) {
          this.logger.error(
            `Security-office alarm sweep failed areaId=${areaId}.`,
            describeError(error),
          );
        }
      }
      return areaIds.length;
    } finally {
      this.sweeping = false;
    }
  }

  async syncArea(areaId: string, now: Date = new Date()): Promise<SecurityOfficeAreaSyncResult> {
    const officeGateways = await this.prisma.gateway.findMany({
      orderBy: { serialNumber: "asc" },
      select: { id: true, serialNumber: true },
      where: officeGatewayWhere(areaId),
    });
    if (officeGateways.length === 0) {
      this.endAlarmEpisode(areaId);
      return { areaId, desired: null, gateways: [] };
    }

    const desired = await this.computeAreaState(areaId);
    const alarmSince = this.trackAlarmEpisode(areaId, desired, now);
    const gateways: SecurityOfficeAreaSyncResult["gateways"] = [];
    for (const gateway of officeGateways) {
      try {
        const result = await this.commands.applySecurityOfficeAlarmState(gateway.id, desired, now, {
          activationDelayMs: this.activationDelayMs,
          alarmSince,
        });
        if (result.decision.reason === "activation-delay") {
          this.scheduleActivationSync(areaId, result.decision.sendAt, now);
        }
        if (result.commandId) {
          this.logger.log(
            `Security-office cmd 3 queued gateway=${gateway.serialNumber} areaId=${areaId} reason=${result.decision.reason} alarmActive=${desired.alarmActive} alertLevel=${desired.alertLevel} commandId=${result.commandId}`,
          );
        }
        const publishId = result.commandId ?? (await this.pendingCommandId(gateway.id));
        if (publishId) {
          await this.publisher.publishPending(publishId);
        }
        gateways.push({
          commandId: result.commandId,
          decision: result.decision.reason,
          gatewayId: gateway.id,
        });
      } catch (error) {
        this.logger.error(
          `Security-office alarm apply failed gateway=${gateway.serialNumber} areaId=${areaId}.`,
          describeError(error),
        );
        gateways.push({ commandId: null, decision: "error", gatewayId: gateway.id });
      }
    }
    return { areaId, desired, gateways };
  }

  /**
   * Highest severity among nodes that would make their own site gateway sound: currently
   * assigned through an active gateway in this area, not fault filtered, with gateway alarm
   * intent enabled for the node type, and classified caution/warning/danger.
   */
  async computeAreaState(areaId: string): Promise<SecurityOfficeAlarmState> {
    const states = await this.prisma.latestNodeState.findMany({
      select: {
        buildingId: true,
        classificationEvidence: true,
        faultFiltered: true,
        gateway: {
          select: {
            buildingAssignments: {
              select: { buildingId: true },
              take: 1,
              where: { status: AssignmentStatus.ACTIVE },
            },
          },
        },
        gatewayId: true,
        node: {
          select: {
            gatewayAssignments: {
              select: { gatewayId: true },
              take: 1,
              where: { status: AssignmentStatus.ACTIVE },
            },
          },
        },
        nodeTypeId: true,
        status: true,
      },
      where: {
        building: activeBuildingWhere(areaId),
        faultFiltered: false,
        gateway: { status: DeviceLifecycleStatus.ACTIVE },
        node: { status: DeviceLifecycleStatus.ACTIVE },
        status: {
          in: [
            SensorReadingStatus.CAUTION,
            SensorReadingStatus.WARNING,
            SensorReadingStatus.DANGER,
            SensorReadingStatus.OFFLINE,
          ],
        },
      },
    });

    const candidates = states
      .filter(
        (state) =>
          state.node.gatewayAssignments[0]?.gatewayId === state.gatewayId &&
          state.gateway.buildingAssignments[0]?.buildingId === state.buildingId,
      )
      .map((state) => ({ ...state, severity: nodeAlarmSeverity(state) }))
      .filter((state) => state.severity !== null);
    if (candidates.length === 0) {
      return desiredSecurityOfficeState([]);
    }

    const disabled = await this.prisma.gatewayAlarmLevelApplication.findMany({
      select: { buildingId: true, gatewayId: true, nodeTypeId: true },
      where: {
        desiredEnabled: false,
        gatewayId: { in: [...new Set(candidates.map((state) => state.gatewayId))] },
      },
    });
    const disabledKeys = new Set(disabled.map(alarmIntentKey));
    return desiredSecurityOfficeState(
      candidates
        .filter((state) => !disabledKeys.has(alarmIntentKey(state)))
        .map((state) => state.severity),
    );
  }

  private trackAlarmEpisode(
    areaId: string,
    desired: SecurityOfficeAlarmState,
    now: Date,
  ): Date | null {
    if (!desired.alarmActive) {
      this.endAlarmEpisode(areaId);
      return null;
    }
    const since = this.alarmSince.get(areaId) ?? now;
    this.alarmSince.set(areaId, since);
    return since;
  }

  private endAlarmEpisode(areaId: string): void {
    this.alarmSince.delete(areaId);
    const timer = this.activationTimers.get(areaId);
    if (timer) clearTimeout(timer);
    this.activationTimers.delete(areaId);
  }

  /**
   * Re-syncs the Area when a delayed activation becomes due. Door nodes report only on change, so
   * no further reading may arrive to trigger the activation; the 30 s sweep is the fallback.
   */
  private scheduleActivationSync(areaId: string, sendAt: Date, now: Date): void {
    if (this.activationTimers.has(areaId)) return;
    const timer = setTimeout(
      () => {
        this.activationTimers.delete(areaId);
        this.requestAreaSync(areaId);
      },
      Math.max(0, sendAt.getTime() - now.getTime()),
    );
    timer.unref?.();
    this.activationTimers.set(areaId, timer);
  }

  private async pendingCommandId(gatewayId: string): Promise<string | null> {
    const pending = await this.prisma.gatewayCommand.findFirst({
      select: { id: true },
      where: {
        commandType: "WAKE_SECURITY",
        gatewayId,
        status: GatewayCommandStatus.PENDING,
      },
    });
    return pending?.id ?? null;
  }
}

function alarmIntentKey(value: { buildingId: string; gatewayId: string; nodeTypeId: string }) {
  return `${value.buildingId}:${value.gatewayId}:${value.nodeTypeId}`;
}

function describeError(error: unknown): string {
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}
