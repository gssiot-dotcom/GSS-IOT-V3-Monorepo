import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { loadApiEnv } from "@gss-iot/config";
import {
  AssignmentStatus,
  CompanyStatus,
  DeviceLifecycleStatus,
  SensorReadingStatus,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { mapLatestState } from "./monitoring-mappers";
import { MonitoringRealtimeService } from "./monitoring-realtime.service";

export const NODE_OFFLINE_TIMEOUT_MS = 5 * 60 * 1_000;

const offlineCandidateSelect = {
  areaId: true,
  building: { select: { id: true, title: true } },
  buildingId: true,
  classificationEvidence: true,
  companyId: true,
  faultFiltered: true,
  gateway: { select: { id: true, serialNumber: true } },
  gatewayId: true,
  id: true,
  lastSeenAt: true,
  node: { select: { id: true, installedLocation: true, number: true } },
  nodeId: true,
  nodeType: {
    select: {
      displayName: true,
      id: true,
      imageAssetKey: true,
      key: true,
      numericCode: true,
    },
  },
  nodeTypeId: true,
  status: true,
  updatedAt: true,
  values: true,
} satisfies Prisma.LatestNodeStateSelect;

type OfflineCandidate = Prisma.LatestNodeStateGetPayload<{
  select: typeof offlineCandidateSelect;
}>;

export function nodeOfflineCutoff(now: Date): Date {
  return new Date(now.getTime() - NODE_OFFLINE_TIMEOUT_MS);
}

@Injectable()
export class NodeOfflineEvaluatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NodeOfflineEvaluatorService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MonitoringRealtimeService) private readonly realtime: MonitoringRealtimeService,
  ) {}

  onModuleInit(): void {
    const env = loadApiEnv();
    if (!env.NODE_OFFLINE_EVALUATOR_ENABLED) return;
    void this.runCycle().catch((error: unknown) => this.logCycleFailure(error));
    this.timer = setInterval(
      () => void this.runCycle().catch((error: unknown) => this.logCycleFailure(error)),
      env.NODE_OFFLINE_SWEEP_INTERVAL_MS,
    );
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runCycle(now = new Date()): Promise<{
    candidates: number;
    cutoff: string;
    transitioned: number;
  }> {
    const cutoff = nodeOfflineCutoff(now);
    if (this.running) return { candidates: 0, cutoff: cutoff.toISOString(), transitioned: 0 };
    this.running = true;
    try {
      const candidates = await this.prisma.latestNodeState.findMany({
        orderBy: [{ lastSeenAt: "asc" }, { id: "asc" }],
        select: offlineCandidateSelect,
        take: loadApiEnv().NODE_OFFLINE_BATCH_SIZE,
        where: {
          building: {
            area: { deletedAt: null, status: CompanyStatus.ACTIVE },
            company: { deletedAt: null, status: CompanyStatus.ACTIVE },
            deletedAt: null,
            status: CompanyStatus.ACTIVE,
          },
          gateway: {
            buildingAssignments: {
              some: {
                building: {
                  area: { deletedAt: null, status: CompanyStatus.ACTIVE },
                  company: { deletedAt: null, status: CompanyStatus.ACTIVE },
                  deletedAt: null,
                  status: CompanyStatus.ACTIVE,
                },
                status: AssignmentStatus.ACTIVE,
              },
            },
            companyAssignments: {
              some: {
                company: { deletedAt: null, status: CompanyStatus.ACTIVE },
                status: AssignmentStatus.ACTIVE,
              },
            },
            status: DeviceLifecycleStatus.ACTIVE,
          },
          lastSeenAt: { lte: cutoff },
          node: {
            companyAssignments: {
              some: {
                company: { deletedAt: null, status: CompanyStatus.ACTIVE },
                status: AssignmentStatus.ACTIVE,
              },
            },
            gatewayAssignments: { some: { status: AssignmentStatus.ACTIVE } },
            status: DeviceLifecycleStatus.ACTIVE,
          },
          status: { not: SensorReadingStatus.OFFLINE },
        },
      });
      let transitioned = 0;
      for (const candidate of candidates) {
        const result = await this.prisma.latestNodeState.updateMany({
          data: { status: SensorReadingStatus.OFFLINE, updatedAt: now },
          where: this.transitionWhere(candidate, cutoff),
        });
        if (result.count !== 1) continue;
        transitioned += 1;
        this.realtime.emitNodeState(
          mapLatestState({
            ...candidate,
            status: SensorReadingStatus.OFFLINE,
            updatedAt: now,
          }),
        );
      }
      if (transitioned > 0) {
        this.logger.log(
          `Node offline sweep transitioned=${transitioned} candidates=${candidates.length} cutoff=${cutoff.toISOString()}`,
        );
      }
      return { candidates: candidates.length, cutoff: cutoff.toISOString(), transitioned };
    } finally {
      this.running = false;
    }
  }

  private transitionWhere(
    candidate: OfflineCandidate,
    cutoff: Date,
  ): Prisma.LatestNodeStateWhereInput {
    const activeCompany = { deletedAt: null, status: CompanyStatus.ACTIVE } as const;
    const activeBuilding = {
      area: {
        companyId: candidate.companyId,
        deletedAt: null,
        id: candidate.areaId,
        status: CompanyStatus.ACTIVE,
      },
      areaId: candidate.areaId,
      company: { ...activeCompany, id: candidate.companyId },
      companyId: candidate.companyId,
      deletedAt: null,
      id: candidate.buildingId,
      status: CompanyStatus.ACTIVE,
    } as const;
    return {
      area: {
        companyId: candidate.companyId,
        deletedAt: null,
        id: candidate.areaId,
        status: CompanyStatus.ACTIVE,
      },
      areaId: candidate.areaId,
      building: activeBuilding,
      buildingId: candidate.buildingId,
      company: { ...activeCompany, id: candidate.companyId },
      companyId: candidate.companyId,
      gateway: {
        buildingAssignments: {
          some: {
            building: activeBuilding,
            buildingId: candidate.buildingId,
            status: AssignmentStatus.ACTIVE,
          },
        },
        companyAssignments: {
          some: {
            company: activeCompany,
            companyId: candidate.companyId,
            status: AssignmentStatus.ACTIVE,
          },
        },
        id: candidate.gatewayId,
        status: DeviceLifecycleStatus.ACTIVE,
      },
      gatewayId: candidate.gatewayId,
      id: candidate.id,
      lastSeenAt: { lte: cutoff },
      node: {
        companyAssignments: {
          some: {
            company: activeCompany,
            companyId: candidate.companyId,
            status: AssignmentStatus.ACTIVE,
          },
        },
        gatewayAssignments: {
          some: { gatewayId: candidate.gatewayId, status: AssignmentStatus.ACTIVE },
        },
        id: candidate.nodeId,
        status: DeviceLifecycleStatus.ACTIVE,
      },
      nodeId: candidate.nodeId,
      status: { not: SensorReadingStatus.OFFLINE },
    };
  }

  private logCycleFailure(error: unknown): void {
    this.logger.error(
      `Node offline sweep failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}
