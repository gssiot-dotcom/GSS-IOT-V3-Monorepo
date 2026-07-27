import { Module } from "@nestjs/common";

import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { AuthModule } from "../auth/auth.module";
import { CompanyBrandingModule } from "../company-branding/company-branding.module";
import { RbacModule } from "../rbac/rbac.module";
import { PrivateAssetsModule } from "../private-assets/private-assets.module";
import { BuildingImagesService } from "./building-images.service";
import { OrganizationsAdminController } from "./organizations-admin.controller";
import { OrganizationsCompanyController } from "./organizations-company.controller";
import { OrganizationsService } from "./organizations.service";

@Module({
  imports: [AuditLogsModule, AuthModule, CompanyBrandingModule, PrivateAssetsModule, RbacModule],
  controllers: [OrganizationsAdminController, OrganizationsCompanyController],
  providers: [BuildingImagesService, OrganizationsService],
  exports: [BuildingImagesService, OrganizationsService],
})
export class OrganizationsModule {}
