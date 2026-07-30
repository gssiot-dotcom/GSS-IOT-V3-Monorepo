import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ReportJobStatus, ReportType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import type { AuthTokenPayload } from "../../common/auth.types";
import { AUTH_CONTEXT } from "../../common/auth.types";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { PermissionResolverService } from "../rbac/permission-resolver.service";
import type {
  ListReportJobsQueryDto,
  ReportFiltersDto,
  RequestReportExportDto,
} from "./dto/reports.dto";
import { ReportScopeService } from "./report-scope.service";
import { normalizeReportLocale } from "./report-localization";
import { REPORT_DATE_FILTER_TYPES, REPORT_LIMITS } from "./report-types";

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
  ARCHIVE_EVIDENCE: "archive.view",
};

const companyUnsupportedReportTypes = new Set<ReportType>([
  ReportType.USER_ACTIVITY,
  ReportType.AUDIT_LOG,
  ReportType.ARCHIVE_EVIDENCE,
]);

@Injectable()
export class ReportsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
    @Inject(PermissionResolverService) private readonly permissions: PermissionResolverService,
    @Inject(ReportScopeService) private readonly scope: ReportScopeService,
  ) {}

  async listJobs(auth: AuthTokenPayload, query: ListReportJobsQueryDto) {
    await this.assertReportPermission(auth, "reports.view");
    if (query.reportType) await this.assertReportTypePermission(auth, query.reportType);

    const filters: ReportFiltersDto = {
      areaId: query.areaId,
      buildingId: query.buildingId,
      companyId: query.companyId,
    };
    const resolvedScope = await this.scope.resolve(auth, filters);
    const where: Prisma.ReportJobWhereInput = {
      areaId: query.areaId,
      buildingId: query.buildingId,
      companyId: query.companyId,
      reportType: query.reportType,
      status: query.status,
    };

    if (auth.context === AUTH_CONTEXT.companyUser) {
      where.companyId = resolvedScope.companyId;
      where.requestedByType = "COMPANY_USER";
      where.OR = [
        { buildingId: { in: resolvedScope.allowedBuildingIds ?? [] } },
        {
          areaId: { in: resolvedScope.allowedAreaIds ?? [] },
          buildingId: null,
        },
        { areaId: null, buildingId: null },
      ];
    }

    const jobs =
      auth.context === AUTH_CONTEXT.companyUser
        ? await this.prisma.reportJob.findMany({
            include: { exports: { orderBy: { createdAt: "desc" } } },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 500,
            where,
          })
        : await this.prisma.reportJob.findMany({
            include: { exports: { orderBy: { createdAt: "desc" } } },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            where,
          });
    const accessibleJobs =
      auth.context === AUTH_CONTEXT.companyUser
        ? (
            await Promise.all(
              jobs.map(async (job) => ((await this.scope.canAccessJob(auth, job)) ? job : null)),
            )
          ).filter((job): job is (typeof jobs)[number] => job !== null)
        : jobs;
    const pagedJobs =
      auth.context === AUTH_CONTEXT.companyUser
        ? accessibleJobs.slice((query.page - 1) * query.pageSize, query.page * query.pageSize)
        : accessibleJobs;

    return {
      items: pagedJobs.map((job) => this.mapJob(job)),
      page: query.page,
      pageSize: query.pageSize,
      total:
        auth.context === AUTH_CONTEXT.companyUser
          ? accessibleJobs.length
          : await this.prisma.reportJob.count({ where }),
    };
  }

  async getJob(auth: AuthTokenPayload, jobId: string) {
    const job = await this.prisma.reportJob.findUnique({
      include: { exports: { orderBy: { createdAt: "desc" } } },
      where: { id: jobId },
    });
    if (!job || !(await this.scope.canAccessJob(auth, job))) {
      throw this.nonDisclosingNotFound();
    }
    await this.assertReportPermission(
      auth,
      job.reportType === ReportType.ARCHIVE_EVIDENCE ? "archive.view" : "reports.view",
    );
    await this.assertReportTypePermission(auth, job.reportType);
    return this.mapJob(job);
  }

  async requestExport(
    auth: AuthTokenPayload,
    dto: RequestReportExportDto,
    acceptLanguage?: string,
  ) {
    await this.assertReportPermission(auth, "reports.export");
    await this.assertReportTypePermission(auth, dto.reportType);
    if (auth.context === AUTH_CONTEXT.companyUser && dto.filters?.companyId) {
      throw new ForbiddenException(
        "Company report requests derive company scope from the authenticated user.",
      );
    }
    this.validateFilters(dto.reportType, dto.filters);
    const scope = await this.scope.resolve(auth, dto.filters ?? {});
    const filters = this.normalizeFilters(
      dto.filters,
      dto.format,
      normalizeReportLocale(acceptLanguage),
    );
    const requestedByType = auth.context === AUTH_CONTEXT.gssAdmin ? "GSS_ADMIN" : "COMPANY_USER";

    const job = await this.prisma.$transaction(async (tx) => {
      const created = await tx.reportJob.create({
        data: {
          areaId: scope.areaId,
          buildingId: scope.buildingId,
          companyId: scope.companyId,
          filters,
          reportType: dto.reportType,
          requestedById: auth.sub,
          requestedByType,
          scopeSnapshot: scope.snapshot,
          status: ReportJobStatus.PENDING,
        },
        include: { exports: true },
      });
      await this.auditLog.record(
        auth,
        {
          action: "report-job.create",
          entityId: created.id,
          entityType: "ReportJob",
          newValue: this.auditJson(created),
        },
        tx,
      );
      return created;
    });

    return this.mapJob(job);
  }

  private async assertReportPermission(auth: AuthTokenPayload, permission: string): Promise<void> {
    if (!(await this.permissions.hasPermission(auth.context, auth.sub, permission))) {
      throw new ForbiddenException("The required report permission is missing.");
    }
  }

  private async assertReportTypePermission(
    auth: AuthTokenPayload,
    reportType: ReportType,
  ): Promise<void> {
    if (auth.context === AUTH_CONTEXT.companyUser) {
      if (companyUnsupportedReportTypes.has(reportType)) {
        throw new ForbiddenException("This report type is not available to company users.");
      }
      return;
    }
    const permission = gssReportPermissions[reportType];
    if (permission) await this.assertReportPermission(auth, permission);
  }

  private validateFilters(reportType: ReportType, filters?: ReportFiltersDto): void {
    const accepted = new Set<string>(["companyId", "areaId", "buildingId"]);
    if (reportType === ReportType.ARCHIVE_EVIDENCE) {
      ["archiveEntityType", "archivedFrom", "archivedTo", "archivedBy", "search"].forEach((key) =>
        accepted.add(key),
      );
    }
    if (
      [
        ReportType.DEVICE_INVENTORY,
        ReportType.DEVICE_ASSIGNMENT_HISTORY,
        ReportType.GATEWAY_STATUS_HISTORY,
        ReportType.NODE_STATUS_HISTORY,
        ReportType.SENSOR_HISTORY,
        ReportType.ALARM_HISTORY,
        ReportType.MQTT_COMMAND_HISTORY,
      ].some((type) => type === reportType)
    ) {
      ["areaId", "buildingId", "gatewayId", "nodeTypeId", "nodeId"].forEach((key) =>
        accepted.add(key),
      );
    }
    if (REPORT_DATE_FILTER_TYPES.has(reportType)) {
      accepted.add("from");
      accepted.add("to");
    }
    for (const [key, value] of Object.entries(filters ?? {})) {
      if (value === undefined) continue;
      if (!accepted.has(key))
        throw new BadRequestException(`The ${key} filter is not supported for this report type.`);
    }
    const fromValue = filters?.from ?? filters?.archivedFrom;
    const toValue = filters?.to ?? filters?.archivedTo;
    const from = fromValue ? new Date(fromValue) : undefined;
    const to = toValue ? new Date(toValue) : undefined;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
      throw new BadRequestException("The report date range is invalid.");
    }
    if (from && to && from > to) {
      throw new BadRequestException("The report date range is invalid.");
    }
    if (from && to) {
      const days = (to.getTime() - from.getTime()) / 86_400_000;
      const maxDays =
        reportType === ReportType.SENSOR_HISTORY
          ? REPORT_LIMITS.maxSensorHistoryDays
          : REPORT_LIMITS.maxDateRangeDays;
      if (days > maxDays)
        throw new BadRequestException(`The report date range cannot exceed ${maxDays} days.`);
    }
  }

  private normalizeFilters(
    filters: ReportFiltersDto | undefined,
    format: RequestReportExportDto["format"],
    locale: "en-US" | "ko-KR",
  ): Prisma.InputJsonObject {
    return Object.fromEntries(
      [...Object.entries(filters ?? {}), ["format", format], ["locale", locale]].filter(
        ([, value]) => value !== undefined,
      ),
    ) as Prisma.InputJsonObject;
  }

  private mapJob(job: Prisma.ReportJobGetPayload<{ include: { exports: true } }>) {
    return {
      areaId: job.areaId,
      buildingId: job.buildingId,
      companyId: job.companyId,
      completedAt: job.completedAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
      errorMessage: job.errorMessage,
      exports: job.exports.map((reportExport) => ({
        contentType: reportExport.contentType,
        createdAt: reportExport.createdAt.toISOString(),
        createdByType: reportExport.createdByType,
        downloadedAt: reportExport.downloadedAt?.toISOString() ?? null,
        expiresAt: reportExport.expiresAt.toISOString(),
        fileName: reportExport.fileName,
        format: reportExport.format,
        id: reportExport.id,
        sizeBytes: reportExport.sizeBytes,
      })),
      filters: job.filters,
      id: job.id,
      progress: job.progress,
      reportType: job.reportType,
      requestedById: job.requestedById,
      requestedByType: job.requestedByType,
      status: job.status,
      updatedAt: job.updatedAt.toISOString(),
    };
  }

  private auditJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private nonDisclosingNotFound(): NotFoundException {
    return new NotFoundException("The report resource was not found.");
  }
}
