import { Module } from "@nestjs/common";

import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { AuthModule } from "../auth/auth.module";
import { RbacModule } from "../rbac/rbac.module";
import {
  CompanyBrandingAdminController,
  CompanyBrandingCompanyController,
} from "./company-branding.controllers";
import { CompanyBrandingService } from "./company-branding.service";
import { CompanyLogoStorageService } from "./company-logo-storage.service";

@Module({
  controllers: [CompanyBrandingAdminController, CompanyBrandingCompanyController],
  exports: [CompanyBrandingService, CompanyLogoStorageService],
  imports: [AuditLogsModule, AuthModule, RbacModule],
  providers: [CompanyBrandingService, CompanyLogoStorageService],
})
export class CompanyBrandingModule {}
