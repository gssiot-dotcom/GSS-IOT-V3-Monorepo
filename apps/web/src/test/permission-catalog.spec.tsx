import type { AuthSession, CompanyPermissionRecord } from "@gss-iot/contracts";
import { gssTheme } from "@gss-iot/ui";
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PermissionCatalogPage } from "../features/permissions/PermissionCatalogPage";

const permissions: CompanyPermissionRecord[] = [
  {
    action: "view",
    description: "View monitoring data within the authorized company scope.",
    id: "permission-monitoring",
    key: "monitoring.view",
    module: "monitoring",
    scopeType: "BOTH",
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

let testSession: AuthSession;

vi.mock("../shared/auth/auth-context", () => ({
  useAuth: () => ({ session: testSession }),
}));

function session(context: AuthSession["context"]): AuthSession {
  return {
    context,
    user: {
      email: "catalog@example.com",
      id: "catalog-user",
      isActive: true,
      isSuperAdmin: false,
      name: "Catalog User",
      permissions: [context === "gss-admin" ? "permissions.view" : "company-permissions.view"],
    },
  };
}

function renderPage(context: AuthSession["context"]) {
  return render(
    <MantineProvider theme={gssTheme}>
      <PermissionCatalogPage context={context} />
    </MantineProvider>,
  );
}

describe("read-only permission catalog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("loads the Admin catalog, filters key/module/description, and exposes no mutations", async () => {
    testSession = session("gss-admin");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const search = new URL(String(input)).searchParams.get("search");
      const items = search
        ? permissions.filter((item) => item.description?.includes("monitoring"))
        : permissions;
      return new Response(JSON.stringify({ items, page: 1, pageSize: 50, total: items.length }));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage("gss-admin");

    expect((await screen.findAllByText("monitoring.view")).length).toBeGreaterThan(0);
    expect(
      fetchMock.mock.calls.some(
        ([input]) => new URL(String(input)).pathname === "/admin/permissions",
      ),
    ).toBe(true);
    expect(screen.getAllByText("company-roles.manage").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByRole("textbox", { name: "Search permission catalog" }), {
      target: { value: "monitoring data" },
    });
    await waitFor(() => expect(screen.getAllByText("monitoring.view").length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.queryAllByText("company-roles.manage")).toHaveLength(0));
    expect(screen.queryByRole("button", { name: /save|create|edit|delete/i })).toBeNull();
  });

  it("uses the Company endpoint and renders the company-scoped catalog", async () => {
    testSession = session("company-user");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return new Response(
        JSON.stringify({ items: permissions.slice(1), page: 1, pageSize: 50, total: 1 }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage("company-user");

    expect((await screen.findAllByText("company-roles.manage")).length).toBeGreaterThan(0);
    expect(
      fetchMock.mock.calls.some(
        ([input]) => new URL(String(input)).pathname === "/company/permissions",
      ),
    ).toBe(true);
    expect(screen.queryAllByText("monitoring.view")).toHaveLength(0);
  });

  it("renders shared forbidden and inactive-session states for API denial", async () => {
    testSession = session("gss-admin");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: "Forbidden" }), {
            status: 403,
            statusText: "Forbidden",
          }),
      ),
    );
    const view = renderPage("gss-admin");
    expect(await screen.findByText("You do not have access to this page.")).toBeTruthy();

    view.unmount();
    testSession = session("company-user");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (new URL(String(input)).pathname === "/auth/refresh") {
          return new Response(JSON.stringify(testSession));
        }
        return new Response(JSON.stringify({ message: "Inactive" }), {
          status: 401,
          statusText: "Unauthorized",
        });
      }),
    );
    renderPage("company-user");
    await waitFor(() => expect(screen.getByText("Your session expired")).toBeTruthy());
  }, 30_000);
});
