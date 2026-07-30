import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { loadApiEnv } from "@gss-iot/config";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class SensorReadingRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SensorReadingRetentionService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    const env = loadApiEnv();
    if (!env.SENSOR_RETENTION_ENABLED) return;
    this.timer = setInterval(() => void this.runCycle(), env.SENSOR_RETENTION_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async dryRunCount(filters?: Prisma.SensorReadingWhereInput): Promise<number> {
    return this.prisma.sensorReading.count({ where: this.eligibleWhere(filters) });
  }

  async filteredDryRunCount(filters: Prisma.SensorReadingWhereInput): Promise<number> {
    return this.prisma.sensorReading.count({ where: this.eligibleWhere(filters, false) });
  }

  async runCycle(): Promise<{
    cutoff: string;
    deleted: number;
    dryRun: boolean;
    eligible: number;
  }> {
    if (this.running) {
      return { cutoff: this.cutoff().toISOString(), deleted: 0, dryRun: true, eligible: 0 };
    }
    this.running = true;
    const env = loadApiEnv();
    const cutoff = this.cutoff();
    try {
      const eligible = await this.prisma.sensorReading.count({ where: this.eligibleWhere() });
      if (env.SENSOR_RETENTION_DRY_RUN) {
        this.logger.log(
          `Sensor retention dry-run eligible=${eligible} cutoff=${cutoff.toISOString()}`,
        );
        return { cutoff: cutoff.toISOString(), deleted: 0, dryRun: true, eligible };
      }
      let deleted = 0;
      while (deleted < env.SENSOR_RETENTION_MAX_ROWS_PER_CYCLE) {
        const take = Math.min(
          env.SENSOR_RETENTION_BATCH_SIZE,
          env.SENSOR_RETENTION_MAX_ROWS_PER_CYCLE - deleted,
        );
        const candidates = await this.prisma.sensorReading.findMany({
          orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
          select: { id: true },
          take,
          where: this.eligibleWhere(),
        });
        if (!candidates.length) break;
        const result = await this.prisma.sensorReading.deleteMany({
          where: {
            ...this.eligibleWhere(),
            id: { in: candidates.map(({ id }) => id) },
          },
        });
        deleted += result.count;
        if (candidates.length < take) break;
      }
      this.logger.log(`Sensor retention deleted=${deleted} cutoff=${cutoff.toISOString()}`);
      return { cutoff: cutoff.toISOString(), deleted, dryRun: false, eligible };
    } finally {
      this.running = false;
    }
  }

  async purgeFiltered(filters: Prisma.SensorReadingWhereInput, batchSize: number): Promise<number> {
    const candidates = await this.prisma.sensorReading.findMany({
      orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
      select: { id: true },
      take: batchSize,
      where: this.eligibleWhere(filters, false),
    });
    if (!candidates.length) return 0;
    const result = await this.prisma.sensorReading.deleteMany({
      where: {
        ...this.eligibleWhere(filters, false),
        id: { in: candidates.map(({ id }) => id) },
      },
    });
    return result.count;
  }

  private cutoff(): Date {
    const env = loadApiEnv();
    return new Date(Date.now() - env.SENSOR_RETENTION_DAYS * 24 * 60 * 60 * 1_000);
  }

  private eligibleWhere(
    filters?: Prisma.SensorReadingWhereInput,
    applyRetentionCutoff = true,
  ): Prisma.SensorReadingWhereInput {
    return {
      AND: [
        ...(filters ? [filters] : []),
        ...(applyRetentionCutoff ? [{ receivedAt: { lt: this.cutoff() } }] : []),
        {
          firstCounterStates: { none: {} },
          firstPolicyTriggers: { none: {} },
          lastCounterStates: { none: {} },
          lastPolicyTriggers: { none: {} },
          triggerReadings: { none: {} },
        },
      ],
    };
  }
}
