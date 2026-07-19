import { SensorReadingStatus } from "@prisma/client";
import type {
  MonitoringNodeStateRecord,
  MonitoringStatus,
  SensorReadingRecord,
  SensorValues,
} from "@gss-iot/contracts";

const statusFromPrisma = {
  CAUTION: "caution",
  DANGER: "danger",
  OFFLINE: "offline",
  SAFE: "safe",
  UNCONFIGURED: "unconfigured",
  WARNING: "warning",
} satisfies Record<SensorReadingStatus, MonitoringStatus>;

const statusToPrisma = {
  caution: SensorReadingStatus.CAUTION,
  danger: SensorReadingStatus.DANGER,
  offline: SensorReadingStatus.OFFLINE,
  safe: SensorReadingStatus.SAFE,
  unconfigured: SensorReadingStatus.UNCONFIGURED,
  warning: SensorReadingStatus.WARNING,
} satisfies Record<MonitoringStatus, SensorReadingStatus>;

export function toPrismaStatus(status: MonitoringStatus): SensorReadingStatus {
  return statusToPrisma[status];
}

export function toContractStatus(status: SensorReadingStatus): MonitoringStatus {
  return statusFromPrisma[status];
}

export function toSensorValues(value: unknown): SensorValues {
  return value as SensorValues;
}

export function roomName(buildingId: string, nodeType: string): string {
  return `monitoring:building:${buildingId}:node-type:${nodeType}`;
}

export function mapLatestState(state: {
  areaId: string;
  building: { id: string; title: string };
  buildingId: string;
  companyId: string;
  gateway: { id: string; serialNumber: string };
  gatewayId: string;
  lastSeenAt: Date;
  node: { id: string; installedLocation: string | null; number: string };
  nodeId: string;
  nodeType: {
    displayName: string;
    id: string;
    imageAssetKey: string;
    key: string;
    numericCode: number;
  };
  nodeTypeId: string;
  status: SensorReadingStatus;
  classificationEvidence: unknown;
  faultFiltered: boolean;
  updatedAt: Date;
  values: unknown;
}): MonitoringNodeStateRecord {
  return {
    areaId: state.areaId,
    building: state.building,
    buildingId: state.buildingId,
    companyId: state.companyId,
    gateway: state.gateway,
    gatewayId: state.gatewayId,
    lastSeenAt: state.lastSeenAt.toISOString(),
    node: state.node,
    nodeId: state.nodeId,
    nodeType: state.nodeType,
    nodeTypeId: state.nodeTypeId,
    status: toContractStatus(state.status),
    classificationEvidence: state.classificationEvidence as never,
    faultFiltered: state.faultFiltered,
    updatedAt: state.updatedAt.toISOString(),
    values: toSensorValues(state.values),
  };
}

export function mapSensorReading(reading: {
  buildingId: string;
  gateway: { id: string; serialNumber: string };
  gatewayId: string;
  id: string;
  measuredAt: Date | null;
  node: { id: string; installedLocation: string | null; number: string };
  nodeId: string;
  nodeType: {
    displayName: string;
    id: string;
    imageAssetKey: string;
    key: string;
    numericCode: number;
  };
  nodeTypeId: string;
  receivedAt: Date;
  status: SensorReadingStatus;
  classificationEvidence: unknown;
  faultFiltered: boolean;
  values: unknown;
}): SensorReadingRecord {
  return {
    buildingId: reading.buildingId,
    gateway: reading.gateway,
    gatewayId: reading.gatewayId,
    id: reading.id,
    measuredAt: reading.measuredAt?.toISOString() ?? null,
    node: reading.node,
    nodeId: reading.nodeId,
    nodeType: reading.nodeType,
    nodeTypeId: reading.nodeTypeId,
    receivedAt: reading.receivedAt.toISOString(),
    status: toContractStatus(reading.status),
    classificationEvidence: reading.classificationEvidence as never,
    faultFiltered: reading.faultFiltered,
    values: toSensorValues(reading.values),
  };
}
