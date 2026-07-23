import type { AuthSession } from "@gss-iot/contracts";
import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";

const storageKey = "gss-iot-v3-auth-session";
const apiBaseUrl = "http://localhost:3000";

const companySession: AuthSession = {
  accessToken: "company-token",
  context: "company-user",
  user: {
    companyId: "company-1",
    email: "manager@example.com",
    id: "user-manager",
    isActive: true,
    isSuperAdmin: false,
    name: "Manager",
    permissions: [
      "welcome.view",
      "dashboard.view",
      "areas.view",
      "areas.update",
      "buildings.view",
      "building-plans.view",
      "building-plans.manage",
      "company-devices.view",
      "company-users.view",
      "company-users.create",
      "company-users.update",
      "company-users.manage",
      "company-roles.view",
      "company-roles.manage",
      "company-permissions.view",
    ],
  },
};

const roles = [
  {
    _count: { users: 1 },
    companyId: "company-1",
    id: "role-platform",
    isCompanyOwnerRole: true,
    isSystem: true,
    key: "platform_manager",
    name: "Platform Manager",
    permissions: [],
  },
  {
    _count: { users: 0 },
    companyId: "company-1",
    id: "role-custom",
    isCompanyOwnerRole: false,
    isSystem: false,
    key: "safety_lead",
    name: "Safety Lead",
    permissions: [{ permissionId: "perm-monitoring" }],
  },
];

const permissions = [
  {
    action: "view",
    id: "perm-monitoring",
    key: "monitoring.view",
    module: "monitoring",
    scopeType: "BOTH",
  },
  {
    action: "view",
    id: "perm-reports",
    key: "reports.view",
    module: "reports",
    scopeType: "BOTH",
  },
];

function renderApp(path: string) {
  window.history.pushState({}, "", path);
  return render(
    <MantineProvider theme={gssTheme}>
      <App />
    </MantineProvider>,
  );
}

function storeCompanySession(session: AuthSession = companySession) {
  window.sessionStorage.setItem(
    storageKey,
    JSON.stringify({ accessToken: session.accessToken, context: session.context }),
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

function mockFetch(session: AuthSession = companySession, options: { usersStatus?: number } = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    if (url.href === `${apiBaseUrl}/auth/company/me`) return jsonResponse(session);
    if (url.href === `${apiBaseUrl}/company/roles`) return jsonResponse(roles);
    if (url.href === `${apiBaseUrl}/company/permissions`) return jsonResponse(permissions);
    if (url.href === `${apiBaseUrl}/company/users`) {
      if (options.usersStatus) {
        return jsonResponse({ message: "Forbidden" }, options.usersStatus);
      }
      return jsonResponse([
        {
          areaAccess: [
            { accessLevel: "VIEW", areaId: "area-1", area: { id: "area-1", name: "Site A" } },
          ],
          buildingAccess: [],
          companyId: "company-1",
          email: "worker@example.com",
          id: "user-1",
          isActive: true,
          name: "Worker",
          permissions: [],
          positionAssignments: [],
          role: {
            id: "role-custom",
            isCompanyOwnerRole: false,
            key: "safety_lead",
            name: "Safety Lead",
          },
          roleId: "role-custom",
        },
      ]);
    }
    if (url.href === `${apiBaseUrl}/company/areas`) {
      return jsonResponse([
        {
          address: null,
          companyId: "company-1",
          description: null,
          id: "area-1",
          name: "Site A",
          status: "ACTIVE",
        },
      ]);
    }
    if (url.href === `${apiBaseUrl}/company/areas/area-1`) {
      return jsonResponse({
        address: null,
        companyId: "company-1",
        description: null,
        id: "area-1",
        name: "Site A",
        status: "ACTIVE",
      });
    }
    if (url.href === `${apiBaseUrl}/company/buildings`) {
      return jsonResponse([
        {
          address: null,
          areaId: "area-1",
          buildingType: null,
          companyId: "company-1",
          id: "building-1",
          number: null,
          status: "ACTIVE",
          title: "Building A",
        },
      ]);
    }
    if (url.href === `${apiBaseUrl}/company/buildings/building-1`) {
      return jsonResponse({
        address: null,
        areaId: "area-1",
        buildingType: null,
        companyId: "company-1",
        id: "building-1",
        number: null,
        status: "ACTIVE",
        title: "Building A",
      });
    }
    if (url.href === `${apiBaseUrl}/company/devices`) {
      return jsonResponse({ gateways: [], nodes: [] });
    }
    if (url.href === `${apiBaseUrl}/company/buildings/building-1/plan-images`) {
      if (init.method === "POST") return jsonResponse([], 201);
      return jsonResponse([
        {
          buildingId: "building-1",
          createdAt: "2026-07-19T00:00:00.000Z",
          height: null,
          id: "image-1",
          kind: "PLAN",
          orderIndex: 0,
          storageKey: "plans/building-a.png",
          width: null,
        },
      ]);
    }
    if (url.href === `${apiBaseUrl}/company/positions`) return jsonResponse([]);
    if (url.href === `${apiBaseUrl}/company/roles/role-custom`) return jsonResponse(roles[1]);
    return jsonResponse({}, 200);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("company management UI", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("updates custom role permissions from the role editor", async () => {
    storeCompanySession();
    const fetchMock = mockFetch();
    renderApp("/company/roles");

    fireEvent.click(await screen.findByRole("button", { name: "Edit role" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit role" });
    fireEvent.click(within(dialog).getByLabelText("reports.view"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(
      fetchMock.mock.calls.some(([input, init]) => {
        return (
          String(input) === `${apiBaseUrl}/company/roles/role-custom` &&
          init?.method === "PATCH" &&
          String(init.body).includes("perm-reports")
        );
      }),
    ).toBe(true);
  });

  it("renders no-permission navigation without protected company management links", async () => {
    storeCompanySession({
      ...companySession,
      user: { ...companySession.user, permissions: ["welcome.view"] },
    });
    mockFetch({
      ...companySession,
      user: { ...companySession.user, permissions: ["welcome.view"] },
    });
    renderApp("/company/welcome");

    expect(await screen.findByRole("link", { name: "Welcome" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Users" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Roles" })).toBeNull();
  });

  it("renders building plan metadata and posts storage-key additions", async () => {
    storeCompanySession();
    const fetchMock = mockFetch();
    renderApp("/company/buildings/building-1/plan");

    expect(await screen.findByText("plans/building-a.png")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add plan image" }));
    const dialog = await screen.findByRole("dialog", { name: "Add plan image" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Storage key" }), {
      target: { value: "plans/new.png" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add plan image" }));

    expect(
      fetchMock.mock.calls.some(([input, init]) => {
        return (
          String(input) === `${apiBaseUrl}/company/buildings/building-1/plan-images` &&
          init?.method === "POST" &&
          String(init.body).includes("plans/new.png")
        );
      }),
    ).toBe(true);
  });

  it("loads area detail without requesting assigned users when the permission is absent", async () => {
    const session = {
      ...companySession,
      user: {
        ...companySession.user,
        permissions: ["welcome.view", "areas.view", "buildings.view"],
      },
    };
    storeCompanySession(session);
    const fetchMock = mockFetch(session);
    renderApp("/company/areas/area-1");

    expect(await screen.findByText("Site A")).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(([input]) => String(input) === `${apiBaseUrl}/company/users`),
    ).toBe(false);
  });

  it("keeps area detail rendered when the optional assigned-users query is forbidden", async () => {
    storeCompanySession();
    mockFetch(companySession, { usersStatus: 403 });
    renderApp("/company/areas/area-1");

    expect(await screen.findByText("Site A")).toBeTruthy();
    expect(screen.queryByText("Unable to load data")).toBeNull();
  });

  it("loads building detail without users or devices requests when optional permissions are absent", async () => {
    const session = {
      ...companySession,
      user: {
        ...companySession.user,
        permissions: ["welcome.view", "areas.view", "buildings.view", "monitoring.view"],
      },
    };
    storeCompanySession(session);
    const fetchMock = mockFetch(session);
    renderApp("/company/buildings/building-1");

    expect(await screen.findByText("Building A")).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(([input]) => String(input) === `${apiBaseUrl}/company/users`),
    ).toBe(false);
    expect(
      fetchMock.mock.calls.some(([input]) => String(input) === `${apiBaseUrl}/company/devices`),
    ).toBe(false);
  });

  it("renders users page from company-users.view without role or permission catalog reads", async () => {
    const session = {
      ...companySession,
      user: { ...companySession.user, permissions: ["welcome.view", "company-users.view"] },
    };
    storeCompanySession(session);
    const fetchMock = mockFetch(session);
    renderApp("/company/users");

    expect(await screen.findByText("Worker")).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(([input]) => String(input) === `${apiBaseUrl}/company/roles`),
    ).toBe(false);
    expect(
      fetchMock.mock.calls.some(([input]) => String(input) === `${apiBaseUrl}/company/permissions`),
    ).toBe(false);
  });

  it("renders roles page from company-roles.view without permission catalog reads", async () => {
    const session = {
      ...companySession,
      user: { ...companySession.user, permissions: ["welcome.view", "company-roles.view"] },
    };
    storeCompanySession(session);
    const fetchMock = mockFetch(session);
    renderApp("/company/roles");

    expect(await screen.findByText("Platform Manager")).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(([input]) => String(input) === `${apiBaseUrl}/company/permissions`),
    ).toBe(false);
  });
});
