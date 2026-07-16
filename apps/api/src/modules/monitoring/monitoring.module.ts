import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { MqttModule } from "../mqtt/mqtt.module";
import { RbacModule } from "../rbac/rbac.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { MonitoringAdminController } from "./monitoring-admin.controller";
import { MonitoringCompanyController } from "./monitoring-company.controller";
import { MonitoringGateway } from "./monitoring.gateway";
import { MonitoringRealtimeService } from "./monitoring-realtime.service";
import { MonitoringService } from "./monitoring.service";

@Module({
  controllers: [MonitoringAdminController, MonitoringCompanyController],
  exports: [MonitoringService],
  imports: [PrismaModule, AuthModule, RbacModule, MqttModule],
  providers: [MonitoringGateway, MonitoringRealtimeService, MonitoringService],
})
export class MonitoringModule {}
