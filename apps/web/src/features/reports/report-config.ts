import type { ReportType } from "@gss-iot/contracts";

export const REPORT_TYPES: ReportType[] = [
  "COMPANY_SUMMARY",
  "SITE_SUMMARY",
  "BUILDING_SUMMARY",
  "DEVICE_INVENTORY",
  "DEVICE_ASSIGNMENT_HISTORY",
  "GATEWAY_STATUS_HISTORY",
  "NODE_STATUS_HISTORY",
  "SENSOR_HISTORY",
  "ALARM_HISTORY",
  "MQTT_COMMAND_HISTORY",
  "USER_ACTIVITY",
  "AUDIT_LOG",
  "ARCHIVE_EVIDENCE",
];

export const COMPANY_REPORT_TYPES: ReportType[] = REPORT_TYPES.filter(
  (reportType) =>
    reportType !== "USER_ACTIVITY" &&
    reportType !== "AUDIT_LOG" &&
    reportType !== "ARCHIVE_EVIDENCE",
);

export const GSS_REPORT_TYPE_PERMISSIONS: Partial<Record<ReportType, string>> = {
  COMPANY_SUMMARY: "reports.company",
  SITE_SUMMARY: "reports.company",
  BUILDING_SUMMARY: "reports.company",
  DEVICE_INVENTORY: "reports.devices",
  DEVICE_ASSIGNMENT_HISTORY: "reports.devices",
  GATEWAY_STATUS_HISTORY: "reports.monitoring",
  NODE_STATUS_HISTORY: "reports.monitoring",
  SENSOR_HISTORY: "reports.monitoring",
  ALARM_HISTORY: "reports.alarms",
  MQTT_COMMAND_HISTORY: "reports.devices",
  USER_ACTIVITY: "reports.audit",
  AUDIT_LOG: "reports.audit",
  ARCHIVE_EVIDENCE: "archive.view",
};

export const REPORT_DATE_FILTER_TYPES = new Set<ReportType>([
  "DEVICE_ASSIGNMENT_HISTORY",
  "GATEWAY_STATUS_HISTORY",
  "NODE_STATUS_HISTORY",
  "SENSOR_HISTORY",
  "ALARM_HISTORY",
  "MQTT_COMMAND_HISTORY",
  "USER_ACTIVITY",
  "AUDIT_LOG",
  "ARCHIVE_EVIDENCE",
]);

export const REPORT_DEVICE_FILTER_TYPES = new Set<ReportType>([
  "DEVICE_INVENTORY",
  "DEVICE_ASSIGNMENT_HISTORY",
  "GATEWAY_STATUS_HISTORY",
  "NODE_STATUS_HISTORY",
  "SENSOR_HISTORY",
  "ALARM_HISTORY",
  "MQTT_COMMAND_HISTORY",
]);

export const REPORT_LIMITS = {
  maxDateRangeDays: 366,
  maxSensorHistoryDays: 31,
} as const;

export function reportTypePermission(reportType: ReportType, isAdmin: boolean): string | undefined {
  return isAdmin ? GSS_REPORT_TYPE_PERMISSIONS[reportType] : undefined;
}

export function supportsDateFilters(reportType: ReportType): boolean {
  return REPORT_DATE_FILTER_TYPES.has(reportType);
}

export function supportsDeviceFilters(reportType: ReportType): boolean {
  return REPORT_DEVICE_FILTER_TYPES.has(reportType);
}

export function maxDateRangeDays(reportType: ReportType): number {
  return reportType === "SENSOR_HISTORY"
    ? REPORT_LIMITS.maxSensorHistoryDays
    : REPORT_LIMITS.maxDateRangeDays;
}
