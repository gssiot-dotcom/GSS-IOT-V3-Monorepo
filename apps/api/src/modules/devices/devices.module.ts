import { Module } from "@nestjs/common";

import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { AuthModule } from "../auth/auth.module";
import { RbacModule } from "../rbac/rbac.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { DevicesAdminController } from "./devices-admin.controller";
import { DevicesCompanyController } from "./devices-company.controller";
import { DevicesService } from "./devices.service";

@Module({
  controllers: [DevicesAdminController, DevicesCompanyController],
  imports: [PrismaModule, AuditLogsModule, AuthModule, RbacModule],
  providers: [DevicesService],
})
export class DevicesModule {}
