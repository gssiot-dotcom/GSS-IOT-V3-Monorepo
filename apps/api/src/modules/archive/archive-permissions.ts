import { ArchiveEntityType } from "@prisma/client";

export const archiveDomainPermission: Record<ArchiveEntityType, string> = {
  [ArchiveEntityType.COMPANY]: "companies.delete",
  [ArchiveEntityType.CONSTRUCTION_AREA]: "areas.delete",
  [ArchiveEntityType.CONSTRUCTION_BUILDING]: "buildings.delete",
  [ArchiveEntityType.COMPANY_USER]: "company-users.delete",
  [ArchiveEntityType.COMPANY_POSITION]: "company-users.manage",
  [ArchiveEntityType.COMPANY_ROLE]: "company-roles.manage",
  [ArchiveEntityType.ALARM_RULE]: "alarm-rules.manage",
  [ArchiveEntityType.ALARM_RECIPIENT_POLICY]: "alarm-rules.manage",
  [ArchiveEntityType.ALARM_EVENT]: "alarms.manage",
  [ArchiveEntityType.ALARM_NOTIFICATION]: "notifications.manage",
  [ArchiveEntityType.GATEWAY_COMMAND]: "mqtt-commands.manage",
  [ArchiveEntityType.SENSOR_READING_FILTER]: "sensor-readings.purge",
};
