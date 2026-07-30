import { forwardRef, Module } from "@nestjs/common";

import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { AuthModule } from "../auth/auth.module";
import { RbacModule } from "../rbac/rbac.module";
import { PrivateAssetsModule } from "../private-assets/private-assets.module";
import { ReportsModule } from "../reports/reports.module";
import { ArchiveAdminController } from "./archive-admin.controller";
import { ArchiveDomainPurgeService } from "./archive-domain-purge.service";
import { ArchiveJobProcessorService } from "./archive-job-processor.service";
import { ArchiveJobsService } from "./archive-jobs.service";
import { ArchiveQueryService } from "./archive-query.service";
import { ArchiveReconciliationService } from "./archive-reconciliation.service";

@Module({
  controllers: [ArchiveAdminController],
  exports: [ArchiveQueryService],
  imports: [
    AuditLogsModule,
    AuthModule,
    PrivateAssetsModule,
    RbacModule,
    forwardRef(() => ReportsModule),
  ],
  providers: [
    ArchiveDomainPurgeService,
    ArchiveJobProcessorService,
    ArchiveJobsService,
    ArchiveQueryService,
    ArchiveReconciliationService,
  ],
})
export class ArchiveModule {}
