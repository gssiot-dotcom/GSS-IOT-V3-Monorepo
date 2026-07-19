import { Module } from "@nestjs/common";

import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { AuthModule } from "../auth/auth.module";
import { GatewayCommandsModule } from "../gateway-commands/gateway-commands.module";
import { RbacModule } from "../rbac/rbac.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { AlarmLevelsAdminController } from "./alarm-levels-admin.controller";
import { AlarmLevelsCompanyController } from "./alarm-levels-company.controller";
import { AlarmLevelsService } from "./alarm-levels.service";

@Module({
  controllers: [AlarmLevelsAdminController, AlarmLevelsCompanyController],
  exports: [AlarmLevelsService],
  imports: [PrismaModule, AuditLogsModule, AuthModule, RbacModule, GatewayCommandsModule],
  providers: [AlarmLevelsService],
})
export class AlarmLevelsModule {}
