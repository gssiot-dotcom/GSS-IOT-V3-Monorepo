import { randomUUID } from "node:crypto";
import { hostname } from "node:os";

import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { loadApiEnv } from "@gss-iot/config";
import { DeletionJobPhase, DeletionJobStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { ArchiveDomainPurgeService } from "./archive-domain-purge.service";

@Injectable()
export class ArchiveJobProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ArchiveJobProcessorService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly workerId = `${hostname()}:${process.pid}:${randomUUID()}`;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ArchiveDomainPurgeService) private readonly domains: ArchiveDomainPurgeService,
  ) {}

  onModuleInit(): void {
    const env = loadApiEnv();
    if (!env.DELETION_WORKER_ENABLED) return;
    this.timer = setInterval(() => void this.runOnce(), env.DELETION_WORKER_INTERVAL_MS);
    this.timer.unref();
    setTimeout(() => void this.runOnce(), 0);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<boolean> {
    if (this.running) return false;
    this.running = true;
    try {
      const env = loadApiEnv();
      const now = new Date();
      const job = await this.prisma.deletionJob.findFirst({
        orderBy: { createdAt: "asc" },
        where: {
          OR: [
            { status: DeletionJobStatus.PENDING },
            {
              leaseExpiresAt: { lt: now },
              status: DeletionJobStatus.RUNNING,
            },
          ],
        },
      });
      if (!job) return false;
      const leaseExpiresAt = new Date(now.getTime() + env.DELETION_WORKER_LEASE_MS);
      const claimed = await this.prisma.deletionJob.updateMany({
        data: {
          attemptCount: { increment: 1 },
          heartbeatAt: now,
          leaseExpiresAt,
          leaseOwner: this.workerId,
          startedAt: job.startedAt ?? now,
          status: DeletionJobStatus.RUNNING,
        },
        where: {
          id: job.id,
          OR: [
            { status: DeletionJobStatus.PENDING },
            { leaseExpiresAt: { lt: now }, status: DeletionJobStatus.RUNNING },
          ],
        },
      });
      if (!claimed.count) return false;
      const heartbeat = setInterval(() => {
        void this.extendLease(job.id, env.DELETION_WORKER_LEASE_MS).catch(() => {
          leaseLost = true;
        });
      }, env.DELETION_WORKER_HEARTBEAT_MS);
      heartbeat.unref();
      let leaseLost = false;
      try {
        const accumulated = jsonCounts(job.deletedCounts);
        const deleted = await this.domains.purge(
          job.rootType,
          job.rootId,
          async (phase, counts) => {
            if (leaseLost) throw new Error("DELETION_JOB_LEASE_LOST");
            Object.assign(accumulated, counts ?? {});
            const updated = await this.prisma.deletionJob.updateMany({
              data: {
                currentPhase: phase,
                deletedCounts: accumulated,
              },
              where: {
                id: job.id,
                leaseOwner: this.workerId,
                status: DeletionJobStatus.RUNNING,
              },
            });
            if (!updated.count) throw new Error("DELETION_JOB_LEASE_LOST");
            await this.extendLease(job.id, env.DELETION_WORKER_LEASE_MS);
          },
          {
            assertLease: async () => {
              if (leaseLost) throw new Error("DELETION_JOB_LEASE_LOST");
              await this.extendLease(job.id, env.DELETION_WORKER_LEASE_MS);
            },
            resume: Boolean(job.startedAt) || job.attemptCount > 0,
            resumeCounts: accumulated,
            typedFilter: job.typedFilter,
          },
        );
        Object.assign(accumulated, deleted);
        const completedAt = new Date();
        await this.prisma.$transaction(async (tx) => {
          const completed = await tx.deletionJob.updateMany({
            data: {
              activeKey: job.id,
              completedAt,
              currentPhase: DeletionJobPhase.COMPLETE,
              deletedCounts: accumulated,
              heartbeatAt: completedAt,
              leaseExpiresAt: null,
              leaseOwner: null,
              status: DeletionJobStatus.COMPLETED,
            },
            where: {
              id: job.id,
              leaseOwner: this.workerId,
              status: DeletionJobStatus.RUNNING,
            },
          });
          if (!completed.count) throw new Error("DELETION_JOB_LEASE_LOST");
          await tx.purgeReceipt.upsert({
            create: {
              actorId: job.requesterAdminId,
              completedAt,
              deletedGroupCounts: accumulated,
              deletionJobId: job.id,
              rootEntityType: job.rootType,
              status: DeletionJobStatus.COMPLETED,
            },
            update: {},
            where: { deletionJobId: job.id },
          });
        });
        return true;
      } catch (error) {
        const safeErrorSummary = safeError(error);
        await this.prisma.deletionJob.updateMany({
          data: {
            failedCounts: { phase: 1 },
            heartbeatAt: new Date(),
            leaseExpiresAt: null,
            leaseOwner: null,
            safeErrorSummary,
            status: DeletionJobStatus.FAILED,
          },
          where: { id: job.id, leaseOwner: this.workerId },
        });
        this.logger.error(`Deletion job failed id=${job.id} reason=${safeErrorSummary}`);
        return false;
      } finally {
        clearInterval(heartbeat);
      }
    } finally {
      this.running = false;
    }
  }

  private async extendLease(jobId: string, leaseMs: number): Promise<void> {
    const heartbeatAt = new Date();
    const updated = await this.prisma.deletionJob.updateMany({
      data: {
        heartbeatAt,
        leaseExpiresAt: new Date(heartbeatAt.getTime() + leaseMs),
      },
      where: {
        id: jobId,
        leaseOwner: this.workerId,
        status: DeletionJobStatus.RUNNING,
      },
    });
    if (!updated.count) throw new Error("DELETION_JOB_LEASE_LOST");
  }
}

function jsonCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number",
    ),
  );
}

function safeError(error: unknown): string {
  if (error && typeof error === "object" && "response" in error) {
    const response = error.response as { code?: string; message?: string };
    return response.code ?? response.message ?? "PURGE_FAILED";
  }
  if (error && typeof error === "object" && "code" in error) {
    return String(error.code).slice(0, 120);
  }
  return "PURGE_FAILED";
}
