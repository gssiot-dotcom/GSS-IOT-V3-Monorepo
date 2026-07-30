import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { AlarmsModule } from "../alarms/alarms.module";
import { MqttModule } from "../mqtt/mqtt.module";
import { RbacModule } from "../rbac/rbac.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { MonitoringAdminController } from "./monitoring-admin.controller";
import {
  CompanySensorHistoryController,
  MonitoringCompanyController,
} from "./monitoring-company.controller";
import { MonitoringGateway } from "./monitoring.gateway";
import { MonitoringRealtimeService } from "./monitoring-realtime.service";
import { MonitoringService } from "./monitoring.service";
import { SensorReadingRetentionService } from "./sensor-reading-retention.service";

@Module({
  controllers: [
    CompanySensorHistoryController,
    MonitoringAdminController,
    MonitoringCompanyController,
  ],
  exports: [MonitoringService, SensorReadingRetentionService],
  imports: [PrismaModule, AuthModule, RbacModule, MqttModule, AlarmsModule],
  providers: [
    MonitoringGateway,
    MonitoringRealtimeService,
    MonitoringService,
    SensorReadingRetentionService,
  ],
})
export class MonitoringModule {}
