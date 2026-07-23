import { expect, test, type Page } from "@playwright/test";

const apiOrigin = "http://localhost:3000";
const storageKey = "gss-iot-v3-auth-session";
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
) {
  for (const width of widths) {
    await page.setViewportSize({ height: 900, width });
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);
    await expect(page.getByTestId("app-root")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);
    await page.screenshot({ fullPage: true, path: outputPath(`${slug}-${width}.png`) });
  }
}

test("captures protected Admin and Company redesign pages at required widths", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
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
  await capture(page, "/admin/companies", "admin-companies", widths, outputPath);
  await capture(page, "/admin/companies/company-1", "admin-company-workspace", widths, outputPath);
  await capture(page, "/admin/gateway-commands", "admin-gateway-commands", widths, outputPath);
  await installFixture(page, "company-user", [
    "welcome.view",
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
    path: testInfo.outputPath("no-permission-admin-375.png"),
  });
});
