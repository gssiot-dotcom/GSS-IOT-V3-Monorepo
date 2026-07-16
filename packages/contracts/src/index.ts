export const HEALTH_STATUS = {
  ok: "ok",
} as const;

export type HealthStatus = (typeof HEALTH_STATUS)[keyof typeof HEALTH_STATUS];

export interface HealthResponse {
  service: "api";
  status: HealthStatus;
}

export const AUTH_CONTEXT = {
  gssAdmin: "gss-admin",
  companyUser: "company-user",
} as const;

export type AuthContext = (typeof AUTH_CONTEXT)[keyof typeof AUTH_CONTEXT];

export interface AuthenticatedUser {
  companyId?: string;
  email: string;
  id: string;
  isSuperAdmin: boolean;
  name: string;
  permissions: string[];
}

export interface AuthSession {
  accessToken: string;
  context: AuthContext;
  user: AuthenticatedUser;
}

export type CompanyStatus = "ACTIVE" | "INACTIVE";
export type AccessLevel = "VIEW" | "MANAGE";
export type PermissionEffect = "ALLOW" | "DENY";
export type DeviceLifecycleStatus = "ACTIVE" | "INACTIVE" | "RETIRED";
export type GatewayType = "NODES_GATEWAY" | "SECURITY_OFFICE_GATEWAY";
export type GatewayCommandStatus =
  "PENDING" | "SENT" | "ACKNOWLEDGED" | "FAILED" | "EXPIRED" | "CANCELLED";
export type GatewayCommandType =
  "REGISTER_NODES" | "WAKE_SECURITY" | "SET_ALARM_LEVELS" | "SET_FAULT_FILTER";
export type CanonicalNodeType = "door_node" | "angle_node" | "gangform_node";
export type MonitoringStatus = "safe" | "caution" | "warning" | "danger" | "offline";

export interface DoorSensorValues {
  batteryLevel: number | null;
  doorState: "closed" | "open";
}

export interface AngleSensorValues {
  angleX: number;
  angleY: number;
}

export type SensorValues = DoorSensorValues | AngleSensorValues;

export interface CompanyRecord {
  id: string;
  name: string;
  code: string | null;
  status: CompanyStatus;
  address: string | null;
  email: string | null;
  phone: string | null;
}

export interface AreaRecord {
  id: string;
  companyId: string;
  name: string;
  address: string | null;
  description: string | null;
  status: CompanyStatus;
}

export interface BuildingRecord {
  id: string;
  companyId: string;
  areaId: string;
  title: string;
  number: string | null;
  address: string | null;
  buildingType: string | null;
  status: CompanyStatus;
}

export interface CompanyRoleRecord {
  id: string;
  companyId: string | null;
  key: string;
  name: string;
  isCompanyOwnerRole: boolean;
  permissions: { permissionId: string }[];
}

export interface CompanyUserRecord {
  id: string;
  companyId: string;
  roleId: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  role: Pick<CompanyRoleRecord, "id" | "key" | "name" | "isCompanyOwnerRole">;
}

export interface CompanyPositionRecord {
  id: string;
  companyId: string;
  key: string;
  name: string;
  isActive: boolean;
}

export interface CompanyPermissionRecord {
  id: string;
  key: string;
  module: string;
  action: string;
}

export interface NodeTypeRecord {
  id: string;
  key: "door_node" | "angle_node" | "gangform_node" | string;
  displayName: string;
  numericCode: number;
  imageAssetKey: string;
}

export interface ActiveCompanyAssignmentRecord {
  id: string;
  companyId: string;
  assignedAt: string;
  company?: { name: string };
}

export interface ActiveBuildingAssignmentRecord {
  id: string;
  buildingId: string;
  assignedAt: string;
  building: { areaId: string; companyId: string; title: string };
}

export interface ActiveGatewayAssignmentRecord {
  id: string;
  gatewayId: string;
  assignedAt: string;
  gateway: { serialNumber: string };
}

export interface GatewayRecord {
  id: string;
  serialNumber: string;
  gatewayType: GatewayType;
  status: DeviceLifecycleStatus;
  installedLocation: string | null;
  lastSeenAt: string | null;
  companyAssignments: ActiveCompanyAssignmentRecord[];
  buildingAssignments: ActiveBuildingAssignmentRecord[];
}

export interface NodeRecord {
  id: string;
  nodeTypeId: string;
  number: string;
  status: DeviceLifecycleStatus;
  installedLocation: string | null;
  batteryLevel: number | null;
  lastSeenAt: string | null;
  nodeType: NodeTypeRecord;
  companyAssignments: ActiveCompanyAssignmentRecord[];
  gatewayAssignments: ActiveGatewayAssignmentRecord[];
}

export interface CompanyDeviceSnapshot {
  gateways: GatewayRecord[];
  nodes: NodeRecord[];
}

export interface MonitoringNodeStateRecord {
  areaId: string;
  building: { id: string; title: string };
  buildingId: string;
  companyId: string;
  gateway: { id: string; serialNumber: string };
  gatewayId: string;
  lastSeenAt: string;
  node: { id: string; installedLocation: string | null; number: string };
  nodeId: string;
  nodeType: NodeTypeRecord;
  nodeTypeId: string;
  status: MonitoringStatus;
  updatedAt: string;
  values: SensorValues;
}

export interface MonitoringBuildingNodeTypeSummary {
  count: number;
  latestStatus: MonitoringStatus | null;
  nodeType: NodeTypeRecord;
}

export interface MonitoringBuildingOverview {
  building: BuildingRecord;
  nodeTypes: MonitoringBuildingNodeTypeSummary[];
}

export interface SensorReadingRecord {
  buildingId: string;
  gateway: { id: string; serialNumber: string };
  gatewayId: string;
  id: string;
  measuredAt: string | null;
  node: { id: string; installedLocation: string | null; number: string };
  nodeId: string;
  nodeType: NodeTypeRecord;
  nodeTypeId: string;
  receivedAt: string;
  status: MonitoringStatus;
  values: SensorValues;
}

export interface PaginatedSensorHistory {
  items: SensorReadingRecord[];
  page: number;
  pageSize: number;
  total: number;
}

export interface MonitoringNodeTypeResponse {
  building: BuildingRecord;
  historyRetentionDays: number;
  nodeType: NodeTypeRecord;
  states: MonitoringNodeStateRecord[];
}

export interface MonitoringRealtimeJoinRequest {
  buildingId: string;
  nodeType: CanonicalNodeType;
}

export interface MonitoringRealtimeJoinResponse {
  ok: boolean;
  room?: string;
  error?: string;
}

export interface MonitoringNodeStateEvent {
  buildingId: string;
  nodeType: CanonicalNodeType;
  state: MonitoringNodeStateRecord;
}

export interface GatewayCommandRecord {
  id: string;
  gatewayId: string;
  commandType: GatewayCommandType;
  commandNumber: number;
  status: GatewayCommandStatus;
  topic: string;
  payload: unknown;
  responsePayload: unknown | null;
  requesterType: "GSS_ADMIN" | "COMPANY_USER" | "SYSTEM";
  requesterId: string | null;
  correlationKey: string;
  attemptCount: number;
  maxAttempts: number;
  lastAttemptAt: string | null;
  sentAt: string | null;
  acknowledgedAt: string | null;
  failedAt: string | null;
  expiresAt: string;
  cancelledAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  gateway: { id: string; serialNumber: string };
  provisioningRequest: NodeGatewayProvisioningRequestRecord | null;
}

export interface NodeGatewayProvisioningItemRecord {
  id: string;
  nodeId: string;
  assignmentId: string | null;
  appliedAt: string | null;
  failureReason: string | null;
  node: { number: string };
}

export interface NodeGatewayProvisioningRequestRecord {
  id: string;
  companyId: string;
  buildingId: string;
  gatewayId: string;
  nodeTypeId: string;
  status: GatewayCommandStatus;
  responsePayload: unknown | null;
  failureReason: string | null;
  appliedAt: string | null;
  failedAt: string | null;
  items: NodeGatewayProvisioningItemRecord[];
}
