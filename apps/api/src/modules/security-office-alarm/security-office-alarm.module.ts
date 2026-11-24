import { Module } from "@nestjs/common";

import { GatewayCommandsModule } from "../gateway-commands/gateway-commands.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { SecurityOfficeAlarmService } from "./security-office-alarm.service";

@Module({
  exports: [SecurityOfficeAlarmService],
  imports: [PrismaModule, GatewayCommandsModule],
  providers: [SecurityOfficeAlarmService],
})
export class SecurityOfficeAlarmModule {}
