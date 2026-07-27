import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GatewayCommandsPage } from "../features/gateway-commands/GatewayCommandsPage";
import { apiRequest } from "../shared/api/api-client";

const mockAuth = vi.hoisted(() => ({
  logout: vi.fn(),
  session: {
    accessToken: "token",
    context: "gss-admin",
    user: {
      email: "admin@example.com",
      id: "admin-1",
      isActive: true,
      isSuperAdmin: false,
      name: "Admin",
      permissions: ["mqtt-commands.manage", "mqtt-commands.view"],
    },
  },
}));

vi.mock("../shared/auth/auth-context", () => ({
  useAuth: () => mockAuth,
}));

vi.mock("../shared/api/api-client", () => ({
  apiRequest: vi.fn(),
}));

describe("Gateway commands MQTT status UI", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.mocked(apiRequest).mockImplementation((_session, path) => {
      if (path.startsWith("/admin/gateway-commands?")) {
        return Promise.resolve({ items: [], page: 1, pageSize: 50, total: 0 });
      }
      if (path === "/admin/gateway-commands/mqtt-status") {
        return Promise.resolve({
          brokerHost: "broker.example:1883",
          clientId: "gss-client",
          connected: true,
          enabled: true,
          lastConnectedAt: "2026-07-18T00:00:00.000Z",
          lastError: null,
          lastMessageAt: "2026-07-18T00:01:00.000Z",
          lastPublishAt: "2026-07-18T00:02:00.000Z",
          subscribedTopicFilters: [
            "GSSIOT/test/GATE_RES/+",
            "GSSIOT/test/GATE_PUB/+",
            "GSSIOT/test/GATE_ANG/+",
            "GSSIOT/test/GATE_FORM/+",
          ],
        });
      }
      return Promise.reject(new Error(`Unhandled API path: ${path}`));
    });
  });

  it("renders sanitized MQTT connection and subscription status", async () => {
    render(
      <MantineProvider theme={gssTheme}>
        <GatewayCommandsPage />
      </MantineProvider>,
    );

    expect(await screen.findByText("MQTT status")).toBeTruthy();
    expect(screen.getByText("broker.example:1883")).toBeTruthy();
    expect(screen.getByText("gss-client")).toBeTruthy();
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.getByText("GSSIOT/test/GATE_RES/+")).toBeTruthy();
    expect(screen.getByText("GSSIOT/test/GATE_FORM/+")).toBeTruthy();
    expect(screen.getByText("No records found")).toBeTruthy();
    expect(document.body.textContent).not.toContain("username");
    expect(document.body.textContent).not.toContain("password");
  });

  it("shows the error state after a failed gateway-command request", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error("HTTP 500"));

    render(
      <MantineProvider theme={gssTheme}>
        <GatewayCommandsPage />
      </MantineProvider>,
    );

    expect(await screen.findByText("Unable to load data")).toBeTruthy();
    expect(screen.queryByText("Loading")).toBeNull();
  });

  it("keeps retry and cancel permission-aware behind the command menu and confirmation", async () => {
    const command = {
      acknowledgedAt: null,
      attemptCount: 1,
      cancelledAt: null,
      commandNumber: 2,
      commandType: "REGISTER_NODES" as const,
      correlationKey: "GW-001:2",
      createdAt: "2026-07-18T00:00:00.000Z",
      expiresAt: "2026-07-18T00:10:00.000Z",
      failedAt: "2026-07-18T00:01:00.000Z",
      failureReason: "Broker unavailable",
      gateway: { id: "gateway-1", serialNumber: "GW-001" },
      gatewayId: "gateway-1",
      id: "command-1",
      lastAttemptAt: "2026-07-18T00:00:00.000Z",
      maxAttempts: 3,
      payload: { cmd: 2, requestId: "command-1" },
      provisioningRequest: null,
      requesterId: "admin-1",
      requesterType: "GSS_ADMIN" as const,
      responsePayload: null,
      sentAt: null,
      status: "FAILED" as const,
      topic: "GSSIOT/test/GATE_SUB/GW-001",
      updatedAt: "2026-07-18T00:01:00.000Z",
    };
    const calls: string[] = [];
    vi.mocked(apiRequest).mockImplementation((_session, path) => {
      calls.push(String(path));
      if (path.startsWith("/admin/gateway-commands?"))
        return Promise.resolve({ items: [command], page: 1, pageSize: 50, total: 1 });
      if (path === "/admin/gateway-commands/mqtt-status")
        return Promise.resolve({
          brokerHost: "broker.example:1883",
          clientId: "gss-client",
          connected: true,
          enabled: true,
          lastConnectedAt: null,
          lastError: null,
          lastMessageAt: null,
          lastPublishAt: null,
          subscribedTopicFilters: [],
        });
      if (path === "/admin/gateway-commands/command-1/retry")
        return Promise.resolve({ ...command, status: "SENT" });
      return Promise.reject(new Error(`Unhandled API path: ${path}`));
    });

    render(
      <MantineProvider theme={gssTheme}>
        <GatewayCommandsPage />
      </MantineProvider>,
    );

    expect((await screen.findAllByText("Failed")).length).toBeGreaterThan(0);
    expect(screen.getByText("Register nodes")).toBeTruthy();
    const menuButton = await screen.findByRole("button", { name: "More actions: GW-001 2" });
    fireEvent.click(menuButton);
    await waitFor(() =>
      expect(document.getElementById(menuButton.getAttribute("aria-controls")!)).toBeTruthy(),
    );
    const menu = document.getElementById(menuButton.getAttribute("aria-controls")!);
    expect(menu).toBeTruthy();
    fireEvent.click(within(menu!).getByRole("menuitem", { name: "Retry", hidden: true }));

    const dialog = await screen.findByRole("dialog", { name: "Retry command GW-001?" });
    expect(within(dialog).getByText("GW-001 · 2")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(calls).toContain("/admin/gateway-commands/command-1/retry"));
  });
});
