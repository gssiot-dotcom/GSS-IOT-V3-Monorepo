import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  StreamableFile,
  ValidationPipe,
} from "@nestjs/common";

import type { AuthenticatedRequest } from "../../common/auth.types";
import { CompanyEndpoint } from "../../common/decorators/company-endpoint.decorator";
import { CurrentPrincipal } from "../../common/decorators/current-principal.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { ReportDownloadService } from "./report-download.service";
import { ReportsService } from "./reports.service";
import { ListReportJobsQueryDto, RequestReportExportDto } from "./dto/reports.dto";

@CompanyEndpoint()
@Controller("company")
export class ReportsCompanyController {
  constructor(
    @Inject(ReportDownloadService) private readonly downloads: ReportDownloadService,
    @Inject(ReportsService) private readonly reports: ReportsService,
  ) {}

  @RequirePermissions("reports.view")
  @Get("reports")
  listJobs(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Query(new ValidationPipe({ expectedType: ListReportJobsQueryDto, transform: true }))
    query: ListReportJobsQueryDto,
  ) {
    return this.reports.listJobs(auth!.principal, query);
  }

  @RequirePermissions("reports.view")
  @Get("reports/:jobId")
  getJob(@CurrentPrincipal() auth: AuthenticatedRequest["auth"], @Param("jobId") jobId: string) {
    return this.reports.getJob(auth!.principal, jobId);
  }

  @RequirePermissions("reports.export")
  @Post("reports/export")
  requestExport(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Body(new ValidationPipe({ expectedType: RequestReportExportDto, transform: true }))
    dto: RequestReportExportDto,
  ) {
    return this.reports.requestExport(auth!.principal, dto);
  }

  @RequirePermissions("reports.export")
  @Get("reports/exports/:exportId/download")
  async download(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("exportId") exportId: string,
  ) {
    const report = await this.downloads.download(auth!.principal, exportId);
    return new StreamableFile(report.body, {
      disposition: `attachment; filename="${report.fileName}"`,
      type: report.contentType,
    });
  }
}
