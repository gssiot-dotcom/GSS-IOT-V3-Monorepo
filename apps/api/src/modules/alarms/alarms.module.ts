import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { AuthModule } from "../auth/auth.module";
import { RbacModule } from "../rbac/rbac.module";
import { AlarmDomainEventsService } from "./alarm-domain-events.service";
import { AlarmNotificationDispatchService } from "./alarm-notification-dispatch.service";
import { AlarmOccurrenceEvaluatorService } from "./alarm-occurrence-evaluator.service";
import { AlarmRealtimeService } from "./alarm-realtime.service";
import { AlarmsAdminController } from "./alarms-admin.controller";
import { AlarmsCompanyController } from "./alarms-company.controller";
import { AlarmsService } from "./alarms.service";

@Module({
  controllers: [AlarmsAdminController, AlarmsCompanyController],
  exports: [AlarmDomainEventsService, AlarmOccurrenceEvaluatorService, AlarmRealtimeService],
  imports: [PrismaModule, AuthModule, RbacModule, AuditLogsModule],
  providers: [
    AlarmDomainEventsService,
    AlarmNotificationDispatchService,
    AlarmOccurrenceEvaluatorService,
    AlarmRealtimeService,
    AlarmsService,
  ],
})
export class AlarmsModule {}
