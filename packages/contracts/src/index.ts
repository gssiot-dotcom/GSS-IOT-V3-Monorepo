export * from "./node-number-parser";

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

export interface AuthRoleSummary {
  id: string;
  isSuperAdmin: boolean;
  key: string;
  name: string;
}

export interface AuthCompanySummary {
  id: string;
  name: string;
}

export interface AuthenticatedUser {
  companyId?: string;
  company?: AuthCompanySummary | null;
  email: string;
  id: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  lastLoginAt?: string | null;
  name: string;
  phone?: string | null;
  permissions: string[];
  role?: AuthRoleSummary | null;
}

export interface AuthSession {
  context: AuthContext;
  user: AuthenticatedUser;
}

export type DashboardRange = "7d" | "30d" | "90d";
export type DashboardSeverity =
  "safe" | "caution" | "warning" | "danger" | "offline" | "unconfigured";

export interface DashboardSummary {
  range: { from: string; to: string; key: DashboardRange };
  kpis: {
    activeCompanies?: number;
    activeCompanyUsers?: number;
    activeSites?: number;
    activeBuildings?: number;
    gateways?: number;
    gatewaysOffline?: number;
    nodes?: number;
    nodesUnassigned?: number;
    telemetryReadings?: number;
  };
  gateways?: { online: number; offline: number; unassigned: number };
  nodesByLifecycle?: Record<string, number>;
  severityDistribution?: Record<DashboardSeverity, number>;
  openAlarmsBySeverity?: Record<"CAUTION" | "WARNING" | "DANGER", number>;
  commandStatus?: Record<string, number>;
  telemetryTrend?: Array<{ date: string; count: number }>;
  recentCommandFailures?: Array<{ createdAt: string; failureReason: string | null; id: string }>;
}

export type CompanyStatus = "ACTIVE" | "INACTIVE";

export type CollectionPageSize = 50 | 100;

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: CollectionPageSize;
  total: number;
}

export interface DeleteCapability {
  allowed: boolean;
  mode: "ARCHIVE" | "PERMANENT_PURGE" | "HARD_DELETE" | "SOFT_DELETE" | "NOT_ALLOWED";
  blocker: string | null;
  code: string | null;
  counts?: Record<string, number>;
  recommendedActions?: string[];
}
export type AccessLevel = "VIEW" | "MANAGE";
export type PermissionEffect = "ALLOW" | "DENY";
export type DeviceLifecycleStatus = "ACTIVE" | "INACTIVE" | "RETIRED";
export type GatewayType = "NODES_GATEWAY" | "SECURITY_OFFICE_GATEWAY";
export type GatewayCommandStatus =
  "PENDING" | "SENT" | "ACKNOWLEDGED" | "FAILED" | "EXPIRED" | "CANCELLED";
export type GatewayCommandType =
  "REGISTER_NODES" | "WAKE_SECURITY" | "SET_ALARM_LEVELS" | "SET_FAULT_FILTER";
export type CanonicalNodeType = "door_node" | "angle_node" | "gangform_node";
export type MonitoringStatus =
  "safe" | "caution" | "warning" | "danger" | "offline" | "unconfigured";

export interface DoorSensorValues {
  batteryLevel: number | null;
  doorState: "closed" | "open";
}

export interface AngleSensorValues {
  angleX: number;
  angleY: number;
}

export type SensorValues = DoorSensorValues | AngleSensorValues;

export type AlarmConfigurationState = "CONFIGURED" | "DISABLED" | "UNCONFIGURED";
export type AlarmSeverity = "CAUTION" | "WARNING" | "DANGER";
export type AlarmEventStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
export type AlarmChannel = "IN_APP" | "SMS" | "TELEGRAM" | "EMAIL" | "WEB_PUSH";
export type AlarmNotificationStatus =
  "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "SKIPPED" | "CANCELLED";

export interface ClassificationEvidence {
  absoluteAngleX?: number;
  absoluteAngleY?: number;
  classification: MonitoringStatus;
  configurationState: AlarmConfigurationState;
  dangerThreshold?: number | null;
  faultFilterState?: "APPLIED" | "NOT_APPLIED";
  faultFiltered?: boolean;
  metric?: number;
  rawAngleX?: number;
  rawAngleY?: number;
  rawPayloadStatus?: unknown;
  matchedConfigurationId?: string | null;
  matchedConfigurationVersion?: number | null;
  cautionThreshold?: number | null;
  warningThreshold?: number | null;
}

export interface CompanyRecord {
  id: string;
  name: string;
  hasLogo: boolean;
  code: string | null;
  status: CompanyStatus;
  address: string | null;
  email: string | null;
  phone: string | null;
  deletion?: DeleteCapability;
}

export interface AreaRecord {
  id: string;
  companyId: string;
  name: string;
  address: string | null;
  description: string | null;
  status: CompanyStatus;
  deletion?: DeleteCapability;
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
  deletion?: DeleteCapability;
}

export interface ScopedOverviewSection<Item> {
  available: boolean;
  items: Item[];
  total: number | null;
}

export interface ScopedOverviewUserRecord {
  accessSources: Array<"AREA" | "BUILDING" | "COMPANY">;
  email: string;
  id: string;
  isActive: boolean;
  name: string;
  role: {
    id: string;
    name: string;
  };
}

export interface AreaOverviewBuildingRecord extends BuildingRecord {
  metrics: {
    assignedUsers: number | null;
    gateways: number | null;
    nodes: number | null;
  };
}

export interface BuildingOverviewGatewayRecord {
  id: string;
  installedLocation: string | null;
  isOnline: boolean;
  lastSeenAt: string | null;
  nodeCount: number;
  serialNumber: string;
  status: DeviceLifecycleStatus;
}

export interface BuildingOverviewNodeRecord {
  gateway: { id: string; serialNumber: string };
  id: string;
  installedLocation: string | null;
  lastSeenAt: string | null;
  latestStatus: MonitoringStatus | null;
  nodeType: { displayName: string; id: string; key: string };
  number: string;
  status: DeviceLifecycleStatus;
}

export interface AreaOverviewResponse {
  area: AreaRecord;
  buildings: ScopedOverviewSection<AreaOverviewBuildingRecord>;
  metrics: {
    assignedUsers: number | null;
    buildings: number | null;
    gateways: number | null;
    nodes: number | null;
  };
  users: ScopedOverviewSection<ScopedOverviewUserRecord>;
}

export interface BuildingOverviewResponse {
  area: AreaRecord | null;
  building: BuildingRecord;
  devices: ScopedOverviewSection<BuildingOverviewGatewayRecord>;
  metrics: {
    activeNodes: number | null;
    assignedUsers: number | null;
    faultNodes: number | null;
    gateways: number | null;
    nodes: number | null;
    offlineGateways: number | null;
    onlineGateways: number | null;
  };
  nodes: ScopedOverviewSection<BuildingOverviewNodeRecord>;
  users: ScopedOverviewSection<ScopedOverviewUserRecord>;
}

export interface CompanyRoleRecord {
  id: string;
  companyId: string | null;
  key: string;
  name: string;
  isSystem: boolean;
  isCompanyOwnerRole: boolean;
  _count?: { users: number };
  permissions: Array<{
    permissionId: string;
    permission?: CompanyPermissionRecord & { scopeType?: "GSS" | "COMPANY" | "BOTH" };
  }>;
  deletion?: DeleteCapability;
}

export interface CompanyUserRecord {
  id: string;
  companyId: string;
  roleId: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  areaAccess?: Array<{
    accessLevel: AccessLevel;
    area?: { id: string; name: string };
    areaId: string;
  }>;
  buildingAccess?: Array<{
    accessLevel: AccessLevel;
    building?: { areaId: string; id: string; title: string };
    buildingId: string;
  }>;
  permissions?: Array<{
    effect: PermissionEffect;
    permission: CompanyPermissionRecord;
    permissionId: string;
  }>;
  positionAssignments?: Array<{
    area?: { id: string; name: string } | null;
    areaId: string | null;
    assignedAt: string;
    building?: { areaId: string; id: string; title: string } | null;
    buildingId: string | null;
    id: string;
    position: CompanyPositionRecord;
    positionId: string;
  }>;
  role: Pick<CompanyRoleRecord, "id" | "key" | "name" | "isCompanyOwnerRole">;
  deletion?: DeleteCapability;
}

export interface CompanyPositionRecord {
  id: string;
  companyId: string;
  key: string;
  name: string;
  isActive: boolean;
  dependencies?: {
    activeAssignments: number;
    activePolicies: number;
    historicalAssignments: number;
    historicalPolicies: number;
  };
  deletion?: DeleteCapability;
}

export interface CompanyPermissionRecord {
  id: string;
  key: string;
  module: string;
  action: string;
  description?: string | null;
  scopeType?: "GSS" | "COMPANY" | "BOTH";
}

export interface GssRoleRecord {
  id: string;
  isSuperAdmin: boolean;
  isSystem: boolean;
  key: string;
  name: string;
  _count?: { users: number };
  permissions: Array<{ permissionId: string; permission?: CompanyPermissionRecord }>;
  deletion?: DeleteCapability;
}

export interface GssAdminRoleOption {
  id: string;
  isSuperAdmin: boolean;
  isSystem: boolean;
  key: string;
  name: string;
}

export interface GssAdminUserRecord {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
  role: GssAdminRoleOption;
  deletion?: DeleteCapability;
}

export interface SystemSettingsRecord {
  application: { apiVersion: string; environment: string; name: string };
  commands: { ackTimeoutMs: number; expiresInSeconds: number; maxPublishAttempts: number };
  controls: { productionDeploymentControls: string; readOnly: boolean };
  features: { reportCleanupEnabled: boolean };
  mqtt: { connected: boolean; enabled: boolean; ready: boolean; subscribedFilterCount: number };
  reports: {
    storage: { provider: string; ready: boolean };
    worker: { enabled: boolean; mode: string; ready: boolean };
  };
  sensorHistory: { retentionDays: number };
}

export interface CompanyUserEffectiveAccessRecord {
  assignedAreas: NonNullable<CompanyUserRecord["areaAccess"]>;
  assignedBuildings: NonNullable<CompanyUserRecord["buildingAccess"]>;
  directAllowPermissions: CompanyPermissionRecord[];
  directDenyPermissions: CompanyPermissionRecord[];
  effectivePermissions: CompanyPermissionRecord[];
  inheritedBuildings: Array<{ areaId: string; id: string; title: string }>;
  positionAssignments: NonNullable<CompanyUserRecord["positionAssignments"]>;
  rolePermissions: CompanyPermissionRecord[];
  user: CompanyUserRecord;
}

export interface BuildingPlanImageRecord {
  id: string;
  kind: "PLAN" | "REAL";
  byteSize: number | null;
  contentPath: string;
  contentType: string | null;
  orderIndex: number;
  width: number | null;
  height: number | null;
  createdAt: string;
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
  deletion?: DeviceDeletionCapability;
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
  deletion?: DeviceDeletionCapability;
}

export interface BulkNodeCreateResponse {
  created: NodeRecord[];
  createdCount: number;
  numbers: string[];
}

export type DeviceDeletionCapability = DeleteCapability;

export interface CompanyDeviceSnapshot {
  gateways: GatewayRecord[];
  nodes: NodeRecord[];
}

export interface CompanyDeviceInventoryResponse {
  gateways: PaginatedResponse<GatewayRecord>;
  nodes: PaginatedResponse<NodeRecord>;
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
  classificationEvidence: ClassificationEvidence | null;
  faultFiltered: boolean;
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
  classificationEvidence: ClassificationEvidence | null;
  faultFiltered: boolean;
  values: SensorValues;
}

export interface AlarmLevelThresholds {
  cautionThreshold: number | null;
  dangerThreshold: number | null;
  warningThreshold: number | null;
}

export interface BuildingAlarmLevelConfigurationRecord extends AlarmLevelThresholds {
  id: string;
  buildingId: string;
  nodeType: NodeTypeRecord;
  nodeTypeId: string;
  enabled: boolean;
  version: number;
  updatedAt: string;
}

export interface GatewayAlarmLevelApplicationRecord {
  id: string;
  gateway: { id: string; serialNumber: string };
  gatewayId: string;
  nodeTypeId: string;
  desiredCommandId: string | null;
  desiredEnabled: boolean;
  desiredStatus: GatewayCommandStatus;
  appliedCommandId: string | null;
  appliedRequestId: string | null;
  appliedAt: string | null;
  appliedConfigurationVersion: number | null;
  appliedEnabled: boolean | null;
  failureReason: string | null;
}

export interface BuildingAlarmLevelsResponse {
  building: BuildingRecord;
  configurations: BuildingAlarmLevelConfigurationRecord[];
  gatewayApplications: GatewayAlarmLevelApplicationRecord[];
  nodeTypes: NodeTypeRecord[];
}

export interface FaultFilterNodeRecord {
  gateway: { id: string; serialNumber: string };
  gatewayId: string;
  node: { id: string; number: string };
  nodeId: string;
  nodeTypeId: string;
  desiredEnabled: boolean;
  desiredCommandId: string | null;
  desiredStatus: GatewayCommandStatus | null;
  applied: boolean;
  appliedCommandId: string | null;
  appliedAt: string | null;
  failureReason: string | null;
}

export interface FaultFilterGatewayGroup {
  gateway: { id: string; serialNumber: string };
  nodeTypes: Array<{
    nodeType: NodeTypeRecord;
    nodes: FaultFilterNodeRecord[];
  }>;
}

export interface BuildingFaultFiltersResponse {
  building: BuildingRecord;
  gateways: FaultFilterGatewayGroup[];
}

export interface PaginatedSensorHistory {
  items: SensorReadingRecord[];
  page: number;
  pageSize: number;
  total: number;
}

export interface SensorHistoryChartResponse {
  items: SensorReadingRecord[];
  from: string;
  to: string;
  totalRawPointCount: number;
  returnedPointCount: number;
  sampled: boolean;
  sampleLimit: number;
}

export interface MonitoringNodeTypeResponse {
  building: BuildingRecord;
  historyRetentionDays: number;
  nodeType: NodeTypeRecord;
  states: MonitoringNodeStateRecord[];
}

export interface AdminMonitoringOptionsRecord {
  areas: AreaRecord[];
  buildings: BuildingRecord[];
  companies: CompanyRecord[];
}

export interface AdminMonitoringSummaryRecord {
  buildings: Array<{
    building: BuildingRecord;
    danger: number;
    offline: number;
    total: number;
    warning: number;
  }>;
  gateways: { offline: number; online: number; stale: number; total: number };
  recentNodes: MonitoringNodeStateRecord[];
  severityDistribution: Record<MonitoringStatus, number>;
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

export interface AlarmPolicyRecord {
  id: string;
  ruleId: string;
  targetType: "POSITION" | "SPECIFIC_USER";
  positionId: string | null;
  specificUserId: string | null;
  requiredOccurrenceCount: number;
  countIntervalSeconds: number;
  channel: AlarmChannel;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  disabledAt?: string | null;
  history?: {
    counters: number;
    notifications: number;
    triggers: number;
  };
  deletion?: DeleteCapability;
}

export interface AlarmRuleRecord {
  id: string;
  buildingId: string;
  nodeTypeId: string;
  severity: AlarmSeverity;
  name: string | null;
  isActive: boolean;
  building?: {
    area?: { id: string; name: string };
    areaId?: string;
    company?: { id: string; name: string };
    companyId?: string;
    id: string;
    title: string;
  };
  nodeType?: NodeTypeRecord;
  recipientPolicies?: AlarmPolicyRecord[];
  createdAt: string;
  updatedAt: string;
  deletion?: DeleteCapability;
}

export interface AlarmEventRecord {
  id: string;
  buildingId: string;
  nodeId: string;
  nodeTypeId: string;
  severity: AlarmSeverity;
  status: AlarmEventStatus;
  openedAt: string;
  lastTriggeredAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolutionReason: string | null;
  building?: { id: string; title: string };
  node?: { id: string; number: string };
  nodeType?: NodeTypeRecord;
  rule?: { id: string; name: string | null; severity: AlarmSeverity };
}

export interface AlarmNotificationRecord {
  id: string;
  alarmEventId: string;
  policyTriggerId: string;
  policyId: string;
  recipientUserId: string;
  channel: AlarmChannel;
  status: AlarmNotificationStatus;
  title: string;
  body: string;
  templateSnapshot?: {
    key: string;
    params?: Readonly<Record<string, string | number>>;
  } | null;
  attemptCount: number;
  maxAttempts: number;
  sentAt: string | null;
  readAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
  alarmEvent?: AlarmEventRecord;
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

export interface MqttStatusRecord {
  brokerHost: string;
  clientId: string;
  connected: boolean;
  enabled: boolean;
  lastConnectedAt: string | null;
  lastError: string | null;
  lastMessageAt: string | null;
  lastPublishAt: string | null;
  subscribedTopicFilters: string[];
}

export interface NodeGatewayProvisioningItemRecord {
  id: string;
  nodeId: string;
  selected: boolean;
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
  mode: "APPEND" | "REPLACE";
  status: GatewayCommandStatus;
  responsePayload: unknown | null;
  failureReason: string | null;
  appliedAt: string | null;
  failedAt: string | null;
  items: NodeGatewayProvisioningItemRecord[];
}

export type ReportJobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
export type ReportType =
  | "COMPANY_SUMMARY"
  | "SITE_SUMMARY"
  | "BUILDING_SUMMARY"
  | "DEVICE_INVENTORY"
  | "DEVICE_ASSIGNMENT_HISTORY"
  | "GATEWAY_STATUS_HISTORY"
  | "NODE_STATUS_HISTORY"
  | "SENSOR_HISTORY"
  | "ALARM_HISTORY"
  | "MQTT_COMMAND_HISTORY"
  | "USER_ACTIVITY"
  | "AUDIT_LOG"
  | "ARCHIVE_EVIDENCE";
export type ReportFileFormat = "CSV" | "XLSX";

export interface ReportExportRecord {
  id: string;
  reportJobId: string;
  fileName: string;
  format: ReportFileFormat;
  contentType: string;
  sizeBytes: number | null;
  expiresAt: string;
  createdByType: "GSS_ADMIN" | "COMPANY_USER" | "SYSTEM";
  createdById: string | null;
  downloadedAt: string | null;
  createdAt: string;
}

export interface ReportJobRecord {
  id: string;
  requestedByType: "GSS_ADMIN" | "COMPANY_USER";
  requestedById: string;
  companyId: string | null;
  areaId: string | null;
  buildingId: string | null;
  reportType: ReportType;
  filters: unknown;
  status: ReportJobStatus;
  progress: number;
  errorMessage: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  exports: ReportExportRecord[];
}
