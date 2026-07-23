import { expect, test, type Page } from "@playwright/test";

const apiOrigin = "http://localhost:3000";
const storageKey = "gss-iot-v3-auth-session";
const colorSchemeKey = "mantine-color-scheme-value";
const company = {
  address: "Seoul Operations District",
  code: "GSS-001",
  email: "ops@gss.example",
  id: "company-1",
  name: "Acme Safety",
  phone: "+82 2 0000 0000",
  status: "ACTIVE",
};
const areas = [
  {
    address: "Mapo-gu, Seoul",
    companyId: company.id,
    description: "North construction site",
    id: "area-1",
    name: "North Site",
    status: "ACTIVE",
  },
];
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
];
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
];

function sessionFor(context: "gss-admin" | "company-user", permissions: string[]) {
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
  permissions: string[],
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
    if (path === "/admin/companies" || path === "/admin/companies/company-1")
      return route.fulfill({ json: path.endsWith("company-1") ? company : [company] });
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
    if (path.includes("/monitoring/door_node/nodes/") && path.endsWith("/history"))
      return route.fulfill({ json: { items: [], page: 1, pageSize: 25, total: 0 } });
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
    if (path === "/admin/reports" || path === "/company/reports")
      return route.fulfill({ json: { items: [], page: 1, pageSize: 25, total: 0 } });
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
        },
      });
    if (path === "/admin/alarm-rules" || path === "/company/alarm-rules")
      return route.fulfill({ json: { items: [] } });
    if (path === "/admin/alarm-rules/options" || path === "/company/alarm-rules/options")
      return route.fulfill({ json: { buildings: [], nodeTypes: [], positions: [], users: [] } });
    if (path === "/admin/gateway-commands") return route.fulfill({ json: [] });
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
    "users.view",
    "roles.view",
  ]);
  await capture(page, "/company/dashboard", "company-dashboard", compactWidths, outputPath);
  await capture(page, "/company/alarms", "company-alarms", compactWidths, outputPath);
  await capture(page, "/company/reports", "company-reports", compactWidths, outputPath);
  await capture(page, "/company/roles", "company-roles-form", compactWidths, outputPath);
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
