import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ReportType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import type { AuthTokenPayload } from "../../common/auth.types";
import { AUTH_CONTEXT } from "../../common/auth.types";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { PermissionResolverService } from "../rbac/permission-resolver.service";
import { ReportScopeService } from "./report-scope.service";
import { ReportStorageService } from "./report-storage.service";

const gssReportPermissions: Partial<Record<ReportType, string>> = {
  COMPANY_SUMMARY: "reports.company",
  SITE_SUMMARY: "reports.company",
  BUILDING_SUMMARY: "reports.company",
  DEVICE_INVENTORY: "reports.devices",
  DEVICE_ASSIGNMENT_HISTORY: "reports.devices",
  GATEWAY_STATUS_HISTORY: "reports.monitoring",
  NODE_STATUS_HISTORY: "reports.monitoring",
  SENSOR_HISTORY: "reports.monitoring",
  ALARM_HISTORY: "reports.alarms",
  MQTT_COMMAND_HISTORY: "reports.devices",
  USER_ACTIVITY: "reports.audit",
  AUDIT_LOG: "reports.audit",
};

export interface DownloadedReport {
  body: Buffer;
  contentType: string;
  fileName: string;
}

@Injectable()
export class ReportDownloadService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
    @Inject(PermissionResolverService) private readonly permissions: PermissionResolverService,
    @Inject(ReportScopeService) private readonly scope: ReportScopeService,
    @Inject(ReportStorageService) private readonly storage: ReportStorageService,
  ) {}

  async download(auth: AuthTokenPayload, exportId: string): Promise<DownloadedReport> {
    if (!(await this.permissions.hasPermission(auth.context, auth.sub, "reports.export"))) {
      throw new ForbiddenException("The required report export permission is missing.");
    }

    const reportExport = await this.prisma.reportExport.findUnique({
      include: { reportJob: true },
      where: { id: exportId },
    });
    if (!reportExport || reportExport.reportJob.status !== "COMPLETED") {
      throw this.nonDisclosingNotFound();
    }
    if (!(await this.scope.canAccessJob(auth, reportExport.reportJob))) {
      throw this.nonDisclosingNotFound();
    }
    if (auth.context === AUTH_CONTEXT.gssAdmin) {
      const typePermission = gssReportPermissions[reportExport.reportJob.reportType];
      if (
        typePermission &&
        !(await this.permissions.hasPermission(auth.context, auth.sub, typePermission))
      ) {
        throw new ForbiddenException("The required report type permission is missing.");
      }
    } else if (
      reportExport.reportJob.reportType === ReportType.USER_ACTIVITY ||
      reportExport.reportJob.reportType === ReportType.AUDIT_LOG
    ) {
      throw new ForbiddenException("This report type is not available to company users.");
    }
    if (reportExport.expiresAt <= new Date() || reportExport.storageDeletedAt) {
      throw this.nonDisclosingNotFound();
    }

    const object = await this.storage.get(reportExport.storageKey);
    if (!object) throw this.nonDisclosingNotFound();

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.reportExport.update({
        data: { downloadedAt: new Date() },
        where: { id: reportExport.id },
      });
      await this.auditLog.record(
        auth,
        {
          action: "report-export.download",
          entityId: updated.id,
          entityType: "ReportExport",
          newValue: {
            expiresAt: updated.expiresAt.toISOString(),
            fileName: updated.fileName,
            format: updated.format,
            reportJobId: updated.reportJobId,
          } as Prisma.InputJsonObject,
        },
        tx,
      );
    });

    return {
      body: object.body,
      contentType: reportExport.contentType,
      fileName: reportExport.fileName,
    };
  }

  private nonDisclosingNotFound(): NotFoundException {
    return new NotFoundException("The report export was not found.");
  }
}
