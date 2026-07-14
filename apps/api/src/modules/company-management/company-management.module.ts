import { Module } from "@nestjs/common";

import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { AuthModule } from "../auth/auth.module";
import { RbacModule } from "../rbac/rbac.module";
import { CompanyManagementAdminController } from "./company-management-admin.controller";
import { CompanyManagementCompanyController } from "./company-management-company.controller";
import { CompanyManagementService } from "./company-management.service";

@Module({
  imports: [AuditLogsModule, AuthModule, RbacModule],
  controllers: [CompanyManagementAdminController, CompanyManagementCompanyController],
  providers: [CompanyManagementService],
})
export class CompanyManagementModule {}
