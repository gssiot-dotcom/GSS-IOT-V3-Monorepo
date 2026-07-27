import type { AuthSession, DashboardSummary } from "@gss-iot/contracts";
import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";

const storageKey = "gss-iot-v3-auth-session";
const apiBaseUrl = "http://localhost:3000";
const session: AuthSession = {
  accessToken: "dashboard-token",
  context: "company-user",
  user: {
    company: { id: "company-1", name: "Acme Safety" },
    companyId: "company-1",
    email: "dashboard@example.com",
    id: "user-1",
    isActive: true,
    isSuperAdmin: false,
    lastLoginAt: null,
    name: "Dashboard User",
    permissions: ["dashboard.view", "monitoring.view", "alarms.view"],
    phone: null,
    role: { id: "role-1", isSuperAdmin: false, key: "manager", name: "Manager" },
  },
};

const fullSummary: DashboardSummary = {
  gateways: { offline: 1, online: 3, unassigned: 0 },
  kpis: {
    activeBuildings: 2,
    activeSites: 1,
    gateways: 4,
    gatewaysOffline: 1,
    nodes: 9,
    telemetryReadings: 12,
  },
  openAlarmsBySeverity: { CAUTION: 1, DANGER: 2, WARNING: 0 },
  range: { from: "2026-07-15T00:00:00.000Z", key: "7d", to: "2026-07-22T00:00:00.000Z" },
  severityDistribution: { caution: 1, danger: 2, offline: 1, safe: 5, unconfigured: 0, warning: 0 },
  telemetryTrend: [
    { count: 3, date: "2026-07-21" },
    { count: 9, date: "2026-07-22" },
  ],
};

function renderApp() {
  window.history.pushState({}, "", "/company/dashboard");
  return render(
    <MantineProvider theme={gssTheme}>
      <App />
    </MantineProvider>,
  );
}

function setupFetch(summary: DashboardSummary = fullSummary) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.href === `${apiBaseUrl}/auth/company/me`) return new Response(JSON.stringify(session));
    if (url.pathname === "/company/dashboard/summary") {
      return new Response(JSON.stringify(summary));
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

describe("dashboard analytics", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("renders real KPI and chart sections, keeps reports permission-safe, and changes range", async () => {
    const fetchMock = setupFetch();
    renderApp();

    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeTruthy();
    expect(screen.getByText("Telemetry volume")).toBeTruthy();
    expect(screen.getByText("Latest node severity")).toBeTruthy();
    expect(screen.getByText("Open alarms")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("Active construction sites")).toBeTruthy();
    expect(screen.getByText("Active buildings")).toBeTruthy();
    expect(screen.getByText("Gateways")).toBeTruthy();
    expect(screen.getByText("Nodes")).toBeTruthy();

    const telemetryPoint = screen.getByRole("button", { name: /3 sensor readings/i });
    fireEvent.mouseEnter(telemetryPoint);
    expect((await screen.findByRole("tooltip")).textContent).toContain("3 readings received");
    fireEvent.focus(screen.getByRole("button", { name: /9 sensor readings/i }));
    expect((await screen.findByRole("tooltip")).textContent).toContain("9 readings received");

    fireEvent.change(screen.getByRole("combobox", { name: "Dashboard range" }), {
      target: { value: "30d" },
    });
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([input]) => String(input).includes("range=30d"))).toBe(
        true,
      ),
    );
  });

  it("omits unavailable monitoring and alarm sections without fake values", async () => {
    const restricted = {
      ...fullSummary,
      kpis: { activeBuildings: 1 },
      openAlarmsBySeverity: undefined,
      severityDistribution: undefined,
      telemetryTrend: undefined,
    };
    setupFetch(restricted);
    renderApp();

    expect(await screen.findByText("Active buildings")).toBeTruthy();
    expect(screen.queryByText("Telemetry volume")).toBeNull();
    expect(screen.queryByText("Open alarms")).toBeNull();
    expect(screen.getByText("No operational sections available")).toBeTruthy();
  });
});
