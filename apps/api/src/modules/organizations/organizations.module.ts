import { Module } from "@nestjs/common";

import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { AuthModule } from "../auth/auth.module";
import { RbacModule } from "../rbac/rbac.module";
import { OrganizationsAdminController } from "./organizations-admin.controller";
import { OrganizationsCompanyController } from "./organizations-company.controller";
import { OrganizationsService } from "./organizations.service";

@Module({
  imports: [AuditLogsModule, AuthModule, RbacModule],
  controllers: [OrganizationsAdminController, OrganizationsCompanyController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
