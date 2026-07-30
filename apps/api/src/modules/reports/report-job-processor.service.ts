import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AuditActorType,
  ReportFileFormat,
  ReportJobStatus,
  ReportRequesterType,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { ReportFormattersService } from "./report-formatters.service";
import { ReportGenerationService } from "./report-generation.service";
import { ReportGeneratorsService } from "./report-generators.service";
import type { ReportJobForExecution } from "./report-types";
import {
  localizeReportDataset,
  localizedReportFileName,
  normalizeReportLocale,
} from "./report-localization";

const exportTtlMs = 24 * 60 * 60 * 1_000;

@Injectable()
export class ReportJobProcessorService {
  private readonly logger = new Logger(ReportJobProcessorService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ReportFormattersService) private readonly formatters: ReportFormattersService,
    @Inject(ReportGenerationService) private readonly generation: ReportGenerationService,
    @Inject(ReportGeneratorsService) private readonly generators: ReportGeneratorsService,
  ) {}

  async processJob(jobId: string): Promise<{ status: ReportJobStatus; exportId?: string }> {
    const claimed = await this.generation.claimPending(jobId);
    if (!claimed) {
      const current = await this.prisma.reportJob.findUnique({
        select: { status: true },
        where: { id: jobId },
      });
      return { status: current?.status ?? ReportJobStatus.FAILED };
    }
    try {
      const locale = normalizeReportLocale(readFilter(claimed.filters, "locale"));
      const dataset = localizeReportDataset(
        await this.generators.generate(claimed as ReportJobForExecution),
        locale,
      );
      const format = readFormat(claimed.filters);
      const fileName = localizedReportFileName(locale, claimed.reportType, claimed.id, format);
      const contentType =
        format === ReportFileFormat.XLSX
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv; charset=utf-8";
      const content =
        format === ReportFileFormat.XLSX
          ? this.formatters.toXlsx(dataset)
          : this.formatters.toCsv(dataset);
      const reportExport = await this.generation.complete(claimed.id, {
        content,
        contentType,
        createdById: claimed.requestedById,
        createdByType: requesterActor(claimed.requestedByType),
        expiresAt: new Date(Date.now() + exportTtlMs),
        fileName,
        format,
      });
      await this.recordSystemAudit("report-job.completed", claimed.id, {
        exportId: reportExport.id,
        format,
        rowCount: dataset.rows.length,
      });
      return { exportId: reportExport.id, status: ReportJobStatus.COMPLETED };
    } catch (error) {
      const safeMessage = safeFailure(error);
      await this.generation.fail(claimed.id, safeMessage);
      await this.recordSystemAudit("report-job.failed", claimed.id, { error: safeMessage });
      this.logger.warn(`Report job ${claimed.id} failed: ${safeMessage}`);
      return { status: ReportJobStatus.FAILED };
    }
  }

  async processPending(limit = 10): Promise<number> {
    const jobs = await this.prisma.reportJob.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
      take: Math.max(1, Math.min(limit, 100)),
      where: { status: ReportJobStatus.PENDING },
    });
    let processed = 0;
    for (const job of jobs) {
      try {
        const result = await this.processJob(job.id);
        if (
          result.status === ReportJobStatus.COMPLETED ||
          result.status === ReportJobStatus.FAILED
        ) {
          processed += 1;
        }
      } catch {
        this.logger.warn("A report worker job failed before terminal handling; continuing batch.");
      }
    }
    return processed;
  }

  private async recordSystemAudit(
    action: string,
    entityId: string,
    newValue: Prisma.InputJsonObject,
  ) {
    await this.prisma.auditLog.create({
      data: {
        action,
        actorType: AuditActorType.SYSTEM,
        entityId,
        entityType: "ReportJob",
        newValue,
      },
    });
  }
}

function readFormat(filters: Prisma.JsonValue): ReportFileFormat {
  if (filters && typeof filters === "object" && !Array.isArray(filters)) {
    const format = (filters as Record<string, unknown>).format;
    if (format === ReportFileFormat.XLSX) return ReportFileFormat.XLSX;
  }
  return ReportFileFormat.CSV;
}

function readFilter(filters: Prisma.JsonValue, key: string): string | undefined {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) return undefined;
  const value = (filters as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function requesterActor(type: ReportRequesterType): AuditActorType {
  return type === ReportRequesterType.GSS_ADMIN
    ? AuditActorType.GSS_ADMIN
    : AuditActorType.COMPANY_USER;
}

function safeFailure(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Report generation failed.";
  const safe = raw.replaceAll(
    /postgresql:\/\/[^\s]+|password|passwd|secret|token|credential|storageKey|storagePath/gi,
    "[redacted]",
  );
  return safe.slice(0, 500) || "Report generation failed.";
}
