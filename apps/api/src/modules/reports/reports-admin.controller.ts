import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  StreamableFile,
  ValidationPipe,
} from "@nestjs/common";

import type { AuthenticatedRequest } from "../../common/auth.types";
import { AdminEndpoint } from "../../common/decorators/admin-endpoint.decorator";
import { CurrentPrincipal } from "../../common/decorators/current-principal.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { ReportDownloadService } from "./report-download.service";
import { ReportsService } from "./reports.service";
import { attachmentDisposition } from "./report-localization";
import { ListReportJobsQueryDto, RequestReportExportDto } from "./dto/reports.dto";

@AdminEndpoint()
@Controller("admin")
export class ReportsAdminController {
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

  @Get("reports/:jobId")
  getJob(@CurrentPrincipal() auth: AuthenticatedRequest["auth"], @Param("jobId") jobId: string) {
    return this.reports.getJob(auth!.principal, jobId);
  }

  @RequirePermissions("reports.export")
  @Post("reports/export")
  requestExport(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Headers("accept-language") acceptLanguage: string | undefined,
    @Body(new ValidationPipe({ expectedType: RequestReportExportDto, transform: true }))
    dto: RequestReportExportDto,
  ) {
    return this.reports.requestExport(auth!.principal, dto, acceptLanguage);
  }

  @RequirePermissions("reports.export")
  @Get("reports/exports/:exportId/download")
  async download(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("exportId") exportId: string,
  ) {
    const report = await this.downloads.download(auth!.principal, exportId);
    return new StreamableFile(report.body, {
      disposition: attachmentDisposition(report.fileName),
      type: report.contentType,
    });
  }
}
