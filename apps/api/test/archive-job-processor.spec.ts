import { ArchiveEntityType, DeletionJobPhase, DeletionJobStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ArchiveJobProcessorService } from "../src/modules/archive/archive-job-processor.service";
import type { ArchiveDomainPurgeService } from "../src/modules/archive/archive-domain-purge.service";
import type { PrismaService } from "../src/prisma/prisma.service";

const job = {
  activeKey: "active",
  attemptCount: 0,
  completedAt: null,
  createdAt: new Date("2026-07-29T00:00:00Z"),
  currentPhase: DeletionJobPhase.PREPARE,
  deletedCounts: {},
  failedCounts: {},
  heartbeatAt: null,
  id: "6f49ee5e-9042-4d12-b536-d6a4acc29997",
  idempotencyKey: "77c194ea-332a-46be-a232-2315afe2b03b",
  leaseExpiresAt: null,
  leaseOwner: null,
  previewHash: "a".repeat(64),
  requesterAdminId: "0110ea48-998d-4ee0-a108-8f4fbe31867f",
  rootId: "e704af50-8634-4fd8-bef2-e7f80b60505e",
  rootType: ArchiveEntityType.COMPANY_USER,
  safeErrorSummary: null,
  startedAt: null,
  status: DeletionJobStatus.PENDING,
  targetKey: "COMPANY_USER:e704af50-8634-4fd8-bef2-e7f80b60505e",
  totalCounts: { users: 1 },
  typedFilter: {},
  updatedAt: new Date("2026-07-29T00:00:00Z"),
  companyId: null,
  areaId: null,
  buildingId: null,
};

describe("ArchiveJobProcessorService", () => {
  beforeEach(() => {
    process.env.DELETION_WORKER_ENABLED = "false";
  });

  it("allows only one worker to claim and finalize a deletion job", async () => {
    let claimed = false;
    const receiptUpsert = vi.fn().mockResolvedValue({});
    const deletionJob = {
      findFirst: vi.fn().mockResolvedValue(job),
      updateMany: vi
        .fn()
        .mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
          if ("attemptCount" in data) {
            if (claimed) return { count: 0 };
            claimed = true;
            return { count: 1 };
          }
          return { count: 1 };
        }),
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
        callback({ deletionJob, purgeReceipt: { upsert: receiptUpsert } }),
      ),
      deletionJob,
    } as unknown as PrismaService;
    const domains = {
      purge: vi.fn().mockResolvedValue({ users: 1 }),
    } as unknown as ArchiveDomainPurgeService;
    const first = new ArchiveJobProcessorService(prisma, domains);
    const second = new ArchiveJobProcessorService(prisma, domains);

    const results = await Promise.all([first.runOnce(), second.runOnce()]);

    expect(results.sort()).toEqual([false, true]);
    expect(domains.purge).toHaveBeenCalledTimes(1);
    expect(receiptUpsert).toHaveBeenCalledTimes(1);
  });

  it("recovers an expired running lease and retains persisted phase counts", async () => {
    const staleJob = {
      ...job,
      attemptCount: 1,
      currentPhase: DeletionJobPhase.ROOT,
      deletedCounts: { detachedNotifications: 3 },
      leaseExpiresAt: new Date("2026-07-28T00:00:00Z"),
      startedAt: new Date("2026-07-28T00:00:00Z"),
      status: DeletionJobStatus.RUNNING,
    };
    const receiptUpsert = vi.fn().mockResolvedValue({});
    const deletionJob = {
      findFirst: vi.fn().mockResolvedValue(staleJob),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
        callback({ deletionJob, purgeReceipt: { upsert: receiptUpsert } }),
      ),
      deletionJob,
    } as unknown as PrismaService;
    const domains = {
      purge: vi.fn().mockResolvedValue({ users: 1 }),
    } as unknown as ArchiveDomainPurgeService;

    await expect(new ArchiveJobProcessorService(prisma, domains).runOnce()).resolves.toBe(true);
    expect(domains.purge).toHaveBeenCalledWith(
      ArchiveEntityType.COMPANY_USER,
      staleJob.rootId,
      expect.any(Function),
      expect.objectContaining({
        resume: true,
        resumeCounts: expect.objectContaining({ detachedNotifications: 3 }),
      }),
    );
    expect(receiptUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          deletedGroupCounts: { detachedNotifications: 3, users: 1 },
        }),
        update: {},
      }),
    );
  });

  it("detects lease ownership loss and does not finalize", async () => {
    const deletionJob = {
      findFirst: vi.fn().mockResolvedValue(job),
      updateMany: vi
        .fn()
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValue({ count: 0 }),
    };
    const receiptUpsert = vi.fn();
    const prisma = {
      $transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
        callback({ deletionJob, purgeReceipt: { upsert: receiptUpsert } }),
      ),
      deletionJob,
    } as unknown as PrismaService;
    const domains = {
      purge: vi
        .fn()
        .mockImplementation(
          async (_type, _id, progress: (phase: DeletionJobPhase) => Promise<void>) => {
            await progress(DeletionJobPhase.TENANT_RELATIONS);
            return { users: 1 };
          },
        ),
    } as unknown as ArchiveDomainPurgeService;

    await expect(new ArchiveJobProcessorService(prisma, domains).runOnce()).resolves.toBe(false);
    expect(receiptUpsert).not.toHaveBeenCalled();
  });

  it("renews heartbeat only while the worker owns the running lease", async () => {
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const service = new ArchiveJobProcessorService(
      { deletionJob: { updateMany } } as unknown as PrismaService,
      {} as ArchiveDomainPurgeService,
    );
    const renew = (
      service as unknown as { extendLease(id: string, leaseMs: number): Promise<void> }
    ).extendLease.bind(service);

    await expect(renew(job.id, 30_000)).resolves.toBeUndefined();
    await expect(renew(job.id, 30_000)).rejects.toThrow("DELETION_JOB_LEASE_LOST");
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          heartbeatAt: expect.any(Date),
          leaseExpiresAt: expect.any(Date),
        }),
        where: expect.objectContaining({ id: job.id, status: DeletionJobStatus.RUNNING }),
      }),
    );
  });
});
