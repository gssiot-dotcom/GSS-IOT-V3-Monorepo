import { Module } from "@nestjs/common";

import { HealthController } from "./health.controller";
import { AuthModule } from "./modules/auth/auth.module";
import { AuditLogsModule } from "./modules/audit-logs/audit-logs.module";
import { AlarmLevelsModule } from "./modules/alarm-levels/alarm-levels.module";
import { AlarmsModule } from "./modules/alarms/alarms.module";
import { CompanyManagementModule } from "./modules/company-management/company-management.module";
import { CompanyBrandingModule } from "./modules/company-branding/company-branding.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { DevicesModule } from "./modules/devices/devices.module";
import { GatewayCommandsModule } from "./modules/gateway-commands/gateway-commands.module";
import { MonitoringModule } from "./modules/monitoring/monitoring.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    PrismaModule,
    RbacModule,
    AuthModule,
    AuditLogsModule,
    AlarmLevelsModule,
    AlarmsModule,
    OrganizationsModule,
    CompanyBrandingModule,
    CompanyManagementModule,
    DashboardModule,
    DevicesModule,
    GatewayCommandsModule,
    MonitoringModule,
    ReportsModule,
    SettingsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
