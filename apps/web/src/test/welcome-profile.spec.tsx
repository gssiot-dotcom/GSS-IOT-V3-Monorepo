import type { AuthContext, AuthSession } from "@gss-iot/contracts";
import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const socketMock = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const managerHandlers = new Map<string, (...args: unknown[]) => void>();
  const socket = {
    close: vi.fn(),
    emit: vi.fn(),
    io: {
      off: vi.fn((event: string) => managerHandlers.delete(event)),
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        managerHandlers.set(event, handler);
      }),
    },
    off: vi.fn((event: string) => handlers.delete(event)),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
    }),
    trigger: (event: string, ...args: unknown[]) => handlers.get(event)?.(...args),
    triggerManager: (event: string, ...args: unknown[]) => managerHandlers.get(event)?.(...args),
  };
  return { io: vi.fn(() => socket), socket };
});

vi.mock("socket.io-client", () => ({ io: socketMock.io }));

import { App } from "../App";

const storageKey = "gss-iot-v3-auth-session";
const apiBaseUrl = "http://localhost:3000";

const companySession: AuthSession = {
  accessToken: "company-token",
  context: "company-user",
  user: {
    company: { id: "company-1", name: "Acme Safety" },
    companyId: "company-1",
    email: "company@example.com",
    id: "company-user-1",
    isActive: true,
    isSuperAdmin: false,
    lastLoginAt: "2026-07-22T01:00:00.000Z",
    name: "Company User",
    permissions: ["welcome.view", "dashboard.view"],
    phone: "010-0000-0000",
    role: { id: "role-1", isSuperAdmin: false, key: "manager", name: "Manager" },
  },
};

const adminSession: AuthSession = {
  accessToken: "admin-token",
  context: "gss-admin",
  user: {
    email: "admin@example.com",
    id: "admin-1",
    isActive: true,
    isSuperAdmin: true,
    lastLoginAt: "2026-07-22T01:00:00.000Z",
    name: "GSS Admin",
    permissions: ["welcome.view", "companies.view"],
    phone: null,
    role: { id: "gss-role-1", isSuperAdmin: true, key: "super", name: "Super administrator" },
  },
};

function renderApp(path: string) {
  window.history.pushState({}, "", path);
  return render(
    <MantineProvider theme={gssTheme}>
      <App />
    </MantineProvider>,
  );
}

function storeSession(context: AuthContext) {
  window.sessionStorage.setItem(
    storageKey,
    JSON.stringify({ accessToken: companySession.accessToken, context }),
  );
}

function mockFetch(session: AuthSession = companySession) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (
      url.href === `${apiBaseUrl}/auth/${session.context === "gss-admin" ? "gss" : "company"}/me`
    ) {
      return new Response(JSON.stringify(session), { status: 200 });
    }
    if (url.href === `${apiBaseUrl}/company/notifications/unread-count`) {
      return new Response(JSON.stringify({ unreadCount: 3 }), { status: 200 });
    }
    if (url.href === `${apiBaseUrl}/auth/logout`) return new Response(null, { status: 204 });
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("Welcome and profile surfaces", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    socketMock.io.mockClear();
    socketMock.socket.close.mockClear();
    mockFetch();
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("renders a personalized company Welcome page and permission-filtered links", async () => {
    storeSession("company-user");
    renderApp("/company/welcome");

    expect(await screen.findByText("Welcome, Company User")).toBeTruthy();
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.queryByText("Company users")).toBeNull();
  });

  it("renders the portal-specific GSS Admin Welcome page", async () => {
    storeSession("gss-admin");
    mockFetch(adminSession);
    renderApp("/admin/welcome");

    expect(await screen.findByText("Welcome, GSS Admin")).toBeTruthy();
    expect(screen.getByText("Your authorized GSS operations workspace.")).toBeTruthy();
    expect(screen.getAllByText("Companies").length).toBeGreaterThan(0);
  });

  it("keeps Welcome and profile available without feature permissions", async () => {
    storeSession("company-user");
    const limited = { ...companySession, user: { ...companySession.user, permissions: [] } };
    mockFetch(limited);
    renderApp("/company/welcome");

    expect(await screen.findByText("Welcome, Company User")).toBeTruthy();
    expect(screen.getByText("No modules available")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open account menu" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Open profile" }));
    expect(await screen.findByRole("heading", { name: "Profile" })).toBeTruthy();
  });

  it("shows account metadata and signs out from the account menu", async () => {
    storeSession("company-user");
    renderApp("/company/profile");

    expect(await screen.findByText("Acme Safety")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open account menu" }));
    expect(screen.getByText("Manager")).toBeTruthy();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeTruthy();
  });

  it("does not create a notification socket without notifications.view", async () => {
    storeSession("company-user");
    renderApp("/company/welcome");

    await screen.findByText("Welcome, Company User");
    expect(socketMock.io).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Notifications" })).toBeNull();
  });

  it("tracks notification realtime transitions and unread count", async () => {
    const session = {
      ...companySession,
      user: { ...companySession.user, permissions: ["welcome.view", "notifications.view"] },
    };
    storeSession("company-user");
    mockFetch(session);
    renderApp("/company/welcome");

    await screen.findByText("Welcome, Company User");
    await waitFor(() => expect(socketMock.io).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("3")).toBeTruthy();
    socketMock.socket.trigger("connect");
    await waitFor(() => expect(screen.queryByText("Realtime connecting")).toBeNull());
    socketMock.socket.triggerManager("reconnect_attempt");
    expect(await screen.findByText("Realtime reconnecting")).toBeTruthy();
    socketMock.socket.trigger("disconnect");
    expect(await screen.findByText("Realtime offline")).toBeTruthy();
  });
});
