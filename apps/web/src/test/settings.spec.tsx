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

const storageKey = "gss-iot-v3-auth-context";
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
  hasLogo: false,
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
    if (url.pathname === "/admin/roles")
      return new Response(JSON.stringify({ items: [role], page: 1, pageSize: 50, total: 1 }));
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
  window.sessionStorage.setItem(storageKey, JSON.stringify({ context: session.context }));
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
    const viewOnlyFetch = setupFetch(sessionFor("company-user", ["settings.company.view"]));
    renderRoute("/company/settings");

    expect(await screen.findByRole("heading", { level: 1, name: "Company settings" })).toBeTruthy();
    expect((screen.getByLabelText("Address") as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(
      viewOnlyFetch.mock.calls.some(
        ([input]) => new URL(String(input)).pathname === "/company/branding/logo",
      ),
    ).toBe(true);

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

  it("uploads a private logo without a JSON content type and refreshes shared branding", async () => {
    const session = sessionFor("company-user", [
      "settings.company.view",
      "settings.company.manage",
    ]);
    let objectUrlIndex = 0;
    const createObjectUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockImplementation(() => `blob:company-logo-${++objectUrlIndex}`);
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path === "/auth/company/me") return new Response(JSON.stringify(session));
      if (path === "/company/settings") return new Response(JSON.stringify(company));
      if (path === "/company/branding/logo") {
        return new Response(new Blob(["private-logo"], { type: "image/png" }), {
          headers: { "content-type": "image/png" },
        });
      }
      if (path === "/company/settings/logo" && options?.method === "PUT") {
        return new Response(JSON.stringify({ hasLogo: true }));
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    window.sessionStorage.setItem(storageKey, JSON.stringify({ context: session.context }));

    renderRoute("/company/settings");
    expect(await screen.findByRole("heading", { level: 1, name: "Company settings" })).toBeTruthy();
    expect(await screen.findAllByAltText("Acme Safety logo")).toHaveLength(2);
    expect(screen.getAllByAltText("Global Smart Solutions")).toHaveLength(1);
    const logoPlate = document.querySelector(".gss-company-sidebar-logo-plate");
    expect(logoPlate).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Replace logo" }));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).toBeTruthy();
    const file = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      "logo.png",
      { type: "image/png" },
    );
    fireEvent.change(input!, { target: { files: [file] } });
    fireEvent.click(await screen.findByRole("button", { name: "Upload logo" }));

    await waitFor(() => expect(screen.getByText("Company logo saved.")).toBeTruthy());
    const uploadCall = fetchMock.mock.calls.find(
      ([input, options]) =>
        new URL(String(input)).pathname === "/company/settings/logo" && options?.method === "PUT",
    );
    expect(uploadCall?.[1]?.body).toBeInstanceOf(FormData);
    expect(new Headers(uploadCall?.[1]?.headers).has("content-type")).toBe(false);
    expect(createObjectUrl).toHaveBeenCalledTimes(3);
    expect(revokeObjectUrl).toHaveBeenCalled();
  });
});
