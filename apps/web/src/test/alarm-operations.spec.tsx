import type { AuthSession } from "@gss-iot/contracts";
import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    isSuperAdmin: false,
    name: "Manager",
    permissions: ["alarms.view", "alarms.resolve"],
  },
};

const adminSession: AuthSession = {
  accessToken: "admin-token",
  context: "gss-admin",
  user: {
    email: "admin@example.com",
    id: "admin-1",
    isSuperAdmin: false,
    name: "Admin",
    permissions: ["alarms.view", "alarms.resolve"],
  },
};

const openAlarm = {
  acknowledgedAt: null,
  building: { id: "building-1", title: "Building A" },
  buildingId: "building-1",
  id: "alarm-1",
  lastTriggeredAt: "2026-07-21T00:00:00.000Z",
  node: { id: "node-1", number: "101" },
  nodeId: "node-1",
  nodeTypeId: "node-type-1",
  openedAt: "2026-07-21T00:00:00.000Z",
  resolutionReason: null,
  resolvedAt: null,
  rule: { id: "rule-1", name: "Danger rule", severity: "DANGER" },
  severity: "DANGER",
  status: "OPEN",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

function storeSession(session: AuthSession) {
  window.sessionStorage.setItem(
    storageKey,
    JSON.stringify({ accessToken: session.accessToken, context: session.context }),
  );
}

function renderApp(path: string) {
  window.history.pushState({}, "", path);
  return render(
    <MantineProvider theme={gssTheme}>
      <App />
    </MantineProvider>,
  );
}

function mockAlarmFetch(session: AuthSession, patchHandler: () => Promise<Response> | Response) {
  const basePath = session.context === "gss-admin" ? "/admin" : "/company";
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    if (
      url.href === `${apiBaseUrl}/auth/${session.context === "gss-admin" ? "gss" : "company"}/me`
    ) {
      return jsonResponse(session);
    }
    if (url.href === `${apiBaseUrl}${basePath}/alarms/alarm-1/resolve` && init.method === "PATCH") {
      return patchHandler();
    }
    if (url.href === `${apiBaseUrl}${basePath}/alarms/alarm-1`) {
      return jsonResponse(openAlarm);
    }
    return jsonResponse({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("alarm operations", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("shows the backend conflict, preserves OPEN, resets loading, and prevents duplicate unsafe resolves in Company", async () => {
    storeSession(companySession);
    let releasePatch!: (response: Response) => void;
    const patchResponse = new Promise<Response>((resolve) => {
      releasePatch = resolve;
    });
    const fetchMock = mockAlarmFetch(companySession, () => patchResponse);
    renderApp("/company/alarms/alarm-1");

    const resolveButton = await screen.findByRole("button", { name: "Resolve" });
    fireEvent.click(resolveButton);
    fireEvent.click(resolveButton);

    await waitFor(() => expect(resolveButton.hasAttribute("disabled")).toBe(true));
    expect(
      fetchMock.mock.calls.filter(
        ([input, init]) =>
          String(input).endsWith("/company/alarms/alarm-1/resolve") && init?.method === "PATCH",
      ),
    ).toHaveLength(1);

    releasePatch(
      jsonResponse(
        { message: "The alarm cannot be manually resolved while the latest state is unsafe." },
        409,
      ),
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      "The alarm cannot be manually resolved while the latest state is unsafe.",
    );
    expect(screen.getByText("OPEN")).toBeTruthy();
    await waitFor(() => expect(resolveButton.hasAttribute("disabled")).toBe(false));
  });

  it("applies the successful SAFE resolve response in the shared Admin alarm interface", async () => {
    storeSession(adminSession);
    const resolvedAlarm = {
      ...openAlarm,
      resolvedAt: "2026-07-21T00:01:00.000Z",
      status: "RESOLVED",
    };
    mockAlarmFetch(adminSession, () => jsonResponse(resolvedAlarm));
    renderApp("/admin/alarms/alarm-1");

    fireEvent.click(await screen.findByRole("button", { name: "Resolve" }));

    await waitFor(() => expect(screen.getByText("RESOLVED")).toBeTruthy());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
