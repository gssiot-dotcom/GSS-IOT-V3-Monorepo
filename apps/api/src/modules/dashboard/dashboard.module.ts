import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { RbacModule } from "../rbac/rbac.module";
import { ReportsModule } from "../reports/reports.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { DashboardAdminController } from "./dashboard-admin.controller";
import { DashboardCompanyController } from "./dashboard-company.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  controllers: [DashboardAdminController, DashboardCompanyController],
  imports: [PrismaModule, AuthModule, RbacModule, ReportsModule],
  providers: [DashboardService],
})
export class DashboardModule {}
