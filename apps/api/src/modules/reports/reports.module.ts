import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { AuthModule } from "../auth/auth.module";
import { RbacModule } from "../rbac/rbac.module";
import { ReportDownloadService } from "./report-download.service";
import { ReportExportCleanupService } from "./report-export-cleanup.service";
import { ReportDataQueryService } from "./report-data-query.service";
import { ReportFormattersService } from "./report-formatters.service";
import { ReportGenerationService } from "./report-generation.service";
import { ReportGeneratorsService } from "./report-generators.service";
import { ReportJobProcessorService } from "./report-job-processor.service";
import { ReportsAdminController } from "./reports-admin.controller";
import { ReportsCompanyController } from "./reports-company.controller";
import { ReportsService } from "./reports.service";
import { ReportScopeService } from "./report-scope.service";
import { ReportStorageService } from "./report-storage.service";
import { ReportWorkerService } from "./report-worker.service";

@Module({
  controllers: [ReportsAdminController, ReportsCompanyController],
  exports: [
    ReportGenerationService,
    ReportJobProcessorService,
    ReportExportCleanupService,
    ReportWorkerService,
    ReportStorageService,
    ReportsService,
  ],
  imports: [PrismaModule, AuditLogsModule, AuthModule, RbacModule],
  providers: [
    ReportDownloadService,
    ReportDataQueryService,
    ReportFormattersService,
    ReportGenerationService,
    ReportGeneratorsService,
    ReportJobProcessorService,
    ReportExportCleanupService,
    ReportWorkerService,
    ReportsService,
    ReportScopeService,
    ReportStorageService,
  ],
})
export class ReportsModule {}
