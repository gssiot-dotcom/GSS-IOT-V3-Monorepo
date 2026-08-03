import type { AuthSession } from "@gss-iot/contracts";
import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";

const storageKey = "gss-iot-v3-auth-context";
const apiBaseUrl = "http://localhost:3000";

const companySession: AuthSession = {
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
    deletion: {
      allowed: false,
      blocker: "System roles cannot be deleted.",
      code: "SYSTEM_ROLE",
      mode: "NOT_ALLOWED",
    },
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
    deletion: { allowed: true, blocker: null, code: null, mode: "HARD_DELETE" },
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
  window.sessionStorage.setItem(storageKey, JSON.stringify({ context: session.context }));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

function mockFetch(
  session: AuthSession = companySession,
  options: { usersStatus?: number; withPositionAssignment?: boolean } = {},
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    if (url.href === `${apiBaseUrl}/auth/company/me`) return jsonResponse(session);
    if (url.pathname === "/company/roles")
      return jsonResponse({ items: roles, page: 1, pageSize: 100, total: roles.length });
    if (url.pathname === "/company/permissions/options") return jsonResponse(permissions);
    if (url.pathname === "/company/users") {
      if (options.usersStatus) {
        return jsonResponse({ message: "Forbidden" }, options.usersStatus);
      }
      const items = [
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
          positionAssignments: options.withPositionAssignment
            ? [
                {
                  areaId: "area-1",
                  assignedAt: "2026-07-20T00:00:00.000Z",
                  buildingId: "building-1",
                  id: "assignment-1",
                  position: {
                    companyId: "company-1",
                    id: "position-1",
                    isActive: true,
                    key: "safety_owner",
                    name: "Safety Owner",
                  },
                  positionId: "position-1",
                },
              ]
            : [],
          role: {
            id: "role-custom",
            isCompanyOwnerRole: false,
            key: "safety_lead",
            name: "Safety Lead",
          },
          roleId: "role-custom",
        },
      ];
      return jsonResponse({ items, page: 1, pageSize: 50, total: items.length });
    }
    if (url.pathname === "/company/areas") {
      const items = [
        {
          address: null,
          companyId: "company-1",
          description: null,
          id: "area-1",
          name: "Site A",
          status: "ACTIVE",
        },
      ];
      return jsonResponse({ items, page: 1, pageSize: 100, total: items.length });
    }
    if (url.href === `${apiBaseUrl}/company/areas/area-1/overview`) {
      const canViewUsers =
        session.user.permissions.includes("company-users.view") && !options.usersStatus;
      const canViewDevices = session.user.permissions.includes("company-devices.view");
      const canViewBuildings = session.user.permissions.includes("buildings.view");
      return jsonResponse({
        area: {
          address: null,
          companyId: "company-1",
          description: null,
          id: "area-1",
          name: "Site A",
          status: "ACTIVE",
        },
        buildings: {
          available: canViewBuildings,
          items: canViewBuildings
            ? [
                {
                  address: null,
                  areaId: "area-1",
                  buildingType: null,
                  companyId: "company-1",
                  id: "building-1",
                  metrics: {
                    assignedUsers: canViewUsers ? 1 : null,
                    gateways: canViewDevices ? 0 : null,
                    nodes: canViewDevices ? 0 : null,
                  },
                  number: null,
                  status: "ACTIVE",
                  title: "Building A",
                },
              ]
            : [],
          total: canViewBuildings ? 1 : null,
        },
        metrics: {
          assignedUsers: canViewUsers ? 1 : null,
          buildings: canViewBuildings ? 1 : null,
          gateways: canViewDevices ? 0 : null,
          nodes: canViewDevices ? 0 : null,
        },
        users: {
          available: canViewUsers,
          items: canViewUsers
            ? [
                {
                  accessSources: ["AREA"],
                  email: "worker@example.com",
                  id: "user-1",
                  isActive: true,
                  name: "Worker",
                  role: { id: "role-custom", name: "Safety Lead" },
                },
              ]
            : [],
          total: canViewUsers ? 1 : null,
        },
      });
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
    if (url.pathname === "/company/buildings") {
      const items = [
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
      ];
      return jsonResponse({ items, page: 1, pageSize: 100, total: items.length });
    }
    if (url.href === `${apiBaseUrl}/company/buildings/building-1/overview`) {
      const canViewUsers = session.user.permissions.includes("company-users.view");
      const canViewDevices = session.user.permissions.includes("company-devices.view");
      return jsonResponse({
        area: session.user.permissions.includes("areas.view")
          ? {
              address: null,
              companyId: "company-1",
              description: null,
              id: "area-1",
              name: "Site A",
              status: "ACTIVE",
            }
          : null,
        building: {
          address: null,
          areaId: "area-1",
          buildingType: null,
          companyId: "company-1",
          id: "building-1",
          number: null,
          status: "ACTIVE",
          title: "Building A",
        },
        devices: {
          available: canViewDevices,
          items: canViewDevices
            ? [
                {
                  id: "gateway-1",
                  installedLocation: "Entrance",
                  isOnline: true,
                  lastSeenAt: "2026-08-01T00:00:00.000Z",
                  nodeCount: 1,
                  serialNumber: "0300",
                  status: "ACTIVE",
                },
              ]
            : [],
          total: canViewDevices ? 1 : null,
        },
        metrics: {
          activeNodes: canViewDevices ? 1 : null,
          assignedUsers: canViewUsers ? 1 : null,
          faultNodes: canViewDevices ? 0 : null,
          gateways: canViewDevices ? 1 : null,
          nodes: canViewDevices ? 1 : null,
          offlineGateways: canViewDevices ? 0 : null,
          onlineGateways: canViewDevices ? 1 : null,
        },
        nodes: {
          available: canViewDevices,
          items: canViewDevices
            ? [
                {
                  gateway: { id: "gateway-1", serialNumber: "0300" },
                  id: "node-1",
                  installedLocation: "Door",
                  lastSeenAt: "2026-08-01T00:00:00.000Z",
                  latestStatus: "safe",
                  nodeType: { displayName: "Door Node", id: "door-type", key: "door_node" },
                  number: "100",
                  status: "ACTIVE",
                },
              ]
            : [],
          total: canViewDevices ? 1 : null,
        },
        users: {
          available: canViewUsers,
          items: canViewUsers
            ? [
                {
                  accessSources: ["AREA"],
                  email: "worker@example.com",
                  id: "user-1",
                  isActive: true,
                  name: "Worker",
                  role: { id: "role-custom", name: "Safety Lead" },
                },
              ]
            : [],
          total: canViewUsers ? 1 : null,
        },
      });
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
    if (url.pathname === "/company/devices") {
      return jsonResponse({
        gateways: { items: [], page: 1, pageSize: 100, total: 0 },
        nodes: { items: [], page: 1, pageSize: 100, total: 0 },
      });
    }
    if (url.href === `${apiBaseUrl}/company/buildings/building-1/images`) {
      if (init.method === "POST")
        return jsonResponse(
          {
            byteSize: 11,
            contentPath: "/company/building-images/image-2/content",
            contentType: "image/png",
            createdAt: "2026-07-19T01:00:00.000Z",
            height: null,
            id: "image-2",
            kind: "PLAN",
            orderIndex: 1,
            width: null,
          },
          201,
        );
      return jsonResponse([
        {
          byteSize: 11,
          contentPath: "/company/building-images/image-1/content",
          contentType: "image/png",
          createdAt: "2026-07-19T00:00:00.000Z",
          height: null,
          id: "image-1",
          kind: "PLAN",
          orderIndex: 0,
          width: null,
        },
      ]);
    }
    if (url.pathname === "/company/building-images/image-1/content") {
      return new Response(new Uint8Array([137, 80, 78, 71]), {
        headers: { "content-type": "image/png" },
      });
    }
    if (url.pathname.startsWith("/company/building-images/") && init.method === "DELETE") {
      return jsonResponse({});
    }
    if (url.pathname === "/company/positions") {
      const items = options.withPositionAssignment
        ? [
            {
              companyId: "company-1",
              dependencies: {
                activeAssignments: 1,
                activePolicies: 0,
                historicalAssignments: 0,
                historicalPolicies: 0,
              },
              deletion: {
                allowed: false,
                blocker: "Remove 1 active assignment(s) first.",
                code: "COMPANY_POSITION_HAS_ACTIVE_DEPENDENCIES",
                mode: "NOT_ALLOWED",
              },
              id: "position-1",
              isActive: true,
              key: "safety_owner",
              name: "Safety Owner",
            },
          ]
        : [];
      return jsonResponse({ items, page: 1, pageSize: 100, total: items.length });
    }
    if (url.pathname === "/company/users/user-1/effective-access") {
      return jsonResponse({
        assignedAreas: [],
        assignedBuildings: [],
        directAllowPermissions: [],
        directDenyPermissions: [],
        effectivePermissions: [],
        inheritedBuildings: [],
        positionAssignments: [],
        rolePermissions: [],
        user: {},
      });
    }
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
    const NativeUrl = URL;
    vi.stubGlobal(
      "URL",
      class extends NativeUrl {
        static override createObjectURL = vi.fn(() => "blob:building-image");
        static override revokeObjectURL = vi.fn();
      },
    );
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

    const menuButton = await screen.findByRole(
      "button",
      { name: "More actions: Safety Lead" },
      { timeout: 15_000 },
    );
    fireEvent.click(menuButton);
    await waitFor(() =>
      expect(document.getElementById(menuButton.getAttribute("aria-controls")!)).toBeTruthy(),
    );
    const menu = document.getElementById(menuButton.getAttribute("aria-controls")!);
    expect(menu).toBeTruthy();
    fireEvent.click(within(menu!).getByRole("menuitem", { name: "Edit role", hidden: true }));
    const dialog = await screen.findByRole("dialog", { name: "Edit role" });
    fireEvent.click(within(dialog).getByLabelText("reports.view"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input, init]) => {
          return (
            String(input) === `${apiBaseUrl}/company/roles/role-custom` &&
            init?.method === "PATCH" &&
            String(init.body).includes("perm-reports")
          );
        }),
      ).toBe(true),
    );
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

  it("previews private building images and posts real multipart uploads", async () => {
    storeCompanySession();
    const fetchMock = mockFetch();
    const rendered = renderApp("/company/buildings/building-1/plan");

    expect(await screen.findByAltText("Private building image")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Upload image" }));
    const dialog = await screen.findByRole("dialog", { name: "Upload building image" });
    const file = new File([new Uint8Array([137, 80, 78, 71])], "new-plan.png", {
      type: "image/png",
    });
    fireEvent.change(dialog.querySelector("input[type=file]")!, { target: { files: [file] } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Upload image" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input, init]) => {
          const body = init?.body;
          return (
            String(input) === `${apiBaseUrl}/company/buildings/building-1/images` &&
            init?.method === "POST" &&
            body instanceof FormData &&
            body.get("kind") === "PLAN" &&
            body.get("image") instanceof File
          );
        }),
      ).toBe(true),
    );
    rendered.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
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

  it("shows backend-derived gateway, node and inherited-user relationships vertically", async () => {
    storeCompanySession();
    mockFetch(companySession);
    renderApp("/company/buildings/building-1");

    expect(await screen.findByText("Building A")).toBeTruthy();
    expect(screen.getAllByText("0300").length).toBeGreaterThan(0);
    expect(screen.getByText("Door Node")).toBeTruthy();
    expect(screen.getByText("100")).toBeTruthy();
    expect(screen.getByText("Safety Lead")).toBeTruthy();
    expect(screen.getByText("Site access")).toBeTruthy();
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

  it("keeps user actions permission-aware and confirms deactivation", async () => {
    const session = {
      ...companySession,
      user: {
        ...companySession.user,
        permissions: ["welcome.view", "company-users.view", "company-users.update"],
      },
    };
    storeCompanySession(session);
    const fetchMock = mockFetch(session);
    renderApp("/company/users");

    expect(await screen.findByText("Worker")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "More actions: Worker" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Deactivate" }));

    const dialog = await screen.findByRole("dialog", { name: "Confirm deactivation" });
    expect(within(dialog).getByText("Worker")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Deactivate" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input, init]) => {
          return (
            String(input) === `${apiBaseUrl}/company/users/user-1/status` &&
            init?.method === "PATCH"
          );
        }),
      ).toBe(true),
    );
  });

  it("removes a saved position assignment and submits an empty replacement list", async () => {
    storeCompanySession();
    const fetchMock = mockFetch(companySession, { withPositionAssignment: true });
    renderApp("/company/users");

    fireEvent.click(await screen.findByText("Worker"));
    const userDialog = await screen.findByRole("dialog", { name: "Edit user" });
    fireEvent.click(within(userDialog).getByRole("button", { name: "Remove position assignment" }));
    const confirmDialog = await screen.findByRole("dialog", {
      name: "Remove saved position assignment?",
    });
    fireEvent.click(
      within(confirmDialog).getByRole("button", { name: "Remove position assignment" }),
    );
    expect(within(userDialog).getByText(/No active position assignments/)).toBeTruthy();
    fireEvent.click(within(userDialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input, init]) => {
          return (
            String(input) === `${apiBaseUrl}/company/users/user-1/positions` &&
            init?.method === "PATCH" &&
            String(init.body) === JSON.stringify({ assignments: [] })
          );
        }),
      ).toBe(true),
    );
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

  it("keeps system roles view-only and confirms custom role deletion", async () => {
    storeCompanySession();
    const fetchMock = mockFetch();
    renderApp("/company/roles");

    const systemMenuButton = await screen.findByRole("button", {
      name: "More actions: Platform Manager",
    });
    fireEvent.click(systemMenuButton);
    await waitFor(() =>
      expect(document.getElementById(systemMenuButton.getAttribute("aria-controls")!)).toBeTruthy(),
    );
    const systemMenu = document.getElementById(systemMenuButton.getAttribute("aria-controls")!);
    expect(systemMenu).toBeTruthy();
    expect(
      within(systemMenu!).getByRole("menuitem", { name: "View role", hidden: true }),
    ).toBeTruthy();
    expect(
      within(systemMenu!).queryByRole("menuitem", { name: "Delete role", hidden: true }),
    ).toBeNull();

    const customMenuButton = await screen.findByRole("button", {
      name: "More actions: Safety Lead",
    });
    fireEvent.click(customMenuButton);
    await waitFor(() =>
      expect(document.getElementById(customMenuButton.getAttribute("aria-controls")!)).toBeTruthy(),
    );
    const customMenu = document.getElementById(customMenuButton.getAttribute("aria-controls")!);
    expect(customMenu).toBeTruthy();
    fireEvent.click(
      within(customMenu!).getByRole("menuitem", { name: "Delete role", hidden: true }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Delete role Safety Lead?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete role" }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            String(input) === `${apiBaseUrl}/company/roles/role-custom` &&
            init?.method === "DELETE",
        ),
      ).toBe(true),
    );
  });
});
