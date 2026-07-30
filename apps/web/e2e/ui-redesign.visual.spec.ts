import { expect, test, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const apiOrigin = "http://localhost:3000";
const storageKey = "gss-iot-v3-auth-session";
const colorSchemeKey = "mantine-color-scheme-value";
const localeKey = "gss-iot.locale.v1";

function tomorrowCalendarLabel() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(tomorrow);
}

const company = {
  address: "Seoul Operations District",
  code: "GSS-001",
  email: "ops@gss.example",
  hasLogo: true,
  id: "company-1",
  name: "Acme Safety",
  phone: "+82 2 0000 0000",
  status: "ACTIVE",
};
const companyLogoPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAKAAAAA8CAYAAADha7EVAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAADrSURBVHhe7dIxDUIBAENBFOACZWhDAqoQATsMnfpL4C7p0vmdnjB0ej/gSAJkSoBMfQR4vt1/anw3ATIlQKYEyJQAmRIgUwJkSoBMCZApATIlQKYEyJQAmRIgUwJkSoBM/W2Al+vDDlgiQKsuEaBVlwjQqksEaNUlArTqEgFadYkArbpEgFZdIkCrLhGgVZcI0KpLBGjVJQK06hIBWnWJAK26RIBWXSJAqy4RoFWXCNCqS/42QL6DAJkSIFMCZEqATAmQKQEyJUCmBMiUAJkSIFMCZEqATAmQKQEyJUCmPgKEIwmQKQEyJUCmXlf26PiRDtnbAAAAAElFTkSuQmCC",
  "base64",
);
const areas = [
  {
    address: "Mapo-gu, Seoul",
    companyId: company.id,
    description: "North construction site",
    id: "area-1",
    name: "North Site",
    status: "ACTIVE",
  },
] as const;
const buildings = [
  {
    address: "North Site / Tower A",
    areaId: "area-1",
    buildingType: "Tower",
    companyId: company.id,
    id: "building-1",
    number: "A-101",
    status: "ACTIVE",
    title: "Tower A",
  },
  {
    address: "North Site / Tower B",
    areaId: "area-1",
    buildingType: "Tower",
    companyId: company.id,
    id: "building-2",
    number: "B-201",
    status: "ACTIVE",
    title: "Tower B",
  },
] as const;
const nodeTypes = [
  {
    displayName: "Door Node",
    id: "door",
    imageAssetKey: "door-node.png",
    key: "door_node",
    numericCode: 0,
  },
  {
    displayName: "Angle Node",
    id: "angle",
    imageAssetKey: "angle-node.png",
    key: "angle_node",
    numericCode: 1,
  },
  {
    displayName: "Gangform Node",
    id: "gangform",
    imageAssetKey: "gangform.png",
    key: "gangform_node",
    numericCode: 2,
  },
] as const;
const alarmRules = [
  {
    building: {
      ...buildings[0],
      area: { id: areas[0].id, name: areas[0].name },
      company: { id: company.id, name: company.name },
    },
    buildingId: buildings[0].id,
    createdAt: "2026-07-23T08:00:00.000Z",
    id: "rule-1",
    isActive: true,
    name: "Tower A danger rule",
    nodeType: nodeTypes[2],
    nodeTypeId: nodeTypes[2].id,
    recipientPolicies: [
      {
        channel: "IN_APP",
        countIntervalSeconds: 180,
        createdAt: "2026-07-23T08:00:00.000Z",
        history: { counters: 1, notifications: 8, triggers: 8 },
        id: "policy-1",
        isActive: true,
        positionId: "position-1",
        requiredOccurrenceCount: 3,
        ruleId: "rule-1",
        specificUserId: null,
        targetType: "POSITION",
        updatedAt: "2026-07-23T08:00:00.000Z",
      },
    ],
    severity: "DANGER",
    updatedAt: "2026-07-23T08:00:00.000Z",
  },
] as const;
const gatewayCommands = [
  {
    acknowledgedAt: null,
    attemptCount: 1,
    cancelledAt: null,
    commandNumber: 2,
    commandType: "REGISTER_NODES",
    correlationKey: "fixture-command-1",
    createdAt: "2026-07-23T08:00:00.000Z",
    expiresAt: "2026-07-23T09:00:00.000Z",
    failedAt: null,
    failureReason: null,
    gateway: { id: "gateway-1", serialNumber: "0300" },
    gatewayId: "gateway-1",
    id: "command-1",
    lastAttemptAt: "2026-07-23T08:00:01.000Z",
    maxAttempts: 3,
    payload: { requestId: "command-1" },
    provisioningRequest: null,
    requesterId: "ui-redesign-user",
    requesterType: "GSS_ADMIN",
    responsePayload: null,
    sentAt: "2026-07-23T08:00:01.000Z",
    status: "SENT",
    topic: "gss/gateway/0300/command",
    updatedAt: "2026-07-23T08:00:01.000Z",
  },
  {
    acknowledgedAt: null,
    attemptCount: 3,
    cancelledAt: null,
    commandNumber: 2,
    commandType: "REGISTER_NODES",
    correlationKey: "fixture-command-2",
    createdAt: "2026-07-23T07:00:00.000Z",
    expiresAt: "2026-07-23T08:00:00.000Z",
    failedAt: "2026-07-23T07:10:00.000Z",
    failureReason: "Fixture failure",
    gateway: { id: "gateway-2", serialNumber: "0400" },
    gatewayId: "gateway-2",
    id: "command-2",
    lastAttemptAt: "2026-07-23T07:10:00.000Z",
    maxAttempts: 3,
    payload: { requestId: "command-2" },
    provisioningRequest: null,
    requesterId: "ui-redesign-user",
    requesterType: "GSS_ADMIN",
    responsePayload: null,
    sentAt: "2026-07-23T07:01:00.000Z",
    status: "FAILED",
    topic: "gss/gateway/0400/command",
    updatedAt: "2026-07-23T07:10:00.000Z",
  },
];
const wave2Gateways = [
  {
    buildingAssignments: [
      {
        assignedAt: "2026-07-23T07:00:00.000Z",
        building: { areaId: "area-1", companyId: company.id, title: buildings[0].title },
        buildingId: buildings[0].id,
        id: "gateway-building-1",
      },
    ],
    companyAssignments: [
      {
        assignedAt: "2026-07-23T07:00:00.000Z",
        company: { name: company.name },
        companyId: company.id,
        id: "gateway-company-1",
      },
    ],
    deletion: { allowed: false, blocker: "companyAssignmentHistory" },
    gatewayType: "NODES_GATEWAY",
    id: "gateway-1",
    installedLocation: "North entrance",
    lastSeenAt: "2026-07-23T08:12:00.000Z",
    serialNumber: "0300",
    status: "ACTIVE",
  },
  {
    buildingAssignments: [],
    companyAssignments: [],
    deletion: { allowed: true, blocker: null },
    gatewayType: "GATEWAY",
    id: "gateway-2",
    installedLocation: null,
    lastSeenAt: null,
    serialNumber: "0400",
    status: "INACTIVE",
  },
];
const wave2Nodes = [
  {
    batteryLevel: 92,
    companyAssignments: [
      {
        assignedAt: "2026-07-23T07:00:00.000Z",
        company: { name: company.name },
        companyId: company.id,
        id: "node-company-1",
      },
    ],
    deletion: { allowed: false, blocker: "companyAssignmentHistory" },
    gatewayAssignments: [
      {
        assignedAt: "2026-07-23T07:00:00.000Z",
        gateway: { serialNumber: "0300" },
        gatewayId: "gateway-1",
        id: "node-gateway-1",
      },
    ],
    id: "node-1",
    installedLocation: "North entrance",
    lastSeenAt: "2026-07-23T08:12:00.000Z",
    nodeType: nodeTypes[0],
    nodeTypeId: nodeTypes[0].id,
    number: "100",
    status: "ACTIVE",
  },
  {
    batteryLevel: null,
    companyAssignments: [],
    deletion: { allowed: true, blocker: null },
    gatewayAssignments: [],
    id: "node-2",
    installedLocation: null,
    lastSeenAt: null,
    nodeType: nodeTypes[1],
    nodeTypeId: nodeTypes[1].id,
    number: "101",
    status: "RETIRED",
  },
];
const wave2Roles = [
  {
    _count: { users: 1 },
    companyId: company.id,
    id: "role-owner",
    isCompanyOwnerRole: true,
    isSystem: true,
    key: "company_owner",
    name: "Company owner",
    permissions: [],
  },
  {
    _count: { users: 0 },
    companyId: company.id,
    id: "role-safety",
    isCompanyOwnerRole: false,
    isSystem: false,
    key: "safety_lead",
    name: "Safety lead",
    permissions: [{ permissionId: "permission-devices" }],
  },
];
const wave2Permissions = [
  {
    action: "view",
    description: "View company device inventory within the authenticated company scope.",
    id: "permission-devices",
    key: "company-devices.view",
    module: "company-devices",
    scopeType: "COMPANY",
  },
  {
    action: "manage",
    description: "Manage company roles within the authenticated company scope.",
    id: "permission-roles",
    key: "company-roles.manage",
    module: "company-roles",
    scopeType: "COMPANY",
  },
];
const adminCatalogPermissions = [
  {
    action: "view",
    description: "View dashboard analytics within the authorized GSS or company scope.",
    id: "permission-dashboard",
    key: "dashboard.view",
    module: "dashboard",
    scopeType: "BOTH",
  },
  {
    action: "view",
    description: "View the GSS permission catalog across the authorized GSS Admin context.",
    id: "permission-catalog",
    key: "permissions.view",
    module: "permissions",
    scopeType: "GSS",
  },
];
const alarmEvents = [
  {
    acknowledgedAt: null,
    building: { id: buildings[0].id, title: buildings[0].title },
    buildingId: buildings[0].id,
    id: "alarm-1",
    lastTriggeredAt: "2026-07-23T08:10:00.000Z",
    node: { id: "node-1", number: "100" },
    nodeId: "node-1",
    nodeTypeId: nodeTypes[0].id,
    openedAt: "2026-07-23T08:00:00.000Z",
    resolutionReason: null,
    resolvedAt: null,
    rule: { id: "rule-1", name: "Door threshold", severity: "DANGER" },
    severity: "DANGER",
    status: "OPEN",
  },
  {
    acknowledgedAt: "2026-07-22T08:10:00.000Z",
    building: { id: buildings[0].id, title: buildings[0].title },
    buildingId: buildings[0].id,
    id: "alarm-2",
    lastTriggeredAt: "2026-07-22T08:00:00.000Z",
    node: { id: "node-2", number: "101" },
    nodeId: "node-2",
    nodeTypeId: nodeTypes[0].id,
    openedAt: "2026-07-22T07:50:00.000Z",
    resolutionReason: "SAFE",
    resolvedAt: "2026-07-22T08:20:00.000Z",
    rule: { id: "rule-2", name: "Door warning", severity: "WARNING" },
    severity: "WARNING",
    status: "RESOLVED",
  },
];
const reportJobs = [
  {
    buildingId: null,
    companyId: company.id,
    completedAt: "2026-07-23T08:20:00.000Z",
    createdAt: "2026-07-23T08:00:00.000Z",
    errorMessage: null,
    exports: [],
    filters: {},
    format: "CSV",
    id: "report-1",
    progress: 100,
    reportJobId: "report-job-1",
    reportType: "COMPANY_SUMMARY",
    requestedById: "ui-redesign-user",
    requestedByType: "GSS_ADMIN",
    sizeBytes: 1024,
    status: "COMPLETED",
    updatedAt: "2026-07-23T08:20:00.000Z",
    expiresAt: "2026-07-30T08:20:00.000Z",
    downloadedAt: null,
    fileName: "company-summary.csv",
    contentType: "text/csv",
    areaId: null,
  },
];
const companyUsers = [
  {
    areaAccess: [],
    buildingAccess: [],
    companyId: company.id,
    email: "operator@gss.example",
    id: "company-user-1",
    isActive: true,
    name: "Site Operator",
    phone: "+82 2 0000 0000",
    role: { id: "role-1", isCompanyOwnerRole: false, key: "site_manager", name: "Site manager" },
    roleId: "role-1",
  },
];
const gssAdministrators = [
  {
    createdAt: "2026-07-23T08:00:00.000Z",
    deletion: {
      allowed: false,
      blocker: "The last active GSS super admin cannot be deleted.",
      code: "LAST_ACTIVE_GSS_SUPER_ADMIN",
      mode: "NOT_ALLOWED",
    },
    email: "admin@gss.example",
    id: "gss-admin-1",
    isActive: true,
    lastLoginAt: "2026-07-28T07:00:00.000Z",
    name: "GSS Operator",
    phone: "+82 2 1000 1000",
    role: {
      id: "gss-role-1",
      isSuperAdmin: true,
      isSystem: true,
      key: "super-admin",
      name: "Super Admin",
    },
    updatedAt: "2026-07-28T07:00:00.000Z",
  },
] as const;

function sessionFor(context: "gss-admin" | "company-user", permissions: readonly string[]) {
  return {
    accessToken: "ui-redesign-fixture-token",
    context,
    user: {
      company: context === "company-user" ? { id: company.id, name: company.name } : null,
      companyId: context === "company-user" ? company.id : undefined,
      email: context === "company-user" ? "operator@gss.example" : "admin@gss.example",
      id: "ui-redesign-user",
      isActive: true,
      isSuperAdmin: false,
      name: context === "company-user" ? "Site Operator" : "GSS Operator",
      permissions,
      role: {
        id: "ui-role",
        isSuperAdmin: context === "gss-admin",
        key: "ui-fixture",
        name: "UI fixture",
      },
    },
  };
}

async function installFixture(
  page: Page,
  context: "gss-admin" | "company-user",
  permissions: readonly string[],
  options: { locale?: "en" | null } = {},
) {
  const session = sessionFor(context, permissions);
  let archiveDeletionStatus: "FAILED" | "PENDING" | "COMPLETED" = "FAILED";
  if (options.locale !== null) {
    await page.addInitScript(({ key, locale }) => window.localStorage.setItem(key, locale), {
      key: localeKey,
      locale: options.locale ?? "en",
    });
  }
  await page.addInitScript(
    ({ key, storedSession }) => sessionStorage.setItem(key, JSON.stringify(storedSession)),
    {
      key: storageKey,
      storedSession: { accessToken: session.accessToken, context: session.context },
    },
  );
  await page.route(`${apiOrigin}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/auth/gss/me" || path === "/auth/company/me")
      return route.fulfill({ json: session });
    if (path === "/company/branding/logo" || path === "/admin/companies/company-1/logo")
      return route.fulfill({ body: companyLogoPng, contentType: "image/png" });
    if (path === "/company/settings") return route.fulfill({ json: company });
    if (path === "/admin/companies/company-1") return route.fulfill({ json: company });
    if (path === "/admin/companies")
      return route.fulfill({
        json: { items: [company], page: 1, pageSize: 100, total: 1 },
      });
    if (path === "/admin/gss-users/options")
      return route.fulfill({ json: gssAdministrators.map(({ role }) => role) });
    if (path === "/admin/gss-users") {
      if (route.request().method() === "POST") return route.fulfill({ json: gssAdministrators[0] });
      return route.fulfill({
        json: { items: gssAdministrators, page: 1, pageSize: 50, total: 1 },
      });
    }
    if (path === "/admin/gss-users/gss-admin-1")
      return route.fulfill({ json: gssAdministrators[0] });
    if (path === "/admin/alarms" || path === "/company/alarms")
      return route.fulfill({
        json: { items: alarmEvents, page: 1, pageSize: 50, total: alarmEvents.length },
      });
    if (path === "/admin/reports" || path === "/company/reports")
      return route.fulfill({ json: { items: reportJobs, page: 1, pageSize: 50, total: 1 } });
    if (path === "/admin/reports/export" && route.request().method() === "POST")
      return route.fulfill({
        json: {
          exports: [],
          id: "archive-report-job",
          progress: 0,
          reportType: "ARCHIVE_EVIDENCE",
          status: "PENDING",
        },
      });
    if (path === "/admin/reports/archive-report-job")
      return route.fulfill({
        json: {
          exports: [{ fileName: "archive-evidence.csv", format: "CSV", id: "archive-export-1" }],
          id: "archive-report-job",
          progress: 100,
          reportType: "ARCHIVE_EVIDENCE",
          status: "COMPLETED",
        },
      });
    if (path === "/admin/reports/exports/archive-export-1/download")
      return route.fulfill({
        body: "entityType,id,name\nCOMPANY,archive-company-1,Archived Acme\n",
        contentType: "text/csv",
        headers: { "content-disposition": 'attachment; filename="archive-evidence.csv"' },
      });
    if (path === "/admin/archive" && route.request().method() === "GET")
      return route.fulfill({
        json: {
          items: [
            {
              deleteReason: "Tenant offboarding",
              deletedAt: "2026-07-28T08:00:00.000Z",
              deletedById: "admin-1",
              deletedByType: "GSS_ADMIN",
              id: "archive-company-1",
              name: "Archived Acme",
              parentDerived: false,
            },
          ],
          page: 1,
          pageSize: 50,
          total: 1,
        },
      });
    if (path === "/admin/archive/COMPANY/archive-company-1")
      return route.fulfill({
        json: {
          counts: { buildings: 2, sensorReadings: 12, sites: 1, users: 3 },
          root: {
            deleteReason: "Tenant offboarding",
            id: "archive-company-1",
            name: "Archived Acme",
          },
          rootType: "COMPANY",
          subtree: { buildings, sites: areas },
        },
      });
    if (path === "/admin/archive/purge/preview")
      return route.fulfill({
        json: {
          counts: { buildings: 2, sensorReadings: 12, sites: 1, users: 3 },
          estimatedDeletionRows: 19,
          globalDevicesPreserved: { gateways: 2, nodes: 7 },
          previewHash: "a".repeat(64),
          rootId: "archive-company-1",
          rootName: "Archived Acme",
          rootType: "COMPANY",
        },
      });
    if (path === "/admin/archive/purge/jobs" && route.request().method() === "POST") {
      archiveDeletionStatus = "FAILED";
      return route.fulfill({
        json: {
          currentPhase: "STORAGE_CLEANUP",
          deletedCounts: { sites: 1 },
          id: "delete-job-1",
          safeErrorSummary: "STORAGE_DELETE_FAILED",
          status: archiveDeletionStatus,
        },
      });
    }
    if (path === "/admin/archive/purge/jobs/delete-job-1/retry") {
      archiveDeletionStatus = "PENDING";
      return route.fulfill({
        json: {
          currentPhase: "PREPARE",
          deletedCounts: { sites: 1 },
          id: "delete-job-1",
          safeErrorSummary: null,
          status: archiveDeletionStatus,
        },
      });
    }
    if (path === "/admin/archive/purge/jobs/delete-job-1") {
      archiveDeletionStatus = "COMPLETED";
      return route.fulfill({
        json: {
          currentPhase: "COMPLETE",
          deletedCounts: { buildings: 2, sites: 1, users: 3 },
          id: "delete-job-1",
          safeErrorSummary: null,
          status: archiveDeletionStatus,
        },
      });
    }
    if (
      path === "/admin/monitoring/history/options" ||
      path === "/company/monitoring/history/options"
    )
      return route.fulfill({
        json: {
          areas,
          buildings,
          companies: path.startsWith("/admin") ? [company] : [],
          nodeTypes: [{ ...nodeTypes[1], buildingId: buildings[0].id }],
          nodes: [
            {
              buildingId: buildings[0].id,
              id: "node-2",
              nodeTypeId: nodeTypes[1].id,
              number: "101",
            },
          ],
        },
      });
    if (path === "/admin/monitoring/history/chart" || path === "/company/monitoring/history/chart")
      return route.fulfill({
        json: {
          items: [
            {
              buildingId: buildings[0].id,
              faultFiltered: false,
              gateway: { id: "gateway-1", serialNumber: "0300" },
              gatewayId: "gateway-1",
              id: "history-reading-1",
              measuredAt: "2026-07-29T08:00:00.000Z",
              node: { id: "node-2", installedLocation: "Roof", number: "101" },
              nodeId: "node-2",
              nodeType: nodeTypes[1],
              nodeTypeId: nodeTypes[1].id,
              receivedAt: "2026-07-29T08:00:00.000Z",
              status: "warning",
              values: { angleX: 2.4, angleY: -1.1 },
            },
          ],
          returnedPointCount: 1,
          sampleLimit: 500,
          sampled: false,
          totalRawPointCount: 1,
        },
      });
    if (path === "/admin/monitoring/history" || path === "/company/monitoring/history")
      return route.fulfill({
        json: {
          items: [
            {
              buildingId: buildings[0].id,
              faultFiltered: false,
              gateway: { id: "gateway-1", serialNumber: "0300" },
              gatewayId: "gateway-1",
              id: "history-reading-1",
              measuredAt: "2026-07-29T08:00:00.000Z",
              node: { id: "node-2", installedLocation: "Roof", number: "101" },
              nodeId: "node-2",
              nodeType: nodeTypes[1],
              nodeTypeId: nodeTypes[1].id,
              receivedAt: "2026-07-29T08:00:00.000Z",
              status: "warning",
              values: { angleX: 2.4, angleY: -1.1 },
            },
          ],
          page: 1,
          pageSize: 50,
          total: 1,
        },
      });
    if (path === "/admin/archive/sensor-readings/preview")
      return route.fulfill({
        json: {
          confirmation: "DELETE 1",
          eligible: 1,
          estimatedSizeBytes: 512,
          matched: 2,
          preservedReferenced: 1,
          previewHash: "b".repeat(64),
        },
      });
    if (path === "/admin/archive/sensor-readings/jobs")
      return route.fulfill({
        json: {
          currentPhase: "SENSOR_READINGS",
          deletedCounts: {},
          id: "sensor-delete-job",
          safeErrorSummary: null,
          status: "PENDING",
        },
      });
    if (path === "/admin/archive/purge/jobs/sensor-delete-job")
      return route.fulfill({
        json: {
          currentPhase: "COMPLETE",
          deletedCounts: { sensorReadings: 1 },
          id: "sensor-delete-job",
          safeErrorSummary: null,
          status: "COMPLETED",
        },
      });
    if (path === "/company/users" || path === "/admin/companies/company-1/users")
      return route.fulfill({
        json: { items: companyUsers, page: 1, pageSize: 100, total: companyUsers.length },
      });
    if (path === "/admin/devices/gateways")
      return route.fulfill({
        json: { items: wave2Gateways, page: 1, pageSize: 100, total: wave2Gateways.length },
      });
    if (path === "/admin/devices/nodes")
      return route.fulfill({
        json: { items: wave2Nodes, page: 1, pageSize: 100, total: wave2Nodes.length },
      });
    if (path === "/admin/devices/node-types") return route.fulfill({ json: nodeTypes });
    if (path === "/admin/devices/provisioning-options")
      return route.fulfill({
        json: { areas, buildings, companies: [company] },
      });
    if (path === "/company/devices")
      return route.fulfill({
        json: {
          gateways: {
            items: wave2Gateways,
            page: 1,
            pageSize: 100,
            total: wave2Gateways.length,
          },
          nodes: { items: wave2Nodes, page: 1, pageSize: 100, total: wave2Nodes.length },
        },
      });
    if (path === "/company/roles")
      return route.fulfill({
        json: { items: wave2Roles, page: 1, pageSize: 100, total: wave2Roles.length },
      });
    if (path === "/company/permissions")
      return route.fulfill({
        json: {
          items: wave2Permissions,
          page: 1,
          pageSize: 100,
          total: wave2Permissions.length,
        },
      });
    if (path === "/company/permissions/options") return route.fulfill({ json: wave2Permissions });
    if (path === "/admin/permissions")
      return route.fulfill({
        json: {
          items: adminCatalogPermissions,
          page: 1,
          pageSize: 100,
          total: adminCatalogPermissions.length,
        },
      });
    if (path === "/company/areas/area-1") return route.fulfill({ json: areas[0] });
    if (path === "/company/buildings/building-1") return route.fulfill({ json: buildings[0] });
    if (
      path === "/company/buildings/building-1/images" ||
      path === "/admin/buildings/building-1/images"
    ) {
      const portal = path.startsWith("/admin") ? "/admin" : "/company";
      return route.fulfill({
        json: [
          {
            byteSize: companyLogoPng.byteLength,
            contentPath: `${portal}/building-images/plan-1/content`,
            contentType: "image/png",
            createdAt: "2026-07-23T08:00:00.000Z",
            height: null,
            id: "plan-1",
            kind: "PLAN",
            orderIndex: 0,
            width: null,
          },
          {
            byteSize: companyLogoPng.byteLength,
            contentPath: `${portal}/building-images/real-1/content`,
            contentType: "image/png",
            createdAt: "2026-07-23T08:05:00.000Z",
            height: null,
            id: "real-1",
            kind: "REAL",
            orderIndex: 0,
            width: null,
          },
        ],
      });
    }
    if (/^\/(admin|company)\/building-images\/(plan|real)-1\/content$/.test(path))
      return route.fulfill({ body: companyLogoPng, contentType: "image/png" });
    if (path.endsWith("/areas"))
      return route.fulfill({
        json: { items: areas, page: 1, pageSize: 100, total: areas.length },
      });
    if (path.endsWith("/buildings"))
      return route.fulfill({
        json: { items: buildings, page: 1, pageSize: 100, total: buildings.length },
      });
    if (path.endsWith("/positions"))
      return route.fulfill({ json: { items: [], page: 1, pageSize: 100, total: 0 } });
    if (
      path.endsWith("/users") ||
      path.endsWith("/roles") ||
      path.endsWith("/devices/gateways") ||
      path.endsWith("/devices/nodes")
    )
      return route.fulfill({ json: { items: [], page: 1, pageSize: 100, total: 0 } });
    if (path === "/company/buildings/building-1/monitoring")
      return route.fulfill({
        json: {
          building: buildings[0],
          nodeTypes: nodeTypes.map((nodeType) => ({ count: 4, latestStatus: "safe", nodeType })),
        },
      });
    if (path === "/company/buildings/building-1/monitoring/door_node")
      return route.fulfill({
        json: {
          building: buildings[0],
          historyRetentionDays: 180,
          nodeType: nodeTypes[0],
          states: [
            {
              areaId: areas[0].id,
              building: { id: buildings[0].id, title: buildings[0].title },
              buildingId: buildings[0].id,
              classificationEvidence: { classification: "safe" },
              companyId: company.id,
              faultFiltered: false,
              gateway: { id: "gateway-1", serialNumber: "0300" },
              gatewayId: "gateway-1",
              lastSeenAt: new Date().toISOString(),
              node: { id: "node-1", installedLocation: "North entrance", number: "100" },
              nodeId: "node-1",
              nodeType: nodeTypes[0],
              nodeTypeId: nodeTypes[0].id,
              status: "safe",
              updatedAt: new Date().toISOString(),
              values: { batteryLevel: 92, doorState: "closed" },
            },
          ],
        },
      });
    if (path === "/company/buildings/building-1/monitoring/angle_node")
      return route.fulfill({
        json: {
          building: buildings[0],
          historyRetentionDays: 180,
          nodeType: nodeTypes[1],
          states: [
            {
              areaId: areas[0].id,
              building: { id: buildings[0].id, title: buildings[0].title },
              buildingId: buildings[0].id,
              classificationEvidence: { classification: "warning" },
              companyId: company.id,
              faultFiltered: false,
              gateway: { id: "gateway-1", serialNumber: "0300" },
              gatewayId: "gateway-1",
              lastSeenAt: "2026-07-23T08:12:00.000Z",
              node: { id: "node-2", installedLocation: "Roof", number: "101" },
              nodeId: "node-2",
              nodeType: nodeTypes[1],
              nodeTypeId: nodeTypes[1].id,
              status: "warning",
              updatedAt: "2026-07-23T08:12:00.000Z",
              values: { angleX: 2.4, angleY: -1.1 },
            },
          ],
        },
      });
    if (path.includes("/monitoring/door_node/nodes/") && path.endsWith("/history/chart"))
      return route.fulfill({
        json: {
          from: "2026-07-23T00:00:00.000Z",
          items: [
            {
              buildingId: buildings[0].id,
              classificationEvidence: null,
              faultFiltered: false,
              gateway: { id: "gateway-1", serialNumber: "0300" },
              gatewayId: "gateway-1",
              id: "door-reading-1",
              measuredAt: "2026-07-23T08:12:00.000Z",
              node: { id: "node-1", installedLocation: "North entrance", number: "100" },
              nodeId: "node-1",
              nodeType: nodeTypes[0],
              nodeTypeId: nodeTypes[0].id,
              receivedAt: "2026-07-23T08:12:00.000Z",
              status: "safe",
              values: { batteryLevel: 92, doorState: "closed" },
            },
          ],
          returnedPointCount: 1,
          sampled: false,
          sampleLimit: 500,
          to: "2026-07-24T00:00:00.000Z",
          totalRawPointCount: 1,
        },
      });
    if (path.includes("/monitoring/angle_node/nodes/") && path.endsWith("/history/chart"))
      return route.fulfill({
        json: {
          from: "2026-07-23T00:00:00.000Z",
          items: [
            {
              buildingId: buildings[0].id,
              classificationEvidence: null,
              faultFiltered: false,
              gateway: { id: "gateway-1", serialNumber: "0300" },
              gatewayId: "gateway-1",
              id: "angle-reading-1",
              measuredAt: "2026-07-23T08:12:00.000Z",
              node: { id: "node-2", installedLocation: "Roof", number: "101" },
              nodeId: "node-2",
              nodeType: nodeTypes[1],
              nodeTypeId: nodeTypes[1].id,
              receivedAt: "2026-07-23T08:12:00.000Z",
              status: "warning",
              values: { angleX: 2.4, angleY: -1.1 },
            },
          ],
          returnedPointCount: 1,
          sampled: false,
          sampleLimit: 500,
          to: "2026-07-24T00:00:00.000Z",
          totalRawPointCount: 1,
        },
      });
    if (path.includes("/monitoring/door_node/nodes/") && path.endsWith("/history"))
      return route.fulfill({
        json: {
          items: [
            {
              buildingId: buildings[0].id,
              classificationEvidence: null,
              faultFiltered: false,
              gateway: { id: "gateway-1", serialNumber: "0300" },
              gatewayId: "gateway-1",
              id: "door-reading-1",
              measuredAt: "2026-07-23T08:12:00.000Z",
              node: { id: "node-1", installedLocation: "North entrance", number: "100" },
              nodeId: "node-1",
              nodeType: nodeTypes[0],
              nodeTypeId: nodeTypes[0].id,
              receivedAt: "2026-07-23T08:12:00.000Z",
              status: "safe",
              values: { batteryLevel: 92, doorState: "closed" },
            },
          ],
          page: 1,
          pageSize: 50,
          total: 1,
        },
      });
    if (path.includes("/monitoring/angle_node/nodes/") && path.endsWith("/history"))
      return route.fulfill({
        json: {
          items: [
            {
              buildingId: buildings[0].id,
              classificationEvidence: null,
              faultFiltered: false,
              gateway: { id: "gateway-1", serialNumber: "0300" },
              gatewayId: "gateway-1",
              id: "angle-reading-1",
              measuredAt: "2026-07-23T08:12:00.000Z",
              node: { id: "node-2", installedLocation: "Roof", number: "101" },
              nodeId: "node-2",
              nodeType: nodeTypes[1],
              nodeTypeId: nodeTypes[1].id,
              receivedAt: "2026-07-23T08:12:00.000Z",
              status: "warning",
              values: { angleX: 2.4, angleY: -1.1 },
            },
          ],
          page: 1,
          pageSize: 50,
          total: 1,
        },
      });
    if (path === "/company/buildings/building-1/alarm-levels")
      return route.fulfill({
        json: {
          building: buildings[0],
          configurations: [],
          gatewayApplications: [],
          nodeTypes: [nodeTypes[0]],
        },
      });
    if (path === "/company/buildings/building-1/alarm-levels/fault-filters")
      return route.fulfill({ json: { building: buildings[0], gateways: [] } });
    if (path === "/admin/dashboard/summary" || path === "/company/dashboard/summary")
      return route.fulfill({
        json: {
          gateways: { offline: 0, online: 1, unassigned: 0 },
          kpis: {
            activeBuildings: 2,
            ...(path.startsWith("/company") ? { activeCompanyUsers: 1 } : {}),
            activeCompanies: 1,
            activeSites: 1,
            gateways: 1,
            gatewaysOffline: 0,
            nodes: 1,
            nodesUnassigned: 0,
            telemetryReadings: 12,
          },
          openAlarmsBySeverity: { CAUTION: 0, DANGER: 0, WARNING: 0 },
          range: { from: "2026-07-16T00:00:00.000Z", key: "7d", to: "2026-07-23T00:00:00.000Z" },
          severityDistribution: {
            caution: 0,
            danger: 0,
            offline: 0,
            safe: 1,
            unconfigured: 0,
            warning: 0,
          },
          telemetryTrend: [
            { count: 4, date: "2026-07-21" },
            { count: 8, date: "2026-07-23" },
          ],
        },
      });
    if (path === "/admin/alarm-rules" || path === "/company/alarm-rules")
      return route.fulfill({
        json: { items: alarmRules, page: 1, pageSize: 50, total: alarmRules.length },
      });
    if (path === "/admin/alarm-rules/options" || path === "/company/alarm-rules/options")
      return route.fulfill({
        json: {
          buildings,
          nodeTypes,
          positions: [
            {
              companyId: company.id,
              id: "position-1",
              isActive: true,
              key: "site_manager",
              name: "Site manager",
            },
          ],
          users: [],
        },
      });
    if (path === "/admin/gateway-commands")
      return route.fulfill({
        json: { items: gatewayCommands, page: 1, pageSize: 50, total: gatewayCommands.length },
      });
    if (path === "/admin/gateway-commands/mqtt-status")
      return route.fulfill({
        json: {
          brokerHost: "fixture",
          clientId: "ui-fixture",
          connected: true,
          enabled: true,
          lastConnectedAt: null,
          lastError: null,
          lastMessageAt: null,
          lastPublishAt: null,
          subscribedTopicFilters: [],
        },
      });
    return route.fulfill({ json: [] });
  });
}

async function expectHiddenScrollableSidebar(page: Page) {
  const sidebar = page.locator(".gss-sidebar-scrollarea:visible").first();
  const viewport = sidebar.locator(".gss-sidebar-scrollarea-viewport");
  await expect(viewport).toBeVisible();
  const initial = await viewport.evaluate((element) => {
    element.scrollTop = 0;
    const style = getComputedStyle(element);
    return {
      clientHeight: element.clientHeight,
      msOverflowStyle: style.getPropertyValue("-ms-overflow-style"),
      overflowY: style.overflowY,
      scrollHeight: element.scrollHeight,
      scrollbarWidth: style.getPropertyValue("scrollbar-width"),
    };
  });
  expect(initial.scrollHeight).toBeGreaterThan(initial.clientHeight);
  expect(initial.overflowY).not.toBe("hidden");
  expect(initial.scrollbarWidth).toBe("none");
  // Chromium does not expose the legacy Edge-only property through computed style.
  expect(["", "none"]).toContain(initial.msOverflowStyle);
  expect(
    await sidebar.locator("[data-mantine-scrollbar]").evaluateAll(
      (elements) =>
        elements.filter((element) => {
          const style = getComputedStyle(element);
          return style.display !== "none" && style.visibility !== "hidden";
        }).length,
    ),
  ).toBe(0);

  await viewport.hover();
  await page.mouse.wheel(0, 240);
  await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await viewport.evaluate((element) => {
    element.scrollTop = 120;
  });
  expect(await viewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
}

async function capture(
  page: Page,
  path: string,
  slug: string,
  widths: number[],
  outputPath: (name: string) => string,
  colorScheme: "light" | "dark" = "light",
) {
  for (const width of widths) {
    await page.setViewportSize({ height: 900, width });
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await page.evaluate(({ key, scheme }) => window.localStorage.setItem(key, scheme), {
      key: colorSchemeKey,
      scheme: colorScheme,
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);
    await expect(page.getByTestId("app-root")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);
    await page.screenshot({
      fullPage: true,
      path: outputPath(`${slug}-${colorScheme}-${width}.png`),
    });
  }
}

async function captureExactViewports(
  page: Page,
  path: string,
  slug: string,
  viewports: Array<{ height: number; label: string; width: number }>,
  outputPath: (name: string) => string,
  singleRowTestId?: string,
) {
  for (const viewport of viewports) {
    await page.setViewportSize({ height: viewport.height, width: viewport.width });
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await page.evaluate(({ key }) => window.localStorage.setItem(key, "light"), {
      key: colorSchemeKey,
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);
    await expect(page.getByTestId("app-root")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);
    if (singleRowTestId && viewport.width >= 1280) {
      const rowTops = await page
        .getByTestId(singleRowTestId)
        .evaluate((element) =>
          [...element.children].map((child) => Math.round(child.getBoundingClientRect().top)),
        );
      expect(new Set(rowTops).size).toBe(1);
    }
    await page.screenshot({
      fullPage: true,
      path: outputPath(`${slug}-light-${viewport.label}.png`),
    });
  }
}

async function captureMonitoringTabs(
  page: Page,
  outputPath: (name: string) => string,
  colorScheme: "light" | "dark",
) {
  for (const width of [1440, 375]) {
    await page.setViewportSize({ height: 900, width });
    await page.goto("/company/buildings/building-1/monitoring/door_node", {
      waitUntil: "domcontentloaded",
    });
    await page.evaluate(({ key, scheme }) => window.localStorage.setItem(key, scheme), {
      key: colorSchemeKey,
      scheme: colorScheme,
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("app-root")).toBeVisible();
    for (const tab of [
      { label: "Latest node states", slug: "latest-states" },
      { label: "Sensor history", slug: "history" },
      { label: "Alarm levels", slug: "alarm-levels" },
      { label: "Fault filters", slug: "fault-filters" },
    ]) {
      await page.getByRole("tab", { name: tab.label }).click();
      await page.waitForTimeout(150);
      await page.screenshot({
        fullPage: true,
        path: outputPath(`company-monitoring-${tab.slug}-${colorScheme}-${width}.png`),
      });
    }
  }
}

async function captureSurfaceEvidence(
  page: Page,
  outputPath: (name: string) => string,
  colorScheme: "light" | "dark",
) {
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ height: 900, width });
    await page.goto("/admin/gateway-commands", { waitUntil: "domcontentloaded" });
    await page.evaluate(({ key, scheme }) => window.localStorage.setItem(key, scheme), {
      key: colorSchemeKey,
      scheme: colorScheme,
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("app-root")).toBeVisible();
    await page.screenshot({
      fullPage: true,
      path: outputPath(`surface-gateway-commands-${colorScheme}-${width}.png`),
    });

    const account = page.getByRole("button", { name: "Open account menu" });
    await account.click();
    await page.screenshot({
      fullPage: true,
      path: outputPath(`surface-profile-dropdown-${colorScheme}-${width}.png`),
    });
    await account.click();

    if (width === 375) {
      await page.getByRole("button", { name: "Toggle navigation" }).click();
    }
    await page.getByRole("link", { name: "Companies" }).hover();
    await page.screenshot({
      fullPage: true,
      path: outputPath(`surface-sidebar-hover-${colorScheme}-${width}.png`),
    });

    if (width === 375) {
      await page.getByRole("button", { name: "Toggle navigation" }).click();
    }
    await page
      .getByRole("button", { name: /More actions:/ })
      .first()
      .click();
    await page.getByRole("menuitem", { name: "Inspect payload" }).click();
    await page.screenshot({
      fullPage: true,
      path: outputPath(`surface-command-drawer-${colorScheme}-${width}.png`),
    });
    await page.keyboard.press("Escape");

    if (width === 375) {
      await page.screenshot({
        fullPage: true,
        path: outputPath(`surface-mobile-sidebar-${colorScheme}-${width}.png`),
      });
    }

    await page.goto("/admin/alarms", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(250);
    await page.screenshot({
      fullPage: true,
      path: outputPath(`surface-alarms-table-${colorScheme}-${width}.png`),
    });

    await page.goto("/admin/reports", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(250);
    await page.screenshot({
      fullPage: true,
      path: outputPath(`surface-reports-table-${colorScheme}-${width}.png`),
    });
  }
}

test("keeps both portal sidebars scrollable without a visible scrollbar and opens the drawer calendar", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const adminPermissions = [
    "welcome.view",
    "dashboard.view",
    "companies.view",
    "devices.view",
    "mqtt-commands.view",
    "monitoring.view",
    "alarms.view",
    "alarm-rules.view",
    "notifications.view",
    "reports.view",
    "admin-roles.view",
    "permissions.view",
    "settings.system.view",
  ];
  const companyPermissions = [
    "welcome.view",
    "dashboard.view",
    "areas.view",
    "buildings.view",
    "company-devices.view",
    "monitoring.view",
    "alarms.view",
    "alarm-rules.view",
    "notifications.view",
    "reports.view",
    "company-users.view",
    "company-roles.view",
    "company-permissions.view",
    "settings.company.view",
  ];

  await installFixture(page, "gss-admin", adminPermissions);
  for (const viewport of [
    { height: 420, label: "desktop", width: 1440 },
    { height: 420, label: "mobile", width: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/admin/gateway-commands", { waitUntil: "domcontentloaded" });
    if (viewport.label === "mobile") {
      await page.getByRole("button", { name: "Toggle navigation" }).click();
    }
    await expectHiddenScrollableSidebar(page);
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath(`admin-hidden-sidebar-${viewport.label}.png`),
    });
  }

  await installFixture(page, "company-user", companyPermissions);
  for (const viewport of [
    { height: 420, label: "desktop", width: 1440 },
    { height: 420, label: "mobile", width: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/company/dashboard", { waitUntil: "domcontentloaded" });
    if (viewport.label === "mobile") {
      await page.getByRole("button", { name: "Toggle navigation" }).click();
    }
    await expectHiddenScrollableSidebar(page);
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath(`company-hidden-sidebar-${viewport.label}.png`),
    });
  }

  await page.setViewportSize({ height: 900, width: 1440 });
  const historyRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/monitoring/angle_node/nodes/node-2/history")) {
      historyRequests.push(request.url());
    }
  });
  await page.goto("/company/buildings/building-1/monitoring/angle_node", {
    waitUntil: "domcontentloaded",
  });
  await page.getByText("Cards", { exact: true }).click();
  await page.getByRole("button", { name: /Node 101, Warning/i }).click();
  const drawer = page.getByRole("dialog", { name: "Node 101 detail" });
  await drawer.getByText("Day", { exact: true }).click();
  const dateInput = drawer.getByRole("button", { name: "History date" });
  await dateInput.click();
  await expect(page.getByRole("button", { name: tomorrowCalendarLabel() })).toBeDisabled();
  await page.screenshot({
    fullPage: false,
    path: testInfo.outputPath("company-node-day-calendar-in-drawer.png"),
  });
  await page.getByRole("button", { name: /20 July 2026/i }).click();
  await expect(dateInput).toContainText("2026-07-20");
  const selectedRange = await page.evaluate(() => ({
    from: new Date(2026, 6, 20).toISOString(),
    to: new Date(2026, 6, 21).toISOString(),
  }));
  await expect
    .poll(
      () =>
        historyRequests.filter((requestUrl) => {
          const request = new URL(requestUrl);
          return (
            request.searchParams.get("from") === selectedRange.from &&
            request.searchParams.get("to") === selectedRange.to
          );
        }).length,
    )
    .toBeGreaterThanOrEqual(2);
  expect(
    historyRequests.some((requestUrl) => new URL(requestUrl).pathname.endsWith("/history/chart")),
  ).toBe(true);
  expect(
    historyRequests.some((requestUrl) => new URL(requestUrl).pathname.endsWith("/history")),
  ).toBe(true);
});

test("captures protected Admin and Company redesign pages at required widths", async ({
  page,
}, testInfo) => {
  // This evidence sweep captures more than 50 full-page responsive screenshots.
  test.setTimeout(600000);
  const widths = [1440, 1280, 1024, 768, 375];
  const outputPath = (name: string) => testInfo.outputPath(name);
  await installFixture(page, "gss-admin", [
    "welcome.view",
    "dashboard.view",
    "companies.view",
    "companies.update",
    "companies.delete",
    "areas.view",
    "buildings.view",
    "company-users.view",
    "devices.view",
    "mqtt-commands.view",
  ]);
  await capture(page, "/admin/companies", "admin-companies", widths, outputPath);
  await capture(page, "/admin/companies/company-1", "admin-company-workspace", widths, outputPath);
  await capture(
    page,
    "/admin/companies/company-1/sites",
    "admin-company-sites",
    widths,
    outputPath,
  );
  await capture(
    page,
    "/admin/companies/company-1/buildings",
    "admin-company-buildings",
    widths,
    outputPath,
  );
  await capture(
    page,
    "/admin/companies/company-1/users",
    "admin-company-users",
    widths,
    outputPath,
  );
  await capture(
    page,
    "/admin/companies/company-1/devices",
    "admin-company-devices",
    widths,
    outputPath,
  );
  await capture(page, "/admin/gateway-commands", "admin-gateway-commands", widths, outputPath);
  await installFixture(page, "company-user", [
    "welcome.view",
    "dashboard.view",
    "areas.view",
    "buildings.view",
    "monitoring.view",
  ]);
  await capture(page, "/company/areas", "company-sites", widths, outputPath);
  await capture(page, "/company/buildings", "company-buildings", widths, outputPath);
  await capture(
    page,
    "/company/buildings/building-1/monitoring",
    "company-monitoring-selection",
    widths,
    outputPath,
  );
  await capture(
    page,
    "/company/buildings/building-1/monitoring/door_node",
    "company-monitoring-door-node",
    widths,
    outputPath,
  );
  await captureMonitoringTabs(page, outputPath, "light");
  const compactWidths = [1440, 375];
  await installFixture(page, "gss-admin", [
    "welcome.view",
    "dashboard.view",
    "companies.view",
    "areas.view",
    "buildings.view",
    "company-users.view",
    "devices.view",
    "alarms.view",
    "reports.view",
    "alarm-rules.view",
  ]);
  await capture(page, "/admin/dashboard", "admin-dashboard", compactWidths, outputPath);
  await capture(page, "/admin/alarms", "admin-alarms", compactWidths, outputPath);
  await capture(page, "/admin/reports", "admin-reports", compactWidths, outputPath);
  await capture(page, "/admin/alarm-rules", "admin-alarm-rules", compactWidths, outputPath);
  await installFixture(page, "company-user", [
    "welcome.view",
    "dashboard.view",
    "areas.view",
    "buildings.view",
    "monitoring.view",
    "alarms.view",
    "reports.view",
    "company-users.view",
    "roles.view",
  ]);
  await capture(page, "/company/dashboard", "company-dashboard", compactWidths, outputPath);
  await capture(page, "/company/alarms", "company-alarms", compactWidths, outputPath);
  await capture(page, "/company/reports", "company-reports", compactWidths, outputPath);
  await capture(page, "/company/users", "company-users", compactWidths, outputPath);
  await capture(page, "/company/roles", "company-roles-form", compactWidths, outputPath);
});

test("captures Company logo branding and settings at responsive light and dark viewports", async ({
  page,
}, testInfo) => {
  test.setTimeout(180000);
  await installFixture(page, "company-user", ["settings.company.view", "settings.company.manage"]);
  const viewports = [
    { height: 900, label: "desktop", width: 1440 },
    { height: 1024, label: "tablet", width: 768 },
    { height: 812, label: "mobile", width: 375 },
  ];

  for (const scheme of ["light", "dark"] as const) {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto("/company/settings", { waitUntil: "domcontentloaded" });
      await page.evaluate(({ key, value }) => window.localStorage.setItem(key, value), {
        key: colorSchemeKey,
        value: scheme,
      });
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Company settings" })).toBeVisible();
      await expect(page.locator('img[alt="Global Smart Solutions"]:visible')).toBeVisible();
      if (viewport.label === "mobile") {
        await page.getByRole("button", { name: "Toggle navigation" }).click();
        await expect(page.getByTitle(company.name)).toBeVisible();
        await page.waitForTimeout(250);
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      await page.screenshot({
        fullPage: viewport.label !== "mobile",
        path: testInfo.outputPath(`company-branding-${scheme}-${viewport.label}.png`),
      });
    }
  }
});

test("captures Admin company logo editor at responsive light and dark viewports", async ({
  page,
}, testInfo) => {
  test.setTimeout(180000);
  await installFixture(page, "gss-admin", [
    "companies.view",
    "companies.update",
    "areas.view",
    "buildings.view",
    "company-users.view",
    "company-roles.view",
    "gateways.view",
    "nodes.view",
  ]);
  const viewports = [
    { height: 900, label: "desktop", width: 1440 },
    { height: 1024, label: "tablet", width: 768 },
    { height: 812, label: "mobile", width: 375 },
  ];

  for (const scheme of ["light", "dark"] as const) {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto("/admin/companies/company-1", { waitUntil: "domcontentloaded" });
      await page.evaluate(({ key, value }) => window.localStorage.setItem(key, value), {
        key: colorSchemeKey,
        value: scheme,
      });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Edit company" }).click();
      await expect(page.getByRole("dialog", { name: "Edit company" })).toBeVisible();
      await expect(page.getByText("Company logo", { exact: true })).toBeVisible();
      await page.waitForTimeout(250);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      await page.screenshot({
        fullPage: viewport.label !== "mobile",
        path: testInfo.outputPath(`admin-company-logo-editor-${scheme}-${viewport.label}.png`),
      });
    }
  }
});

test("captures private building image management in both portals", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  await installFixture(page, "company-user", [
    "buildings.view",
    "building-plans.view",
    "building-plans.manage",
  ]);
  for (const viewport of [
    { height: 900, label: "desktop", width: 1440 },
    { height: 844, label: "mobile", width: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/company/buildings/building-1/plan", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("img", { name: "Private building image" })).toBeVisible();
    await page.getByRole("button", { name: "Upload image" }).click();
    await expect(page.getByRole("dialog", { name: "Upload building image" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      fullPage: viewport.label !== "mobile",
      path: testInfo.outputPath(`company-building-images-${viewport.label}.png`),
    });
  }

  await installFixture(page, "gss-admin", [
    "companies.view",
    "buildings.view",
    "building-plans.view",
    "building-plans.manage",
  ]);
  for (const viewport of [
    { height: 900, label: "desktop", width: 1440 },
    { height: 844, label: "mobile", width: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/admin/companies/company-1/buildings", {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("button", { name: "More actions: Tower A" }).click();
    await page.getByRole("menuitem", { name: "Building images" }).click();
    await expect(page.getByRole("dialog", { name: "Building images · Tower A" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Private building image" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      fullPage: viewport.label !== "mobile",
      path: testInfo.outputPath(`admin-building-images-${viewport.label}.png`),
    });
  }
});

test("captures responsive alarm-rule and role editor surfaces", async ({ page }, testInfo) => {
  test.setTimeout(120000);
  await installFixture(page, "gss-admin", ["alarm-rules.view", "alarm-rules.manage"]);
  for (const viewport of [
    { height: 900, label: "desktop", width: 1440 },
    { height: 844, label: "mobile", width: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/admin/alarm-rules", { waitUntil: "domcontentloaded" });
    await page.getByRole("row", { name: "Open: Tower A danger rule" }).click();
    await expect(page.getByRole("dialog", { name: "Recipient policy details" })).toBeVisible();
    await page.waitForTimeout(350);
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath(`alarm-policy-details-${viewport.label}.png`),
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Recipient policy details" })).toBeHidden();
    await page.getByRole("button", { name: "Create rule" }).click();
    const dialog = page.getByRole("dialog", { name: "Create rule" });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    if (viewport.label === "desktop") expect(box!.width).toBeGreaterThanOrEqual(600);
    expect(box!.width).toBeLessThanOrEqual(viewport.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath(`alarm-rule-modal-${viewport.label}.png`),
    });
  }

  await installFixture(page, "company-user", ["company-roles.view", "company-roles.manage"]);
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/company/roles", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Create role" }).click();
  await expect(page.getByRole("dialog", { name: "Create role" })).toBeVisible();
  await page.screenshot({
    fullPage: false,
    path: testInfo.outputPath("role-create-modal-desktop.png"),
  });

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/company/roles", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "More actions: Safety lead" }).click();
  await page.getByRole("menuitem", { name: "Edit role" }).click();
  await expect(page.getByRole("dialog", { name: "Edit role" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.screenshot({
    fullPage: false,
    path: testInfo.outputPath("role-edit-modal-mobile.png"),
  });
});

test("captures Wave 4 final evidence at exact responsive viewports", async ({ page }, testInfo) => {
  test.setTimeout(420000);
  const viewports = [
    { height: 900, label: "1440x900", width: 1440 },
    { height: 800, label: "1280x800", width: 1280 },
    { height: 768, label: "1024x768", width: 1024 },
    { height: 844, label: "390x844", width: 390 },
  ];
  const outputPath = (name: string) => testInfo.outputPath(name);

  await installFixture(page, "gss-admin", [
    "dashboard.view",
    "companies.view",
    "companies.update",
    "companies.delete",
    "mqtt-commands.view",
    "permissions.view",
    "reports.view",
  ]);
  await captureExactViewports(
    page,
    "/admin/dashboard",
    "admin-dashboard-final",
    viewports,
    outputPath,
    "dashboard-kpi-grid",
  );
  await captureExactViewports(
    page,
    "/admin/companies",
    "admin-companies-final",
    viewports,
    outputPath,
  );
  await captureExactViewports(
    page,
    "/admin/gateway-commands",
    "admin-gateway-commands-final",
    viewports,
    outputPath,
  );
  await captureExactViewports(page, "/admin/reports", "admin-reports-final", viewports, outputPath);
  await captureExactViewports(
    page,
    "/admin/settings/permissions",
    "admin-permissions-final",
    viewports,
    outputPath,
  );

  await installFixture(page, "company-user", [
    "dashboard.view",
    "areas.view",
    "buildings.view",
    "company-permissions.view",
    "monitoring.view",
    "reports.view",
  ]);
  await captureExactViewports(
    page,
    "/company/dashboard",
    "company-dashboard-final",
    viewports,
    outputPath,
  );
  await captureExactViewports(
    page,
    "/company/monitoring",
    "company-monitoring-buildings-final",
    viewports,
    outputPath,
  );
  await captureExactViewports(
    page,
    "/company/buildings/building-1/monitoring/door_node",
    "company-monitoring-final",
    viewports,
    outputPath,
    "monitoring-summary-grid",
  );
  await captureExactViewports(
    page,
    "/company/permissions",
    "company-permissions-final",
    viewports,
    outputPath,
  );
  await captureExactViewports(
    page,
    "/company/reports",
    "company-reports-final",
    viewports,
    outputPath,
  );

  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/company/dashboard", { waitUntil: "domcontentloaded" });
  const telemetryPoint = page.getByRole("button", { name: /8 sensor readings/i });
  await telemetryPoint.hover();
  const dashboardTooltip = page.getByRole("tooltip");
  await expect(dashboardTooltip).toBeVisible();
  const dashboardTooltipBox = await dashboardTooltip.boundingBox();
  expect(dashboardTooltipBox).not.toBeNull();
  expect(dashboardTooltipBox!.x).toBeGreaterThanOrEqual(0);
  expect(dashboardTooltipBox!.x + dashboardTooltipBox!.width).toBeLessThanOrEqual(1440);
  await page.screenshot({
    fullPage: true,
    path: outputPath("company-dashboard-telemetry-tooltip-1440x900.png"),
  });

  await page.goto("/company/buildings/building-1/monitoring/angle_node", {
    waitUntil: "domcontentloaded",
  });
  await page.getByText("Cards", { exact: true }).click();
  await page.getByRole("button", { name: /Node 101, Warning/i }).click();
  const anglePoint = page.getByRole("button", { name: /Reading received.*Warning.*X/i });
  await anglePoint.hover();
  const historyTooltip = page.getByRole("tooltip");
  await expect(historyTooltip).toContainText("X angle: 2.4°");
  await expect(historyTooltip).toContainText("Y angle: -1.1°");
  const historyTooltipBox = await historyTooltip.boundingBox();
  expect(historyTooltipBox).not.toBeNull();
  expect(historyTooltipBox!.x).toBeGreaterThanOrEqual(0);
  expect(historyTooltipBox!.x + historyTooltipBox!.width).toBeLessThanOrEqual(1440);
  await page.screenshot({
    fullPage: true,
    path: outputPath("company-angle-detail-tooltip-1440x900.png"),
  });
});

test("captures the persisted dark shell and theme-toggle interaction", async ({
  page,
}, testInfo) => {
  test.setTimeout(300000);
  const widths = [1440, 1280, 1024, 768, 375];
  const outputPath = (name: string) => testInfo.outputPath(name);
  await installFixture(page, "gss-admin", [
    "welcome.view",
    "companies.view",
    "companies.update",
    "companies.delete",
    "areas.view",
    "buildings.view",
    "company-users.view",
    "devices.view",
    "mqtt-commands.view",
  ]);
  await capture(page, "/admin/companies", "admin-companies", widths, outputPath, "dark");
  await capture(
    page,
    "/admin/companies/company-1",
    "admin-company-workspace",
    widths,
    outputPath,
    "dark",
  );
  await installFixture(page, "company-user", [
    "welcome.view",
    "areas.view",
    "buildings.view",
    "monitoring.view",
  ]);
  await capture(page, "/company/areas", "company-sites", widths, outputPath, "dark");
  await capture(page, "/company/buildings", "company-buildings", widths, outputPath, "dark");
  await capture(
    page,
    "/company/buildings/building-1/monitoring",
    "company-monitoring-selection",
    widths,
    outputPath,
    "dark",
  );
  await capture(
    page,
    "/company/buildings/building-1/monitoring/door_node",
    "company-monitoring-door-node",
    widths,
    outputPath,
    "dark",
  );
  await captureMonitoringTabs(page, outputPath, "dark");
  await installFixture(page, "gss-admin", [
    "welcome.view",
    "companies.view",
    "companies.update",
    "companies.delete",
    "areas.view",
    "buildings.view",
    "company-users.view",
    "devices.view",
    "mqtt-commands.view",
  ]);
  await page.goto("/admin/welcome", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);
  const toggle = page.getByTestId("theme-toggle");
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-mantine-color-scheme", "light");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-mantine-color-scheme", "light");
});

test("captures no-permission shell behavior with a test-only session fixture", async ({
  page,
}, testInfo) => {
  await installFixture(page, "gss-admin", ["welcome.view"]);
  await page.setViewportSize({ height: 900, width: 375 });
  await page.goto("/admin/welcome", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);
  await expect(page.getByText("Welcome, GSS Operator")).toBeVisible();
  await expect(page.getByRole("link", { name: "Companies" })).toHaveCount(0);
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("no-permission-admin-light-375.png"),
  });
});

test("captures Wave 1 review surfaces at the requested viewports", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const outputPath = (name: string) => testInfo.outputPath(name);
  const reviewRoutes = [
    { path: "/admin/design-system", slug: "admin-design-system", context: "gss-admin" as const },
    { path: "/admin/companies", slug: "admin-companies", context: "gss-admin" as const },
    {
      path: "/admin/companies/company-1",
      slug: "admin-company-detail",
      context: "gss-admin" as const,
    },
    { path: "/company/areas", slug: "company-areas", context: "company-user" as const },
    { path: "/company/buildings", slug: "company-buildings", context: "company-user" as const },
    { path: "/company/users", slug: "company-users", context: "company-user" as const },
  ];
  const permissions = {
    "gss-admin": [
      "welcome.view",
      "companies.view",
      "companies.update",
      "companies.delete",
      "companies.create",
      "areas.view",
      "buildings.view",
      "company-users.view",
      "company-users.create",
      "company-users.update",
      "company-users.delete",
      "company-users.manage",
      "devices.view",
      "gateways.view",
      "nodes.view",
      "settings.system.view",
    ],
    "company-user": [
      "welcome.view",
      "areas.view",
      "areas.create",
      "areas.delete",
      "buildings.view",
      "buildings.create",
      "buildings.delete",
      "monitoring.view",
      "company-users.view",
      "company-users.create",
      "company-users.update",
      "company-users.delete",
      "company-users.manage",
    ],
  } as const;

  for (const route of reviewRoutes) {
    await installFixture(page, route.context, permissions[route.context]);
    for (const viewport of [
      { height: 900, width: 1440, slug: "1440x900" },
      { height: 800, width: 1280, slug: "1280x800" },
      { height: 844, width: 390, slug: "390x844" },
    ]) {
      await page.setViewportSize({ height: viewport.height, width: viewport.width });
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(300);
      await expect(page.getByTestId("app-root")).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      ).toBe(true);
      await page.screenshot({
        fullPage: true,
        path: outputPath(`wave1-after-${route.slug}-${viewport.slug}.png`),
      });
    }
  }
});

test("captures Wave 2 review surfaces at the requested viewports", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const outputPath = (name: string) => testInfo.outputPath(name);
  const viewportSizes = [
    { height: 900, slug: "1440x900", width: 1440 },
    { height: 800, slug: "1280x800", width: 1280 },
    { height: 844, slug: "390x844", width: 390 },
  ];
  const routes = [
    { context: "gss-admin" as const, path: "/admin/devices", slug: "admin-devices" },
    {
      context: "gss-admin" as const,
      path: "/admin/gateway-commands",
      slug: "admin-gateway-commands",
    },
    { context: "company-user" as const, path: "/company/devices", slug: "company-devices" },
    {
      context: "company-user" as const,
      path: "/company/areas/area-1",
      slug: "company-area-detail",
    },
    {
      context: "company-user" as const,
      path: "/company/buildings/building-1",
      slug: "company-building-detail",
    },
    {
      context: "company-user" as const,
      path: "/company/buildings/building-1/plan",
      slug: "company-building-plan",
    },
    { context: "company-user" as const, path: "/company/roles", slug: "company-roles" },
  ];
  const permissions = {
    "gss-admin": [
      "welcome.view",
      "devices.view",
      "gateways.view",
      "gateways.create",
      "gateways.update",
      "gateways.delete",
      "gateways.assign",
      "nodes.view",
      "nodes.create",
      "nodes.update",
      "nodes.delete",
      "nodes.assign",
      "mqtt-commands.view",
      "mqtt-commands.manage",
    ],
    "company-user": [
      "welcome.view",
      "areas.view",
      "areas.update",
      "buildings.view",
      "buildings.update",
      "building-plans.view",
      "building-plans.manage",
      "monitoring.view",
      "company-devices.view",
      "company-users.view",
      "company-roles.view",
      "company-roles.manage",
      "company-permissions.view",
    ],
  } as const;

  for (const route of routes) {
    await installFixture(page, route.context, permissions[route.context]);
    for (const viewport of viewportSizes) {
      await page.setViewportSize({ height: viewport.height, width: viewport.width });
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(300);
      await expect(page.getByTestId("app-root")).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      ).toBe(true);
      await page.screenshot({
        fullPage: true,
        path: outputPath(`wave2-after-${route.slug}-${viewport.slug}.png`),
      });
    }
  }
});

test("audits dark shared surface computed styles", async ({ page }, testInfo) => {
  await installFixture(page, "gss-admin", [
    "welcome.view",
    "companies.view",
    "mqtt-commands.view",
    "reports.view",
  ]);
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/admin/gateway-commands", { waitUntil: "domcontentloaded" });
  await page.evaluate(({ key }) => window.localStorage.setItem(key, "dark"), {
    key: colorSchemeKey,
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("app-root")).toBeVisible();

  const account = page.getByRole("button", { name: "Open account menu" });
  await account.click();
  const menu = page.locator(".mantine-Menu-dropdown");
  const menuSurface = await menu.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    border: getComputedStyle(element).borderTopColor,
  }));
  const menuText = await menu
    .locator(".mantine-Menu-item")
    .first()
    .evaluate((element) => ({
      color: getComputedStyle(element).color,
      background: getComputedStyle(element).backgroundColor,
    }));
  const menuLabel = await menu
    .locator(".mantine-Menu-label")
    .first()
    .evaluate((element) => ({
      color: getComputedStyle(element).color,
    }));

  const companiesLink = page.getByRole("link", { name: "Companies" });
  await companiesLink.hover();
  const sidebarHover = await companiesLink.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    color: getComputedStyle(element).color,
  }));

  const rows = page.locator(".gss-data-table tbody tr");
  const zebra = await rows.nth(0).evaluate((element) => getComputedStyle(element).backgroundColor);
  await rows.nth(0).hover();
  const rowHover = await rows
    .nth(0)
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  await rows.nth(0).evaluate((element) => element.setAttribute("data-selected", "true"));
  const rowSelected = await rows
    .nth(0)
    .evaluate((element) => getComputedStyle(element).backgroundColor);

  const variables = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      dark5: styles.getPropertyValue("--mantine-color-dark-5").trim(),
      dark6: styles.getPropertyValue("--mantine-color-dark-6").trim(),
      panel: styles.getPropertyValue("--gss-panel").trim(),
      tableHover: styles.getPropertyValue("--gss-table-hover").trim(),
      tableSelected: styles.getPropertyValue("--gss-table-selected").trim(),
      tableStripe: styles.getPropertyValue("--gss-table-stripe").trim(),
    };
  });
  expect(menuSurface.background).not.toBe("rgb(46, 46, 46)");
  expect(menuText.color).toBe("rgb(216, 228, 241)");
  expect(menuLabel.color).toBe("rgb(216, 228, 241)");
  expect(sidebarHover.background).not.toBe("rgb(46, 46, 46)");
  expect(zebra).not.toBe("rgb(46, 46, 46)");
  expect(rowHover).not.toBe(zebra);
  expect(rowSelected).not.toBe(rowHover);
  expect(variables.tableStripe).toBe("#14283e");
  expect(variables.tableHover).toBe("#1d3855");
  expect(variables.tableSelected).toBe("#20486c");
  await page.goto("/admin/reports", { waitUntil: "domcontentloaded" });
  const disabledButton = page.getByRole("button", { name: "Export permission required" });
  const disabledSurface = await disabledButton.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      background: styles.backgroundColor,
      color: styles.color,
      opacity: styles.opacity,
      className: element.className,
    };
  });
  console.log(JSON.stringify({ disabledSurface }));
  expect(disabledSurface.background).toBe("rgb(26, 45, 68)");
  expect(disabledSurface.color).toBe("rgb(102, 120, 141)");
  await testInfo.attach("dark-surface-audit.json", {
    body: JSON.stringify(
      {
        menuSurface,
        menuText,
        menuLabel,
        sidebarHover,
        zebra,
        rowHover,
        rowSelected,
        variables,
        disabledSurface,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  console.log(
    JSON.stringify({
      menuSurface,
      menuText,
      menuLabel,
      sidebarHover,
      zebra,
      rowHover,
      rowSelected,
      variables,
      disabledSurface,
    }),
  );
});

test("captures dark shared surface evidence across navigation and tables", async ({
  page,
}, testInfo) => {
  test.setTimeout(300000);
  const outputPath = (name: string) => testInfo.outputPath(name);
  await installFixture(page, "gss-admin", [
    "welcome.view",
    "companies.view",
    "companies.update",
    "companies.delete",
    "mqtt-commands.view",
    "alarms.view",
    "reports.view",
    "areas.view",
    "buildings.view",
    "company-users.view",
    "devices.view",
  ]);
  await captureSurfaceEvidence(page, outputPath, "dark");
  await captureSurfaceEvidence(page, outputPath, "light");
});

test("keeps Admin Alarm resolved-row selection free of browser errors", async ({
  page,
}, testInfo) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.stack ?? error.message));

  await installFixture(page, "gss-admin", ["alarms.view", "alarms.manage"]);
  await page.goto("/admin/alarms", { waitUntil: "domcontentloaded" });
  const resolved = page.getByRole("checkbox", { name: "Select: 101" });
  const unresolved = page.getByRole("checkbox", { name: "Select: 100" });
  await expect(unresolved).toBeDisabled();
  await resolved.click();
  await page.getByRole("button", { name: "Delete selected (1)" }).click();
  let confirmation = page.getByRole("dialog", { name: "Delete selected alarms?" });
  await expect(confirmation).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("admin-alarm-bulk-confirm-desktop.png"),
  });
  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(resolved).toBeChecked();
  await page.getByRole("button", { name: "Delete selected (1)" }).click();
  confirmation = page.getByRole("dialog", { name: "Delete selected alarms?" });
  await confirmation.getByRole("button", { name: "Delete selected (1)" }).click();
  await expect(confirmation).toBeHidden();
  await expect(
    page.getByTestId("app-root").getByRole("button", { name: "Delete selected (0)" }),
  ).toBeDisabled();

  await page.setViewportSize({ height: 844, width: 390 });
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("admin-alarm-bulk-mobile.png"),
  });

  expect(browserErrors).toEqual([]);
});

test("captures the private PLAN and REAL monitoring viewer interactions", async ({
  page,
}, testInfo) => {
  test.setTimeout(180000);
  await installFixture(page, "company-user", [
    "monitoring.view",
    "monitoring.realtime",
    "building-plans.view",
    "alarm-levels.view",
  ]);
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/company/buildings/building-1/monitoring/door_node", {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("tab", { name: "Building plan image" }).click();
  const viewer = page.locator(".gss-building-image-viewer");
  const image = viewer.locator("img");
  await expect(image).toBeVisible();
  await expect(image).toHaveCSS("object-fit", "contain");
  await expect(image).toHaveCSS("transform", /matrix\(1, 0, 0, 1/);
  const [viewerBox, imageBox] = await Promise.all([viewer.boundingBox(), image.boundingBox()]);
  expect(viewerBox).not.toBeNull();
  expect(imageBox).not.toBeNull();
  expect(imageBox!.width).toBeLessThanOrEqual(viewerBox!.width + 1);
  expect(imageBox!.height).toBeLessThanOrEqual(viewerBox!.height + 1);
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("company-plan-viewer-fitted-desktop-light.png"),
  });

  await page.getByRole("button", { name: "Zoom in" }).click();
  await viewer.hover({ position: { x: Math.round(viewerBox!.width * 0.7), y: 200 } });
  await page.mouse.wheel(0, -240);
  await expect(page.getByText(/%/).last()).not.toHaveText("100%");
  const beforePan = await image.getAttribute("style");
  await page.mouse.move(viewerBox!.x + viewerBox!.width / 2, viewerBox!.y + viewerBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    viewerBox!.x + viewerBox!.width / 2 + 80,
    viewerBox!.y + viewerBox!.height / 2 + 40,
  );
  await page.mouse.up();
  expect(await image.getAttribute("style")).not.toBe(beforePan);
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("company-plan-viewer-zoomed-desktop-light.png"),
  });
  await page.getByRole("button", { name: "Reset image view" }).click();
  await expect(page.getByText("100%")).toBeVisible();

  await page.getByRole("tab", { name: "Real image" }).click();
  await expect(viewer.locator("img")).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("company-real-viewer-fitted-desktop-light.png"),
  });
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("company-real-viewer-zoomed-desktop-light.png"),
  });

  await page.setViewportSize({ height: 844, width: 390 });
  await page.evaluate(({ key }) => window.localStorage.setItem(key, "dark"), {
    key: colorSchemeKey,
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Building plan image" }).click();
  await expect(page.locator(".gss-building-image-viewer img")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("company-plan-viewer-fitted-mobile-dark.png"),
  });

  await page.route(`${apiOrigin}/company/buildings/building-1/images`, (route) =>
    route.fulfill({ json: [] }),
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Building plan image" }).click();
  await expect(page.getByText("No building plan image is available.")).toBeVisible();
  await page.getByRole("tab", { name: "Real image" }).click();
  await expect(page.getByText("No real building image is available.")).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("company-real-viewer-empty-mobile-dark.png"),
  });
});

test("captures corrected Admin policy, Company cards and Administrator management", async ({
  page,
}, testInfo) => {
  test.setTimeout(180000);
  await installFixture(page, "gss-admin", [
    "companies.view",
    "companies.update",
    "companies.delete",
    "alarm-rules.view",
    "alarm-rules.manage",
    "admin-users.view",
    "admin-users.create",
    "admin-users.update",
    "admin-users.delete",
    "admin-roles.view",
    "permissions.view",
  ]);
  await page.setViewportSize({ height: 900, width: 1440 });

  await page.goto("/admin/alarm-rules", { waitUntil: "domcontentloaded" });
  const policyRow = page.getByRole("row", { name: "Open: Tower A danger rule" });
  await expect(policyRow).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Actions" })).toHaveCount(1);
  await policyRow.click();
  await expect(page.getByRole("dialog", { name: "Recipient policy details" })).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("admin-policy-table-drawer-desktop-light.png"),
  });

  await page.goto("/admin/companies", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".gss-company-identity-card")).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("admin-company-identity-cards-desktop-light.png"),
  });
  const cardMenu = page.getByRole("button", { name: "More actions: Acme Safety" });
  await cardMenu.click();
  await expect(page).toHaveURL(/\/admin\/companies$/);

  await page.goto("/admin/settings/admin-users", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Administrators" })).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("admin-administrators-list-desktop-light.png"),
  });
  await page.getByRole("button", { name: "Create Administrator" }).click();
  await expect(page.getByRole("dialog", { name: "Create Administrator" })).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: testInfo.outputPath("admin-administrators-create-desktop-light.png"),
  });
  await page
    .getByRole("dialog", { name: "Create Administrator" })
    .getByRole("button")
    .first()
    .click();
  await page.getByRole("row", { name: "Administrator details: GSS Operator" }).click();
  await page
    .getByRole("dialog", { name: "Administrator details" })
    .getByRole("button", { name: "Edit Administrator" })
    .click();
  await expect(page.getByRole("dialog", { name: "Edit Administrator" })).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: testInfo.outputPath("admin-administrators-edit-desktop-light.png"),
  });

  await page.setViewportSize({ height: 844, width: 390 });
  await page.evaluate(({ key }) => window.localStorage.setItem(key, "dark"), {
    key: colorSchemeKey,
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Administrators" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("admin-administrators-list-mobile-dark.png"),
  });
});

test("captures the Company users KPI and expanded logo plate", async ({ page }, testInfo) => {
  await installFixture(page, "company-user", ["dashboard.view"]);
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/company/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Company users")).toBeVisible();
  await expect(page.locator(".gss-company-sidebar-logo-plate img")).toBeVisible();
  const kpiRowTops = await page
    .getByTestId("dashboard-kpi-grid")
    .evaluate((element) =>
      [...element.children].map((child) => Math.round(child.getBoundingClientRect().top)),
    );
  expect(kpiRowTops.filter((top) => top === kpiRowTops[0])).toHaveLength(6);
  expect(new Set(kpiRowTops).size).toBe(2);
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("company-dashboard-kpi-logo-desktop-light.png"),
  });

  await page.setViewportSize({ height: 844, width: 390 });
  await page.evaluate(({ key }) => window.localStorage.setItem(key, "dark"), {
    key: colorSchemeKey,
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await expect(page.locator(".gss-company-sidebar-logo-plate img")).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("company-dashboard-kpi-logo-mobile-dark.png"),
  });
});

test("verifies Archive Center detail, export, purge failure/retry and responsive states", async ({
  page,
}, testInfo) => {
  await installFixture(page, "gss-admin", [
    "archive.purge",
    "archive.view",
    "companies.delete",
    "reports.export",
  ]);
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/admin/archive", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "GSS Archive Center" })).toBeVisible();
  await expect(page.getByText("Archived Acme")).toBeVisible();

  await page.getByRole("button", { name: "View detail" }).click();
  await expect(page.getByText("Archive evidence detail")).toBeVisible();
  await expect(page.getByText("Backend dependency counts")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Export evidence" }).focus();
  await expect(page.getByRole("button", { name: "Export evidence" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/COMPLETED · 100%/)).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole("button", { name: "Download evidence" })).toBeVisible();

  await page.getByRole("button", { name: "Permanently delete" }).click();
  await expect(page.getByText("Physical and irreversible deletion")).toBeVisible();
  await page.getByLabel("Type the exact record name to confirm").fill("Archived Acme");
  await page.getByRole("button", { name: "Start permanent deletion" }).click();
  await expect(page.getByText("STORAGE_DELETE_FAILED")).toBeVisible();
  await page.getByRole("button", { name: "Retry failed job" }).click();
  await expect(page.getByText(/COMPLETED · COMPLETE/)).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: "Close" }).click();

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("archive-center-desktop.png"),
  });
  await page.setViewportSize({ height: 800, width: 1280 });
  await page.screenshot({ fullPage: true, path: testInfo.outputPath("archive-center-tablet.png") });
  await page.setViewportSize({ height: 844, width: 390 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
  await page.screenshot({ fullPage: true, path: testInfo.outputPath("archive-center-mobile.png") });
});

test("verifies Admin and Company Sensor History chart/filter and GSS-only filtered purge", async ({
  page,
}, testInfo) => {
  await installFixture(page, "gss-admin", [
    "archive.purge",
    "monitoring.view",
    "reports.export",
    "sensor-readings.purge",
  ]);
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/admin/monitoring/history", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Sensor Reading History" })).toBeVisible();
  await expect(page.getByText("Filtered history chart")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Angle Node" })).toBeVisible();
  await page.getByLabel("Status", { exact: true }).selectOption("WARNING");
  await expect(page.getByRole("cell", { name: "101" })).toBeVisible();
  await page.getByRole("button", { name: "Purge filtered readings" }).click();
  await expect(page.getByText(/1 of 2 matched readings are eligible/)).toBeVisible();
  await page.getByLabel("Type DELETE 1 to confirm").fill("DELETE 1");
  await page.getByRole("button", { name: "Start permanent purge" }).click();
  await expect(page.getByText(/COMPLETED · COMPLETE/)).toBeVisible({ timeout: 5_000 });
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("sensor-history-admin-desktop.png"),
  });

  await page.setViewportSize({ height: 844, width: 390 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("sensor-history-admin-mobile.png"),
  });

  const companyPage = await page.context().newPage();
  await installFixture(companyPage, "company-user", ["monitoring.view", "reports.export"]);
  await companyPage.setViewportSize({ height: 800, width: 1280 });
  await companyPage.goto("/company/monitoring/history", { waitUntil: "domcontentloaded" });
  await expect(companyPage.getByRole("heading", { name: "Sensor Reading History" })).toBeVisible();
  await expect(companyPage.getByRole("button", { name: "Purge filtered readings" })).toHaveCount(0);
  await expect(companyPage.getByText("Filtered history chart")).toBeVisible();
  await companyPage.screenshot({
    fullPage: true,
    path: testInfo.outputPath("sensor-history-company-tablet.png"),
  });
  await companyPage.close();
});

test("verifies persisted KO/EN switching in Admin and Company at required viewports", async ({
  context,
  page,
}) => {
  test.setTimeout(300_000);
  const permissions = ["welcome.view", "dashboard.view", "monitoring.view", "notifications.view"];
  const screenshotRoot = path.resolve("..", "..", "output", "playwright");
  await mkdir(screenshotRoot, { recursive: true });

  async function verifyPortal(
    target: Page,
    portal: "admin" | "company",
    route: "/admin/dashboard" | "/company/dashboard",
  ) {
    await target.goto(route, { waitUntil: "domcontentloaded" });
    await target.evaluate((key) => window.localStorage.removeItem(key), localeKey);
    await target.reload({ waitUntil: "domcontentloaded" });
    await expect(target.locator("html")).toHaveAttribute("lang", "ko");
    await expect(target.getByRole("button", { name: "언어 선택" })).toBeVisible();

    for (const viewport of [
      { height: 900, name: "1440x900", width: 1440 },
      { height: 800, name: "1280x800", width: 1280 },
      { height: 844, name: "390x844", width: 390 },
    ]) {
      await target.setViewportSize({ height: viewport.height, width: viewport.width });
      await expect(target.getByTestId("app-root")).toBeVisible();
      expect(
        await target.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await target.screenshot({
        fullPage: true,
        path: path.join(screenshotRoot, `i18n-${portal}-ko-${viewport.name}.png`),
      });
    }

    await target.setViewportSize({ height: 900, width: 1440 });
    await target.getByRole("button", { name: "언어 선택" }).click();
    await target.getByText("English", { exact: true }).click();
    await expect(target.locator("html")).toHaveAttribute("lang", "en");
    await expect(target.getByRole("button", { name: "Select language" })).toBeVisible();
    expect(await target.evaluate((key) => window.localStorage.getItem(key), localeKey)).toBe("en");
    await target.reload({ waitUntil: "domcontentloaded" });
    await expect(target.locator("html")).toHaveAttribute("lang", "en");

    for (const viewport of [
      { height: 900, name: "1440x900", width: 1440 },
      { height: 800, name: "1280x800", width: 1280 },
      { height: 844, name: "390x844", width: 390 },
    ]) {
      await target.setViewportSize({ height: viewport.height, width: viewport.width });
      expect(
        await target.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await target.screenshot({
        fullPage: true,
        path: path.join(screenshotRoot, `i18n-${portal}-en-${viewport.name}.png`),
      });
    }
  }

  await installFixture(page, "gss-admin", permissions, { locale: null });
  await verifyPortal(page, "admin", "/admin/dashboard");

  const companyPage = await context.newPage();
  await installFixture(companyPage, "company-user", permissions, { locale: null });
  await verifyPortal(companyPage, "company", "/company/dashboard");
  await companyPage.close();
});
