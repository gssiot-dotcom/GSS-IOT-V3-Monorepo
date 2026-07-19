import type { AuthContext, AuthSession } from "@gss-iot/contracts";
import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";

const storageKey = "gss-iot-v3-auth-session";
const apiBaseUrl = "http://localhost:3000";

const adminSession: AuthSession = {
  accessToken: "admin-token",
  context: "gss-admin",
  user: {
    email: "admin@example.com",
    id: "admin-1",
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
  accessToken: "company-token",
  context: "company-user",
  user: {
    companyId: "company-1",
    email: "company@example.com",
    id: "company-user-1",
    isSuperAdmin: false,
    name: "Company User",
    permissions: ["dashboard.view", "welcome.view"],
  },
};

const company = {
  address: null,
  code: "ACME",
  email: "ops@example.com",
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
  );
}

function storeSession(context: AuthContext, accessToken: string) {
  window.sessionStorage.setItem(storageKey, JSON.stringify({ accessToken, context }));
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
    if (url.href === `${apiBaseUrl}/admin/companies`) return jsonResponse([company]);
    if (url.href === `${apiBaseUrl}/admin/companies/company-1`) return jsonResponse(company);
    if (url.href === `${apiBaseUrl}/admin/companies/company-1/areas`) {
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
    if (url.href === `${apiBaseUrl}/admin/companies/company-1/buildings`) {
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
    if (url.href === `${apiBaseUrl}/admin/companies/company-1/users`) {
      return jsonResponse([
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
      ]);
    }
    if (url.href === `${apiBaseUrl}/admin/companies/company-1/roles`) {
      return jsonResponse([
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
      ]);
    }
    if (url.href === `${apiBaseUrl}/admin/devices/gateways`) {
      return jsonResponse([
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
      ]);
    }
    if (url.href === `${apiBaseUrl}/admin/devices/nodes`) return jsonResponse([]);

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
    fireEvent.click(await screen.findByRole("button", { name: "Open" }));

    expect(
      await screen.findByText("Company setup, resources, users, and assigned devices."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  });

  it("restores an authenticated deep link from session storage", async () => {
    storeSession("gss-admin", "admin-token");
    mockFetch();
    renderApp("/admin/companies/company-1");

    expect(await screen.findByText("Acme Safety")).toBeTruthy();
    expect(screen.getByText("Platform managers")).toBeTruthy();
  });

  it("renders company-owned roles in the GSS Admin company-user create form", async () => {
    storeSession("gss-admin", "admin-token");
    const fetchMock = mockFetch();
    renderApp("/admin/companies/company-1/users");

    fireEvent.click(await screen.findByRole("button", { name: "Create user" }));
    const dialog = await screen.findByRole("dialog", { name: "Create user" });
    expect(await within(dialog).findByText("Role")).toBeTruthy();
    const inputs = within(dialog).getAllByRole("textbox");
    fireEvent.click(inputs[inputs.length - 1]);

    expect(await screen.findByText("Site Manager")).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(([input]) => {
        return String(input) === `${apiBaseUrl}/admin/companies/company-1/roles`;
      }),
    ).toBe(true);
  });

  it("clears an expired stored session and redirects to login", async () => {
    storeSession("gss-admin", "expired-token");
    mockFetch((url) => (url.href === `${apiBaseUrl}/auth/gss/me` ? emptyResponse(401) : undefined));
    renderApp("/admin/companies/company-1");

    expect(await screen.findByRole("button", { name: "Sign in" })).toBeTruthy();
  });

  it("shows not found for an unknown authenticated admin route", async () => {
    storeSession("gss-admin", "admin-token");
    mockFetch();
    renderApp("/admin/not-a-real-route");

    expect(await screen.findByText("Page not found")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  });

  it("shows forbidden when the route permission is missing", async () => {
    storeSession("gss-admin", "limited-token");
    mockFetch((url) =>
      url.href === `${apiBaseUrl}/auth/gss/me`
        ? jsonResponse({ ...adminSession, user: { ...adminSession.user, permissions: [] } })
        : undefined,
    );
    renderApp("/admin/companies");

    expect(await screen.findByText("You do not have access to this page.")).toBeTruthy();
  });

  it("does not allow auth sessions across portal contexts", async () => {
    storeSession("company-user", "company-token");
    mockFetch();
    const firstRender = renderApp("/admin/dashboard");

    expect(await screen.findByText("You do not have access to this page.")).toBeTruthy();

    firstRender.unmount();
    window.sessionStorage.clear();
    storeSession("gss-admin", "admin-token");
    mockFetch();
    renderApp("/company/dashboard");

    expect(await screen.findByText("You do not have access to this page.")).toBeTruthy();
  });
});
