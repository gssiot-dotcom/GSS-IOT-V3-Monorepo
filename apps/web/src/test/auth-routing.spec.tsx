import type { AuthContext, AuthSession } from "@gss-iot/contracts";
import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { cleanup, fireEvent, render, screen, waitFor, within } from "./render";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";

const storageKey = "gss-iot-v3-auth-context";
const apiBaseUrl = "http://localhost:3000";

const adminSession: AuthSession = {
  context: "gss-admin",
  user: {
    email: "admin@example.com",
    id: "admin-1",
    isActive: true,
    isSuperAdmin: false,
    name: "Admin",
    permissions: [
      "companies.view",
      "companies.create",
      "companies.update",
      "companies.delete",
      "areas.view",
      "areas.create",
      "buildings.view",
      "buildings.create",
      "company-users.view",
      "company-users.create",
      "company-roles.view",
      "devices.view",
      "gateways.view",
      "nodes.view",
      "dashboard.view",
      "welcome.view",
    ],
  },
};

const companySession: AuthSession = {
  context: "company-user",
  user: {
    companyId: "company-1",
    email: "company@example.com",
    id: "company-user-1",
    isActive: true,
    isSuperAdmin: false,
    name: "Company User",
    permissions: ["dashboard.view", "welcome.view"],
  },
};

const company = {
  address: null,
  code: "ACME",
  email: "ops@example.com",
  hasLogo: false,
  id: "company-1",
  name: "Acme Safety",
  phone: null,
  status: "ACTIVE",
};

function renderApp(path: string) {
  window.history.pushState({}, "", path);
  return render(
    <MantineProvider theme={gssTheme}>
      <App />
    </MantineProvider>,
    { router: false },
  );
}

function storeSession(context: AuthContext) {
  window.sessionStorage.setItem(storageKey, JSON.stringify({ context }));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

function mockFetch(handler?: (url: URL, init: RequestInit) => Response | undefined) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const custom = handler?.(url, init);
    if (custom) return custom;

    if (url.href === `${apiBaseUrl}/auth/gss/login`) return jsonResponse(adminSession, 201);
    if (url.href === `${apiBaseUrl}/auth/gss/me`) return jsonResponse(adminSession);
    if (url.href === `${apiBaseUrl}/auth/company/me`) return jsonResponse(companySession);
    if (url.pathname === "/admin/companies")
      return jsonResponse({ items: [company], page: 1, pageSize: 50, total: 1 });
    if (url.href === `${apiBaseUrl}/admin/companies/company-1`) return jsonResponse(company);
    if (url.pathname === "/admin/companies/company-1/areas") {
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
    if (url.pathname === "/admin/companies/company-1/buildings") {
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
    if (url.pathname === "/admin/companies/company-1/users") {
      const items = [
        {
          companyId: "company-1",
          email: "manager@example.com",
          id: "user-1",
          isActive: true,
          name: "Manager",
          phone: null,
          role: {
            id: "role-1",
            isCompanyOwnerRole: true,
            key: "platform_manager",
            name: "Platform Manager",
          },
          roleId: "role-1",
        },
      ];
      return jsonResponse({ items, page: 1, pageSize: 100, total: items.length });
    }
    if (url.pathname === "/admin/companies/company-1/roles") {
      const items = [
        {
          companyId: "company-1",
          id: "role-1",
          isCompanyOwnerRole: true,
          key: "platform_manager",
          name: "Platform Manager",
          permissions: [],
        },
        {
          companyId: "company-1",
          id: "role-2",
          isCompanyOwnerRole: false,
          key: "site_manager",
          name: "Site Manager",
          permissions: [],
        },
      ];
      return jsonResponse({ items, page: 1, pageSize: 100, total: items.length });
    }
    if (url.pathname === "/admin/devices/gateways") {
      const items = [
        {
          buildingAssignments: [],
          companyAssignments: [
            { assignedAt: "2026-07-16T00:00:00.000Z", companyId: "company-1", id: "assign-1" },
          ],
          gatewayType: "NODES_GATEWAY",
          id: "gateway-1",
          installedLocation: null,
          lastSeenAt: null,
          serialNumber: "GW-001",
          status: "ACTIVE",
        },
      ];
      return jsonResponse({ items, page: 1, pageSize: 100, total: items.length });
    }
    if (url.pathname === "/admin/devices/nodes")
      return jsonResponse({ items: [], page: 1, pageSize: 100, total: 0 });

    return emptyResponse(404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("auth routing", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("opens a company detail route after GSS login without redirecting to login", async () => {
    mockFetch();
    renderApp("/login");

    fireEvent.change(screen.getByRole("textbox", { name: /Email/ }), {
      target: { value: "admin@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "test-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    fireEvent.click(await screen.findByRole("link", { name: "Companies" }));
    fireEvent.click(await screen.findByRole("button", { name: "Open company: Acme Safety" }));

    expect(
      await screen.findByText("Company setup, resources, users, and assigned devices."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
    expect(screen.getByRole("button", { name: "Toggle navigation" })).toBeTruthy();
    expect(screen.getAllByText("Overview").length).toBeGreaterThan(0);
  });

  it("restores an authenticated deep link from session storage", async () => {
    storeSession("gss-admin");
    mockFetch();
    renderApp("/admin/companies/company-1");

    expect(await screen.findByText("Acme Safety")).toBeTruthy();
    expect(screen.getByText("Platform managers")).toBeTruthy();
  });

  it("keeps company fields savable when a separate admin logo upload fails", async () => {
    storeSession("gss-admin");
    const fetchMock = mockFetch((url, init) => {
      if (url.href === `${apiBaseUrl}/admin/companies/company-1/logo` && init.method === "PUT") {
        return jsonResponse({ message: "storage unavailable" }, 500);
      }
      if (url.href === `${apiBaseUrl}/admin/companies/company-1` && init.method === "PATCH") {
        return jsonResponse(company);
      }
      return undefined;
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:selected-admin-logo");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    renderApp("/admin/companies/company-1");

    fireEvent.click(await screen.findByRole("button", { name: "Edit company" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit company" });
    expect(within(dialog).getByText("Company logo")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Choose logo" }));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(input!, {
      target: {
        files: [
          new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "logo.png", {
            type: "image/png",
          }),
        ],
      },
    });
    fireEvent.click(await within(dialog).findByRole("button", { name: "Upload logo" }));
    expect(await within(dialog).findByText("Unable to update the company logo.")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await screen.findByText("Platform managers");
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          String(input) === `${apiBaseUrl}/admin/companies/company-1` && init?.method === "PATCH",
      ),
    ).toBe(true);
  });

  it("edits every company card field and submits the current form values", async () => {
    storeSession("gss-admin");
    const fetchMock = mockFetch((url, init) => {
      if (url.href === `${apiBaseUrl}/admin/companies/company-1` && init.method === "PATCH") {
        return jsonResponse({
          ...company,
          address: "Seoul",
          code: "GSS-01",
          email: "new@example.com",
          name: "Global Safety",
          phone: "+82-2-1234-5678",
        });
      }
      return undefined;
    });
    renderApp("/admin/companies");

    fireEvent.click(await screen.findByRole("button", { name: "More actions: Acme Safety" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit company" });

    fireEvent.change(within(dialog).getByRole("textbox", { name: "Name" }), {
      target: { value: "Global Safety" },
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Code" }), {
      target: { value: "GSS-01" },
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Platform manager email" }), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Phone" }), {
      target: { value: "+82-2-1234-5678" },
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Address" }), {
      target: { value: "Seoul" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([input, init]) =>
          String(input) === `${apiBaseUrl}/admin/companies/company-1` && init?.method === "PATCH",
      );
      expect(patchCall).toBeTruthy();
      expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
        address: "Seoul",
        code: "GSS-01",
        email: "new@example.com",
        name: "Global Safety",
        phone: "+82-2-1234-5678",
      });
    });

    expect(
      fetchMock.mock.calls.filter(
        ([input, init]) =>
          String(input) === `${apiBaseUrl}/admin/companies/company-1` && init?.method === "PATCH",
      ),
    ).toHaveLength(1);
  }, 30_000);

  it("closes company card editing without submitting when Cancel is selected", async () => {
    storeSession("gss-admin");
    const fetchMock = mockFetch();
    renderApp("/admin/companies");

    fireEvent.click(await screen.findByRole("button", { name: "More actions: Acme Safety" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit company" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit company" })).toBeNull());
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
  });

  it("keeps the Admin company workspace mounted while child sections change", async () => {
    storeSession("gss-admin");
    const fetchMock = mockFetch();
    renderApp("/admin/companies/company-1");

    const layout = await screen.findByTestId("admin-company-workspace-layout");
    const instance = layout.getAttribute("data-workspace-instance");
    fireEvent.click(await screen.findByRole("tab", { name: "Construction sites" }));

    expect(await screen.findByText("Site A")).toBeTruthy();
    expect(
      screen.getByTestId("admin-company-workspace-layout").getAttribute("data-workspace-instance"),
    ).toBe(instance);
    expect(
      fetchMock.mock.calls.filter(
        ([input]) => String(input) === `${apiBaseUrl}/admin/companies/company-1`,
      ),
    ).toHaveLength(1);
  });

  it("renders company-owned roles in the GSS Admin company-user create form", async () => {
    storeSession("gss-admin");
    const fetchMock = mockFetch();
    renderApp("/admin/companies/company-1/users");

    fireEvent.click(await screen.findByRole("button", { name: "Create user" }));
    const dialog = await screen.findByRole("dialog", { name: "Create user" });
    expect(await within(dialog).findByText("Role")).toBeTruthy();
    const inputs = within(dialog).getAllByRole("textbox");
    const lastInput = inputs.at(-1);
    if (!lastInput) throw new Error("Create user dialog inputs are missing");
    fireEvent.click(lastInput);

    expect(await screen.findByText("Site Manager")).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(([input]) => {
        return new URL(String(input)).pathname === "/admin/companies/company-1/roles";
      }),
    ).toBe(true);
  });

  it("clears an expired stored session and redirects to login", async () => {
    storeSession("gss-admin");
    mockFetch((url) => (url.href === `${apiBaseUrl}/auth/gss/me` ? emptyResponse(401) : undefined));
    renderApp("/admin/companies/company-1");

    expect(await screen.findByRole("button", { name: "Sign in" })).toBeTruthy();
  });

  it("shows not found for an unknown authenticated admin route", async () => {
    storeSession("gss-admin");
    mockFetch();
    renderApp("/admin/not-a-real-route");

    expect(await screen.findByText("Page not found")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  });

  it("shows forbidden when the route permission is missing", async () => {
    storeSession("gss-admin");
    mockFetch((url) =>
      url.href === `${apiBaseUrl}/auth/gss/me`
        ? jsonResponse({ ...adminSession, user: { ...adminSession.user, permissions: [] } })
        : undefined,
    );
    renderApp("/admin/companies");

    expect(await screen.findByText("You do not have access to this page.")).toBeTruthy();
  });

  it("does not render or request the Admin permission catalog without permissions.view", async () => {
    storeSession("gss-admin");
    const fetchMock = mockFetch((url) =>
      url.href === `${apiBaseUrl}/auth/gss/me`
        ? jsonResponse({ ...adminSession, user: { ...adminSession.user, permissions: [] } })
        : undefined,
    );
    renderApp("/admin/settings/permissions");

    expect(await screen.findByText("You do not have access to this page.")).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(([input]) => String(input) === `${apiBaseUrl}/admin/permissions`),
    ).toBe(false);
  });

  it("returns to login when the cookie session does not match the requested portal", async () => {
    storeSession("company-user");
    mockFetch((url) => (url.href === `${apiBaseUrl}/auth/gss/me` ? emptyResponse(403) : undefined));
    const firstRender = renderApp("/admin/dashboard");

    expect(await screen.findByRole("button", { name: "Sign in" })).toBeTruthy();

    firstRender.unmount();
    window.sessionStorage.clear();
    storeSession("gss-admin");
    mockFetch((url) =>
      url.href === `${apiBaseUrl}/auth/company/me` ? emptyResponse(403) : undefined,
    );
    renderApp("/company/dashboard");

    expect(await screen.findByRole("button", { name: "Sign in" })).toBeTruthy();
  });
});
