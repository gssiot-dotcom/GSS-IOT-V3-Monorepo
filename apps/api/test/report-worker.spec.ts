import { describe, expect, it, vi } from "vitest";

import type { ReportExportCleanupService } from "../src/modules/reports/report-export-cleanup.service";
import type { ReportJobProcessorService } from "../src/modules/reports/report-job-processor.service";
import { ReportWorkerService } from "../src/modules/reports/report-worker.service";

describe("report worker", () => {
  it("does not claim jobs while disabled", async () => {
    const previousEnabled = process.env.REPORT_WORKER_ENABLED;
    process.env.NODE_ENV = "test";
    process.env.REPORT_WORKER_ENABLED = "false";
    const processor = {
      processPending: vi.fn().mockResolvedValue(1),
    } as unknown as ReportJobProcessorService;
    const cleanup = {
      cleanupExpired: vi.fn().mockResolvedValue(1),
    } as unknown as ReportExportCleanupService;
    const worker = new ReportWorkerService(processor, cleanup);

    await expect(worker.runCycle()).resolves.toEqual({ cleaned: 0, processed: 0 });
    expect(processor.processPending).not.toHaveBeenCalled();
    restoreEnv("REPORT_WORKER_ENABLED", previousEnabled);
  });

  it("claims a bounded batch and prevents overlapping ticks", async () => {
    const previousEnabled = process.env.REPORT_WORKER_ENABLED;
    const previousBatch = process.env.REPORT_WORKER_BATCH_SIZE;
    process.env.NODE_ENV = "test";
    process.env.REPORT_WORKER_ENABLED = "true";
    process.env.REPORT_WORKER_BATCH_SIZE = "7";
    let resolveBatch: (() => void) | undefined;
    const processor = {
      processPending: vi.fn(
        () => new Promise<number>((resolve) => (resolveBatch = () => resolve(7))),
      ),
    } as unknown as ReportJobProcessorService;
    const cleanup = {
      cleanupExpired: vi.fn().mockResolvedValue(0),
    } as unknown as ReportExportCleanupService;
    const worker = new ReportWorkerService(processor, cleanup);

    const first = worker.runCycle();
    const second = worker.runCycle();
    expect(await second).toEqual({ cleaned: 0, processed: 0 });
    expect(processor.processPending).toHaveBeenCalledWith(7);
    resolveBatch?.();
    await expect(first).resolves.toMatchObject({ processed: 7 });
    await worker.onModuleDestroy();
    restoreEnv("REPORT_WORKER_ENABLED", previousEnabled);
    restoreEnv("REPORT_WORKER_BATCH_SIZE", previousBatch);
  });

  it("stops timers and rejects new claims during shutdown", async () => {
    const previousEnabled = process.env.REPORT_WORKER_ENABLED;
    process.env.NODE_ENV = "test";
    process.env.REPORT_WORKER_ENABLED = "true";
    const processor = {
      processPending: vi.fn().mockResolvedValue(0),
    } as unknown as ReportJobProcessorService;
    const cleanup = {
      cleanupExpired: vi.fn().mockResolvedValue(0),
    } as unknown as ReportExportCleanupService;
    const worker = new ReportWorkerService(processor, cleanup);

    worker.onModuleInit();
    await worker.onModuleDestroy();
    await expect(worker.runCycle()).resolves.toEqual({ cleaned: 0, processed: 0 });
    restoreEnv("REPORT_WORKER_ENABLED", previousEnabled);
  });

  function restoreEnv(name: string, value: string | undefined): void {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});
