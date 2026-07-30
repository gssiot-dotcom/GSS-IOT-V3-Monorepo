import { ReportType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export interface ReportColumn {
  key: string;
  header: string;
}

export type ReportValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | ReportValue[]
  | {
      [key: string]: ReportValue;
    };

export interface NormalizedReportDataset {
  columns: ReportColumn[];
  rows: Record<string, ReportValue>[];
}

export interface ReportExecutionScope {
  companyId?: string;
  areaId?: string;
  buildingId?: string;
  allowedAreaIds?: string[];
  allowedBuildingIds?: string[];
}

export interface ReportJobForExecution {
  id: string;
  requestedByType: "GSS_ADMIN" | "COMPANY_USER";
  requestedById: string;
  reportType: ReportType;
  filters: Prisma.JsonValue;
  companyId: string | null;
  areaId: string | null;
  buildingId: string | null;
  scopeSnapshot: Prisma.JsonValue;
}

export const REPORT_LIMITS = {
  maxRows: 10_000,
  maxDateRangeDays: 366,
  maxSensorHistoryDays: 31,
} as const;

export const REPORT_DATE_FILTER_TYPES = new Set<ReportType>([
  ReportType.DEVICE_ASSIGNMENT_HISTORY,
  ReportType.GATEWAY_STATUS_HISTORY,
  ReportType.NODE_STATUS_HISTORY,
  ReportType.SENSOR_HISTORY,
  ReportType.ALARM_HISTORY,
  ReportType.MQTT_COMMAND_HISTORY,
  ReportType.USER_ACTIVITY,
  ReportType.AUDIT_LOG,
  ReportType.ARCHIVE_EVIDENCE,
]);

export function reportExecutionScope(job: ReportJobForExecution): ReportExecutionScope {
  const snapshot = readObject(job.scopeSnapshot);
  return {
    allowedAreaIds: readStringArray(snapshot.allowedAreaIds),
    allowedBuildingIds: readStringArray(snapshot.allowedBuildingIds),
    areaId: job.areaId ?? readString(snapshot.areaId),
    buildingId: job.buildingId ?? readString(snapshot.buildingId),
    companyId: job.companyId ?? readString(snapshot.companyId),
  };
}

export function reportFilters(value: Prisma.JsonValue): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function readObject(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : {};
}

function readString(value: Prisma.JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readStringArray(value: Prisma.JsonValue | undefined): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}
