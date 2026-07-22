import { Inject, Injectable, Logger } from "@nestjs/common";
import { AuditActorType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { ReportStorageService } from "./report-storage.service";

@Injectable()
export class ReportExportCleanupService {
  private readonly logger = new Logger(ReportExportCleanupService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ReportStorageService) private readonly storage: ReportStorageService,
  ) {}

  async cleanupExpired(limit = 100): Promise<number> {
    const exports = await this.prisma.reportExport.findMany({
      orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
      select: { expiresAt: true, id: true, storageKey: true },
      take: Math.max(1, Math.min(limit, 500)),
      where: { expiresAt: { lte: new Date() }, storageDeletedAt: null },
    });
    let cleaned = 0;
    for (const reportExport of exports) {
      try {
        await this.storage.remove(reportExport.storageKey);
        const updated = await this.prisma.reportExport.updateMany({
          data: { storageDeletedAt: new Date() },
          where: {
            expiresAt: { lte: new Date() },
            id: reportExport.id,
            storageDeletedAt: null,
          },
        });
        if (updated.count === 1) {
          cleaned += 1;
          await this.recordCleanupAudit(reportExport.id, reportExport.expiresAt);
        }
      } catch {
        this.logger.warn("Expired report export cleanup failed; continuing batch.");
      }
    }
    return cleaned;
  }

  private async recordCleanupAudit(exportId: string, expiresAt: Date): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: "report-export.storage-cleanup",
          actorType: AuditActorType.SYSTEM,
          entityId: exportId,
          entityType: "ReportExport",
          newValue: { expiresAt: expiresAt.toISOString() } as Prisma.InputJsonObject,
        },
      });
    } catch {
      this.logger.warn("Expired report export cleanup audit failed.");
    }
  }
}
