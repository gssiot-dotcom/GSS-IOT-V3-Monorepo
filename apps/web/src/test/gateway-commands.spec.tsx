import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GatewayCommandsPage } from "../features/gateway-commands/GatewayCommandsPage";
import { apiRequest } from "../shared/api/api-client";

vi.mock("../shared/auth/auth-context", () => ({
  useAuth: () => ({
    session: {
      accessToken: "token",
      context: "gss-admin",
      user: {
        email: "admin@example.com",
        id: "admin-1",
        isSuperAdmin: false,
        name: "Admin",
        permissions: ["mqtt-commands.manage", "mqtt-commands.view"],
      },
    },
  }),
}));

vi.mock("../shared/api/api-client", () => ({
  apiRequest: vi.fn(),
}));

describe("Gateway commands MQTT status UI", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockImplementation((_session, path) => {
      if (path === "/admin/gateway-commands") {
        return Promise.resolve([]);
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
    expect(document.body.textContent).not.toContain("username");
    expect(document.body.textContent).not.toContain("password");
  });
});
