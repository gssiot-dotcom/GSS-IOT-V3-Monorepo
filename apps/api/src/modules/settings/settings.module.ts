import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { AuthModule } from "../auth/auth.module";
import { MqttModule } from "../mqtt/mqtt.module";
import { RbacModule } from "../rbac/rbac.module";
import { ReportsModule } from "../reports/reports.module";
import { CompanySettingsService } from "./company-settings.service";
import { GssAdminUserService } from "./gss-admin-user.service";
import { GssRoleService } from "./gss-role.service";
import { SettingsAdminController } from "./settings-admin.controller";
import { SettingsCompanyController } from "./settings-company.controller";
import { SystemSettingsService } from "./system-settings.service";

@Module({
  controllers: [SettingsAdminController, SettingsCompanyController],
  imports: [PrismaModule, AuditLogsModule, AuthModule, MqttModule, RbacModule, ReportsModule],
  providers: [CompanySettingsService, GssAdminUserService, GssRoleService, SystemSettingsService],
})
export class SettingsModule {}
