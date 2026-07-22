import type {
  AuthSession,
  CompanyRecord,
  GssRoleRecord,
  SystemSettingsRecord,
} from "@gss-iot/contracts";
import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";

const storageKey = "gss-iot-v3-auth-session";
const role: GssRoleRecord = {
  _count: { users: 0 },
  id: "role-1",
  isSuperAdmin: false,
  isSystem: false,
  key: "viewer",
  name: "Viewer",
  permissions: [],
};
const company: CompanyRecord = {
  address: "Seoul",
  code: "ACME",
  email: "ops@acme.example",
  id: "company-1",
  name: "Acme Safety",
  phone: "+82-2-0000-0000",
  status: "ACTIVE",
};
const systemSettings: SystemSettingsRecord = {
  application: { apiVersion: "0.0.0", environment: "test", name: "GSS IoT V3" },
  commands: { ackTimeoutMs: 30000, expiresInSeconds: 300, maxPublishAttempts: 3 },
  controls: { productionDeploymentControls: "phase-14", readOnly: true },
  features: { reportCleanupEnabled: true },
  mqtt: { connected: false, enabled: false, ready: true, subscribedFilterCount: 0 },
  reports: {
    storage: { provider: "memory", ready: true },
    worker: { enabled: false, mode: "internal-polling", ready: true },
  },
  sensorHistory: { retentionDays: 180 },
};

function sessionFor(context: AuthSession["context"], permissions: string[]): AuthSession {
  return {
    accessToken: "settings-token",
    context,
    user: {
      company: context === "company-user" ? { id: company.id, name: company.name } : null,
      companyId: context === "company-user" ? company.id : undefined,
      email: "settings@example.com",
      id: "user-1",
      isActive: true,
      isSuperAdmin: context === "gss-admin" && permissions.length === 0,
      lastLoginAt: null,
      name: "Settings User",
      permissions,
      phone: null,
      role: { id: "role-1", isSuperAdmin: false, key: role.key, name: role.name },
    },
  };
}

function setupFetch(session: AuthSession) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === `/auth/${session.context === "gss-admin" ? "gss" : "company"}/me`) {
      return new Response(JSON.stringify(session));
    }
    if (url.pathname === "/admin/roles") return new Response(JSON.stringify([role]));
    if (url.pathname === "/admin/roles/permissions") {
      return new Response(
        JSON.stringify([
          {
            action: "view",
            id: "permission-1",
            key: "dashboard.view",
            module: "dashboard",
            scopeType: "GSS",
          },
        ]),
      );
    }
    if (url.pathname === "/admin/settings/system")
      return new Response(JSON.stringify(systemSettings));
    if (
      url.pathname === "/company/settings" &&
      (!options || !options.method || options.method === "GET")
    ) {
      return new Response(JSON.stringify(company));
    }
    if (url.pathname === "/company/settings" && options?.method === "PATCH") {
      return new Response(JSON.stringify({ ...company, phone: "+82-2-1111-1111" }));
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  window.sessionStorage.setItem(
    storageKey,
    JSON.stringify({ accessToken: session.accessToken, context: session.context }),
  );
  return fetchMock;
}

function renderRoute(path: string) {
  window.history.pushState({}, "", path);
  return render(
    <MantineProvider theme={gssTheme}>
      <App />
    </MantineProvider>,
  );
}

describe("Task 06 settings pages", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("renders GSS roles and hides management actions without manage permission", async () => {
    setupFetch(sessionFor("gss-admin", ["admin-roles.view"]));
    renderRoute("/admin/settings/roles");

    expect(await screen.findByRole("heading", { level: 1, name: "GSS roles" })).toBeTruthy();
    expect(screen.getByText("Viewer")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create GSS role" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit role" })).toBeNull();
  });

  it("renders read-only system status without unsafe MQTT details", async () => {
    setupFetch(sessionFor("gss-admin", ["settings.system.view"]));
    renderRoute("/admin/settings/system");

    expect(await screen.findByRole("heading", { level: 1, name: "System settings" })).toBeTruthy();
    expect(screen.getByText("Read-only operational status")).toBeTruthy();
    expect(screen.getByText("memory")).toBeTruthy();
    expect(screen.queryByText("brokerHost")).toBeNull();
    expect(screen.queryByText("clientId")).toBeNull();
  });

  it("keeps company contact fields view-only without manage and saves with manage", async () => {
    setupFetch(sessionFor("company-user", ["settings.company.view"]));
    renderRoute("/company/settings");

    expect(await screen.findByRole("heading", { level: 1, name: "Company settings" })).toBeTruthy();
    expect((screen.getByLabelText("Address") as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();

    cleanup();
    const fetchMock = setupFetch(
      sessionFor("company-user", ["settings.company.view", "settings.company.manage"]),
    );
    renderRoute("/company/settings");
    const phone = await screen.findByLabelText("Phone");
    fireEvent.change(phone, { target: { value: "+82-2-1111-1111" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("Company settings saved.")).toBeTruthy());
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === "PATCH")).toBe(true);
  });
});
