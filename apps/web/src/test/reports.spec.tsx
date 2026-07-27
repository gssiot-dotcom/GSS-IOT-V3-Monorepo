import type { AuthContext, AuthSession, ReportJobRecord } from "@gss-iot/contracts";
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { gssTheme } from "@gss-iot/ui";
import { cleanReportFilters, dateRangeError } from "../features/reports/ReportsPage";

const storageKey = "gss-iot-v3-auth-session";
const apiBaseUrl = "http://localhost:3000";

const job = (overrides: Partial<ReportJobRecord> = {}): ReportJobRecord => ({
  id: "job-1",
  requestedByType: "COMPANY_USER",
  requestedById: "user-1",
  companyId: "company-1",
  areaId: null,
  buildingId: null,
  reportType: "SITE_SUMMARY",
  filters: {},
  status: "PENDING",
  progress: 20,
  errorMessage: null,
  completedAt: null,
  createdAt: "2026-07-21T00:00:00.000Z",
  updatedAt: "2026-07-21T00:00:00.000Z",
  exports: [],
  ...overrides,
});

const companySession: AuthSession = {
  accessToken: "company-token",
  context: "company-user",
  user: {
    companyId: "company-1",
    email: "company@example.com",
    id: "user-1",
    isActive: true,
    isSuperAdmin: false,
    name: "Company user",
    permissions: ["dashboard.view", "welcome.view", "reports.view", "areas.view", "buildings.view"],
  },
};

const adminSession = (permissions: string[]): AuthSession => ({
  accessToken: "admin-token",
  context: "gss-admin",
  user: {
    email: "admin@example.com",
    id: "admin-1",
    isActive: true,
    isSuperAdmin: false,
    name: "Admin",
    permissions,
  },
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

function renderApp(
  path: string,
  context: AuthContext,
  session: AuthSession,
  handler: (url: URL, init: RequestInit) => Response | undefined,
) {
  window.history.pushState({}, "", path);
  window.sessionStorage.setItem(
    storageKey,
    JSON.stringify({ accessToken: session.accessToken, context }),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input));
      if (url.href === `${apiBaseUrl}/auth/${context === "gss-admin" ? "gss" : "company"}/me`) {
        return jsonResponse(session);
      }
      if (url.pathname === "/company/devices") {
        return jsonResponse({
          gateways: { items: [], page: 1, pageSize: 100, total: 0 },
          nodes: { items: [], page: 1, pageSize: 100, total: 0 },
        });
      }
      if (
        [
          "/admin/companies",
          "/admin/devices/gateways",
          "/admin/devices/nodes",
          "/company/areas",
          "/company/buildings",
        ].includes(url.pathname)
      ) {
        return jsonResponse({ items: [], page: 1, pageSize: 100, total: 0 });
      }
      return handler(url, init) ?? jsonResponse({});
    }),
  );
  return render(
    <MantineProvider theme={gssTheme}>
      <App />
    </MantineProvider>,
  );
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  window.history.pushState({}, "", "/");
});

describe("reports frontend permissions and scope", () => {
  it("requires report view permission and makes no report API request", async () => {
    const calls: string[] = [];
    renderApp("/admin/reports", "gss-admin", adminSession(["dashboard.view"]), (url) => {
      calls.push(url.pathname);
      return jsonResponse({});
    });

    expect(await screen.findByText("You do not have access to this page.")).toBeTruthy();
    expect(calls).not.toContain("/admin/reports");
  });

  it("lists jobs for a view-only user but does not submit an export", async () => {
    const calls: Array<{ path: string; method: string; body?: string }> = [];
    renderApp("/company/reports", "company-user", companySession, (url, init) => {
      calls.push({
        path: url.pathname,
        method: init.method ?? "GET",
        body: String(init.body ?? ""),
      });
      if (url.pathname === "/company/reports")
        return jsonResponse({ items: [job()], page: 1, pageSize: 25, total: 1 });
      return jsonResponse([]);
    });

    expect(await screen.findByText("Report jobs")).toBeTruthy();
    const requestButton = screen.getByRole("button", { name: "Export permission required" });
    expect(requestButton).toHaveProperty("disabled", true);
    expect(calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("keeps GSS Admin export submission unavailable to a view-only user", async () => {
    const calls: Array<{ path: string; method: string }> = [];
    renderApp(
      "/admin/reports",
      "gss-admin",
      adminSession(["reports.view", "reports.company"]),
      (url, init) => {
        calls.push({ path: url.pathname, method: init.method ?? "GET" });
        if (url.pathname === "/admin/reports") {
          return jsonResponse({
            items: [job({ requestedByType: "GSS_ADMIN" })],
            page: 1,
            pageSize: 25,
            total: 1,
          });
        }
        return jsonResponse([]);
      },
    );

    expect(await screen.findByText("Report jobs")).toBeTruthy();
    const requestButton = screen.getByRole("button", { name: "Export permission required" });
    expect(requestButton).toHaveProperty("disabled", true);
    expect(calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("keeps companyId out of company export filters and resets building after site change", () => {
    expect(
      cleanReportFilters(
        {
          areaId: "area-2",
          buildingId: "building-2",
          companyId: "attacker-company",
          from: "",
          gatewayId: null,
          nodeId: null,
          nodeTypeId: null,
          to: "",
        },
        false,
      ),
    ).toEqual({ areaId: "area-2", buildingId: "building-2" });
  });

  it("validates the stricter sensor history range", () => {
    const base = {
      areaId: null,
      buildingId: null,
      companyId: null,
      from: "2026-01-01",
      gatewayId: null,
      nodeId: null,
      nodeTypeId: null,
      to: "2026-02-02",
    };
    expect(dateRangeError("SENSOR_HISTORY", base)).toContain("31 days");
    expect(dateRangeError("SENSOR_HISTORY", { ...base, to: "2025-12-01" })).toContain(
      "on or before",
    );
  });

  it("allows an export user to submit the selected CSV or XLSX format", async () => {
    const session = {
      ...companySession,
      user: {
        ...companySession.user,
        permissions: [...companySession.user.permissions, "reports.export"],
      },
    };
    const bodies: Array<Record<string, unknown>> = [];
    renderApp("/company/reports", "company-user", session, (url, init) => {
      if (url.pathname === "/company/reports/export" && init.method === "POST") {
        bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return jsonResponse(job({ status: "PENDING" }), 201);
      }
      if (url.pathname === "/company/reports")
        return jsonResponse({ items: [], page: 1, pageSize: 25, total: 0 });
      return jsonResponse([]);
    });

    const requestButton = await screen.findByRole("button", { name: "Request export" });
    fireEvent.click(requestButton);
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ format: "CSV", reportType: "SITE_SUMMARY" });

    const formatInput = screen.getByRole("combobox", { name: "Format" });
    fireEvent.change(formatInput, { target: { value: "XLSX" } });
    fireEvent.click(requestButton);
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toMatchObject({ format: "XLSX", reportType: "SITE_SUMMARY" });
  });
});

describe("reports job lifecycle and endpoints", () => {
  it("polls active jobs and stops after the job becomes terminal", async () => {
    vi.useFakeTimers();
    let requests = 0;
    renderApp("/company/reports", "company-user", companySession, (url) => {
      if (url.pathname === "/company/reports") {
        requests += 1;
        return jsonResponse({
          items: [
            job({
              status: requests > 1 ? "COMPLETED" : "PROCESSING",
              progress: requests > 1 ? 100 : 40,
            }),
          ],
          page: 1,
          pageSize: 25,
          total: 1,
        });
      }
      return jsonResponse([]);
    });

    await vi.waitFor(() => expect(requests).toBe(1));
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() => expect(requests).toBe(2));
    await vi.waitFor(() => expect(screen.getAllByText("Completed").length).toBeGreaterThan(0));
    await vi.advanceTimersByTimeAsync(4_000);
    expect(requests).toBe(2);
    vi.useRealTimers();
  });

  it("uses separate company and GSS report endpoints", async () => {
    const companyCalls: string[] = [];
    renderApp("/company/reports", "company-user", companySession, (url) => {
      companyCalls.push(url.pathname);
      return jsonResponse({ items: [], page: 1, pageSize: 25, total: 0 });
    });
    await screen.findByText("No report jobs");
    expect(companyCalls).toContain("/company/reports");
    cleanup();

    const admin = adminSession(["reports.view", "reports.company"]);
    const adminCalls: string[] = [];
    renderApp("/admin/reports", "gss-admin", admin, (url) => {
      adminCalls.push(url.pathname);
      return jsonResponse({ items: [], page: 1, pageSize: 25, total: 0 });
    });
    await screen.findByText("No report jobs");
    expect(adminCalls).toContain("/admin/reports");
  });

  it("downloads an authorized unexpired file and hides expired files", async () => {
    const session = {
      ...companySession,
      user: {
        ...companySession.user,
        permissions: [...companySession.user.permissions, "reports.export"],
      },
    };
    const downloads: string[] = [];
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:report"),
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    renderApp("/company/reports", "company-user", session, (url) => {
      if (url.pathname === "/company/reports") {
        return jsonResponse({
          items: [
            job({
              status: "COMPLETED",
              progress: 100,
              exports: [
                {
                  id: "export-1",
                  reportJobId: "job-1",
                  fileName: "site-report.csv",
                  format: "CSV",
                  contentType: "text/csv",
                  sizeBytes: 10,
                  expiresAt: "2099-01-01T00:00:00.000Z",
                  createdByType: "COMPANY_USER",
                  createdById: "user-1",
                  downloadedAt: null,
                  createdAt: "2026-07-21T00:00:00.000Z",
                },
              ],
            }),
          ],
          page: 1,
          pageSize: 25,
          total: 1,
        });
      }
      return jsonResponse([]);
    });
    const originalFetch = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith("/download")) {
          downloads.push(url.pathname);
          return new Response(new Blob(["id,name\n1,Site"]), {
            headers: {
              "content-disposition": 'attachment; filename="site-report.csv"',
              "content-type": "text/csv",
            },
            status: 200,
          });
        }
        return (originalFetch as typeof fetch)(input, init);
      }),
    );
    fireEvent.click(
      (await screen.findAllByRole("button", { name: "Download site-report.csv" }))[0]!,
    );
    await waitFor(() => expect(downloads).toEqual(["/company/reports/exports/export-1/download"]));
  });

  it("shows a redacted failure summary and expired status without a download action", async () => {
    const session = {
      ...companySession,
      user: {
        ...companySession.user,
        permissions: [...companySession.user.permissions, "reports.export"],
      },
    };
    renderApp("/company/reports", "company-user", session, (url) => {
      if (url.pathname === "/company/reports") {
        return jsonResponse({
          items: [
            job({ status: "FAILED", errorMessage: "Export failed at C:\\secrets\\storage-key" }),
            job({
              id: "job-2",
              status: "COMPLETED",
              progress: 100,
              exports: [
                {
                  id: "export-2",
                  reportJobId: "job-2",
                  fileName: "expired.csv",
                  format: "CSV",
                  contentType: "text/csv",
                  sizeBytes: 10,
                  expiresAt: "2020-01-01T00:00:00.000Z",
                  createdByType: "COMPANY_USER",
                  createdById: "user-1",
                  downloadedAt: null,
                  createdAt: "2020-01-01T00:00:00.000Z",
                },
              ],
            }),
          ],
          page: 1,
          pageSize: 25,
          total: 2,
        });
      }
      return jsonResponse([]);
    });
    expect((await screen.findAllByText("Expired")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Download expired.csv" })).toBeNull();
    expect(screen.getAllByText("Export failed at").length).toBeGreaterThan(0);
    expect(screen.queryByText(/secrets/)).toBeNull();
  });
});
