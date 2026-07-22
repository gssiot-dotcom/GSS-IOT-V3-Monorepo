import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { loadApiEnv } from "@gss-iot/config";

import { ReportExportCleanupService } from "./report-export-cleanup.service";
import { ReportJobProcessorService } from "./report-job-processor.service";

export interface ReportWorkerCycleResult {
  cleaned: number;
  processed: number;
}

@Injectable()
export class ReportWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly env = loadApiEnv();
  private readonly logger = new Logger(ReportWorkerService.name);
  private cyclePromise?: Promise<ReportWorkerCycleResult>;
  private lastCleanupAt = 0;
  private stopping = false;
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(ReportJobProcessorService)
    private readonly processor: ReportJobProcessorService,
    @Inject(ReportExportCleanupService)
    private readonly cleanup: ReportExportCleanupService,
  ) {}

  onModuleInit(): void {
    if (!this.env.REPORT_WORKER_ENABLED) {
      this.logger.log("Report worker disabled.");
      return;
    }
    this.timer = setInterval(() => {
      void this.runCycle();
    }, this.env.REPORT_WORKER_INTERVAL_MS);
    void this.runCycle();
    this.logger.log("Report worker enabled.");
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    if (this.cyclePromise) await this.cyclePromise;
  }

  async runCycle(): Promise<ReportWorkerCycleResult> {
    if (!this.env.REPORT_WORKER_ENABLED || this.stopping || this.cyclePromise) {
      return { cleaned: 0, processed: 0 };
    }
    this.cyclePromise = this.runCycleInternal();
    try {
      return await this.cyclePromise;
    } finally {
      this.cyclePromise = undefined;
    }
  }

  private async runCycleInternal(): Promise<ReportWorkerCycleResult> {
    this.logger.log("Report worker cycle started.");
    let processed = 0;
    let cleaned = 0;
    try {
      processed = await this.processor.processPending(this.env.REPORT_WORKER_BATCH_SIZE);
    } catch {
      this.logger.error("Report worker processing cycle failed.");
    }
    if (
      this.env.REPORT_CLEANUP_ENABLED &&
      Date.now() - this.lastCleanupAt >= this.env.REPORT_CLEANUP_INTERVAL_MS
    ) {
      this.lastCleanupAt = Date.now();
      try {
        cleaned = await this.cleanup.cleanupExpired(this.env.REPORT_CLEANUP_BATCH_SIZE);
      } catch {
        this.logger.error("Report export cleanup cycle failed.");
      }
    }
    this.logger.log(`Report worker cycle ended: processed=${processed}, cleaned=${cleaned}.`);
    return { cleaned, processed };
  }
}
