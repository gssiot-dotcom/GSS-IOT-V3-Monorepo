import { Module } from "@nestjs/common";

import { HealthController } from "./health.controller";
import { AuthModule } from "./modules/auth/auth.module";
import { AuditLogsModule } from "./modules/audit-logs/audit-logs.module";
import { CompanyManagementModule } from "./modules/company-management/company-management.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    PrismaModule,
    RbacModule,
    AuthModule,
    AuditLogsModule,
    OrganizationsModule,
    CompanyManagementModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
