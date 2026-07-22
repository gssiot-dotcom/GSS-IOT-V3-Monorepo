import { Inject, Injectable } from "@nestjs/common";
import { ReportType } from "@prisma/client";

import type { NormalizedReportDataset, ReportJobForExecution } from "./report-types";
import { ReportDataQueryService } from "./report-data-query.service";
import { reportExecutionScope, reportFilters } from "./report-types";

/**
 * Report-type generation boundary. Query services own database predicates; this service keeps
 * orchestration independent from CSV/XLSX serialization and storage.
 */
@Injectable()
export class ReportGeneratorsService {
  constructor(@Inject(ReportDataQueryService) private readonly queries: ReportDataQueryService) {}

  generate(job: ReportJobForExecution): Promise<NormalizedReportDataset> {
    const scope = reportExecutionScope(job);
    const filters = reportFilters(job.filters);
    switch (job.reportType) {
      case ReportType.COMPANY_SUMMARY:
        return this.queries.companySummary(scope);
      case ReportType.SITE_SUMMARY:
        return this.queries.siteSummary(scope);
      case ReportType.BUILDING_SUMMARY:
        return this.queries.buildingSummary(scope);
      case ReportType.DEVICE_INVENTORY:
        return this.queries.deviceInventory(scope, filters);
      case ReportType.DEVICE_ASSIGNMENT_HISTORY:
        return this.queries.deviceAssignmentHistory(scope, filters);
      case ReportType.GATEWAY_STATUS_HISTORY:
        return this.queries.gatewayStatus(scope, filters);
      case ReportType.NODE_STATUS_HISTORY:
        return this.queries.nodeStatus(scope, filters);
      case ReportType.SENSOR_HISTORY:
        return this.queries.sensorHistory(scope, filters);
      case ReportType.ALARM_HISTORY:
        return this.queries.alarmHistory(scope, filters);
      case ReportType.MQTT_COMMAND_HISTORY:
        return this.queries.commandHistory(scope, filters);
      case ReportType.USER_ACTIVITY:
      case ReportType.AUDIT_LOG:
        return this.queries.auditHistory(filters);
    }
  }
}
