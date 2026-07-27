import { expect, test, type Page } from "@playwright/test";

const apiOrigin = "http://localhost:3000";
const storageKey = "gss-iot-v3-auth-session";
const colorSchemeKey = "mantine-color-scheme-value";
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
) {
  const session = sessionFor(context, permissions);
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
    if (path === "/admin/companies" || path === "/admin/companies/company-1")
      return route.fulfill({ json: path.endsWith("company-1") ? company : [company] });
    if (path === "/admin/alarms" || path === "/company/alarms")
      return route.fulfill({ json: { items: alarmEvents } });
    if (path === "/admin/reports" || path === "/company/reports")
      return route.fulfill({ json: { items: reportJobs, page: 1, pageSize: 25, total: 1 } });
    if (path === "/company/users") return route.fulfill({ json: companyUsers });
    if (path === "/admin/companies/company-1/users") return route.fulfill({ json: companyUsers });
    if (path === "/admin/devices/gateways") return route.fulfill({ json: wave2Gateways });
    if (path === "/admin/devices/nodes") return route.fulfill({ json: wave2Nodes });
    if (path === "/admin/devices/node-types") return route.fulfill({ json: nodeTypes });
    if (path === "/admin/devices/provisioning-options")
      return route.fulfill({
        json: { areas, buildings, companies: [company] },
      });
    if (path === "/company/devices")
      return route.fulfill({ json: { gateways: wave2Gateways, nodes: wave2Nodes } });
    if (path === "/company/roles") return route.fulfill({ json: wave2Roles });
    if (path === "/company/permissions") return route.fulfill({ json: wave2Permissions });
    if (path === "/admin/permissions") return route.fulfill({ json: adminCatalogPermissions });
    if (path === "/company/areas/area-1") return route.fulfill({ json: areas[0] });
    if (path === "/company/buildings/building-1") return route.fulfill({ json: buildings[0] });
    if (path === "/company/buildings/building-1/plan-images")
      return route.fulfill({
        json: [
          {
            buildingId: buildings[0].id,
            createdAt: "2026-07-23T08:00:00.000Z",
            height: null,
            id: "plan-1",
            kind: "PLAN",
            orderIndex: 0,
            storageKey: "plans/tower-a.png",
            width: null,
          },
        ],
      });
    if (path.endsWith("/areas")) return route.fulfill({ json: areas });
    if (path.endsWith("/buildings")) return route.fulfill({ json: buildings });
    if (
      path.endsWith("/users") ||
      path.endsWith("/roles") ||
      path.endsWith("/devices/gateways") ||
      path.endsWith("/devices/nodes")
    )
      return route.fulfill({ json: [] });
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
          pageSize: 25,
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
          pageSize: 25,
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
      return route.fulfill({ json: { items: [] } });
    if (path === "/admin/alarm-rules/options" || path === "/company/alarm-rules/options")
      return route.fulfill({ json: { buildings: [], nodeTypes: [], positions: [], users: [] } });
    if (path === "/admin/gateway-commands") return route.fulfill({ json: gatewayCommands });
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
    await page.getByRole("button", { name: "Open", exact: true }).first().click();
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

test("captures protected Admin and Company redesign pages at required widths", async ({
  page,
}, testInfo) => {
  test.setTimeout(300000);
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
      await expect(page.locator('[aria-label="Global Smart Solutions"]:visible')).toBeVisible();
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

test("captures Wave 4 final evidence at exact responsive viewports", async ({ page }, testInfo) => {
  test.setTimeout(240000);
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
    "dashboard-kpi-grid",
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
