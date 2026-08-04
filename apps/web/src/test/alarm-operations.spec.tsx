import type { AuthSession } from "@gss-iot/contracts";
import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { cleanup, fireEvent, render, screen, waitFor, within } from "./render";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("socket.io-client", () => ({
  io: () => ({
    close: vi.fn(),
    connect: vi.fn(),
    emit: vi.fn(),
    io: { off: vi.fn(), on: vi.fn() },
    off: vi.fn(),
    on: vi.fn(),
  }),
}));

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
    permissions: ["alarms.view", "alarms.manage", "alarms.resolve", "notifications.view"],
  },
};

const adminSession: AuthSession = {
  context: "gss-admin",
  user: {
    email: "admin@example.com",
    id: "admin-1",
    isActive: true,
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
  window.sessionStorage.setItem(storageKey, JSON.stringify({ context: session.context }));
}

function renderApp(path: string) {
  window.history.pushState({}, "", path);
  return render(
    <MantineProvider theme={gssTheme}>
      <App />
    </MantineProvider>,
    { router: false },
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
        {
          code: "ALARM_EVENT_LATEST_STATE_UNSAFE",
          message: "The alarm cannot be manually resolved while the latest state is unsafe.",
        },
        409,
      ),
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      "The alarm cannot be manually resolved while the latest state is unsafe.",
    );
    expect(screen.getByText("Open")).toBeTruthy();
    await waitFor(() => expect(resolveButton.hasAttribute("disabled")).toBe(false));
  }, 30_000);

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

    await waitFor(() => expect(screen.getByText("Resolved")).toBeTruthy());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("selects resolved alarms from the pagination toolbar and bulk archives them", async () => {
    storeSession(companySession);
    const resolvedAlarm = {
      ...openAlarm,
      resolvedAt: "2026-07-21T00:01:00.000Z",
      status: "RESOLVED",
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input));
      if (url.href === `${apiBaseUrl}/auth/company/me`) return jsonResponse(companySession);
      if (url.pathname === "/company/alarms" && init.method !== "POST") {
        return jsonResponse({ items: [resolvedAlarm], page: 1, pageSize: 50, total: 1 });
      }
      if (url.pathname === "/company/alarms/bulk-archive" && init.method === "POST") {
        return jsonResponse({ archivedCount: 1, ids: [openAlarm.id] }, 201);
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);
    renderApp("/company/alarms");

    fireEvent.click(await screen.findByRole("checkbox", { name: "Select: 101" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete selected (1)" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete selected alarms?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete selected (1)" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input, init]) => {
          return (
            String(input).endsWith("/company/alarms/bulk-archive") &&
            init?.method === "POST" &&
            String(init.body).includes(openAlarm.id)
          );
        }),
      ).toBe(true),
    );
  }, 30_000);

  it("keeps Admin current-page selection stable, resolved-only and pruned after refresh", async () => {
    const selectableAdmin: AuthSession = {
      ...adminSession,
      user: { ...adminSession.user, permissions: ["alarms.view", "alarms.manage"] },
    };
    storeSession(selectableAdmin);
    const resolvedA = {
      ...openAlarm,
      id: "alarm-resolved-a",
      node: { id: "node-a", number: "201" },
      resolvedAt: "2026-07-21T00:01:00.000Z",
      status: "RESOLVED",
    };
    const resolvedB = {
      ...resolvedA,
      id: "alarm-resolved-b",
      node: { id: "node-b", number: "202" },
    };
    let items = [resolvedA, resolvedB, openAlarm];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input));
      if (url.href === `${apiBaseUrl}/auth/gss/me`) return jsonResponse(selectableAdmin);
      if (url.pathname === "/admin/alarms" && init.method !== "POST") {
        return jsonResponse({ items, page: 1, pageSize: 50, total: items.length });
      }
      if (url.pathname === "/admin/alarms/bulk-archive" && init.method === "POST") {
        items = [openAlarm];
        return jsonResponse({ archivedCount: 2, ids: [resolvedA.id, resolvedB.id] }, 201);
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);
    renderApp("/admin/alarms");

    expect(await screen.findByRole("checkbox", { name: "Select: 101" })).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByRole("checkbox", { name: "Select: 201" })).toHaveProperty("checked", true);
    expect(screen.getByRole("checkbox", { name: "Select: 202" })).toHaveProperty("checked", true);
    fireEvent.click(screen.getByRole("button", { name: "Delete selected (2)" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete selected alarms?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete selected (2)" }));

    await waitFor(() => expect(screen.queryByRole("checkbox", { name: "Select: 201" })).toBeNull());
    expect(
      screen
        .getAllByRole("button", { name: "Delete selected (0)" })
        .some((button) => button.hasAttribute("disabled")),
    ).toBe(true);
    const request = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input).endsWith("/admin/alarms/bulk-archive") && init?.method === "POST",
    );
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({ ids: [resolvedA.id, resolvedB.id] });
  });

  it("selects inbox notifications and bulk removes them from normal views", async () => {
    storeSession(companySession);
    const notification = {
      alarmEventId: openAlarm.id,
      attemptCount: 1,
      body: "Danger detected",
      channel: "IN_APP",
      createdAt: "2026-07-21T00:00:00.000Z",
      failureCode: null,
      failureMessage: null,
      id: "notification-1",
      maxAttempts: 3,
      policyId: "policy-1",
      policyTriggerId: "trigger-1",
      readAt: null,
      recipientUserId: companySession.user.id,
      sentAt: "2026-07-21T00:00:00.000Z",
      status: "SENT",
      title: "Danger alarm",
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input));
      if (url.href === `${apiBaseUrl}/auth/company/me`) return jsonResponse(companySession);
      if (url.pathname === "/company/notifications/unread-count") {
        return jsonResponse({ unreadCount: 1 });
      }
      if (url.pathname === "/company/notifications" && init.method !== "POST") {
        return jsonResponse({ items: [notification], page: 1, pageSize: 50, total: 1 });
      }
      if (url.pathname === "/company/notifications/bulk-archive" && init.method === "POST") {
        return jsonResponse({ archivedCount: 1, ids: [notification.id] }, 201);
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);
    renderApp("/company/notifications");

    fireEvent.click(await screen.findByRole("checkbox", { name: "Select: Danger alarm" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete selected (1)" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Delete selected notifications?",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete selected (1)" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            String(input).endsWith("/company/notifications/bulk-archive") &&
            init?.method === "POST",
        ),
      ).toBe(true),
    );
  }, 30_000);
});
