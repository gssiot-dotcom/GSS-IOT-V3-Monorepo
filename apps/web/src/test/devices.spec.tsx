import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminDevicesPage } from "../features/devices/AdminDevicesPage";
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
        permissions: [
          "devices.assign",
          "devices.view",
          "gateways.assign",
          "gateways.create",
          "gateways.view",
          "mqtt-commands.manage",
          "mqtt-commands.view",
          "nodes.assign",
          "nodes.create",
          "nodes.view",
        ],
      },
    },
  }),
}));

vi.mock("../shared/api/api-client", () => ({
  apiRequest: vi.fn(),
}));

describe("Phase 8 Admin devices provisioning UI", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockImplementation((_session, path) => {
      if (path === "/admin/devices/gateways") {
        return Promise.resolve([
          {
            buildingAssignments: [
              {
                assignedAt: "2026-07-16T00:00:00.000Z",
                building: { areaId: "area-1", companyId: "company-1", title: "Building A" },
                buildingId: "building-1",
                id: "gba-1",
              },
            ],
            companyAssignments: [
              {
                assignedAt: "2026-07-16T00:00:00.000Z",
                company: { name: "Company A" },
                companyId: "company-1",
                id: "gca-1",
              },
            ],
            gatewayType: "NODES_GATEWAY",
            id: "gateway-1",
            installedLocation: null,
            lastSeenAt: null,
            serialNumber: "GW-001",
            status: "ACTIVE",
          },
        ]);
      }
      if (path === "/admin/devices/nodes") {
        return Promise.resolve([
          {
            batteryLevel: null,
            companyAssignments: [
              {
                assignedAt: "2026-07-16T00:00:00.000Z",
                company: { name: "Company A" },
                companyId: "company-1",
                id: "nca-1",
              },
            ],
            gatewayAssignments: [],
            id: "node-1",
            installedLocation: null,
            lastSeenAt: null,
            nodeType: {
              displayName: "Door Node",
              id: "node-type-1",
              imageAssetKey: "door-node.png",
              key: "door_node",
              numericCode: 0,
            },
            nodeTypeId: "node-type-1",
            number: "NODE-001",
            status: "ACTIVE",
          },
        ]);
      }
      if (path === "/admin/devices/node-types") {
        return Promise.resolve([
          {
            displayName: "Door Node",
            id: "node-type-1",
            imageAssetKey: "door-node.png",
            key: "door_node",
            numericCode: 0,
          },
        ]);
      }
      if (path === "/admin/gateway-commands") {
        return Promise.resolve([
          {
            acknowledgedAt: null,
            attemptCount: 1,
            cancelledAt: null,
            commandNumber: 2,
            commandType: "REGISTER_NODES",
            correlationKey: "GW-001:2",
            createdAt: "2026-07-16T00:00:00.000Z",
            expiresAt: "2026-07-16T00:10:00.000Z",
            failedAt: null,
            failureReason: null,
            gateway: { id: "gateway-1", serialNumber: "GW-001" },
            gatewayId: "gateway-1",
            id: "command-1",
            lastAttemptAt: "2026-07-16T00:00:00.000Z",
            maxAttempts: 3,
            payload: { cmd: 2 },
            provisioningRequest: {
              appliedAt: null,
              buildingId: "building-1",
              companyId: "company-1",
              failedAt: null,
              failureReason: null,
              gatewayId: "gateway-1",
              id: "request-1",
              items: [
                {
                  appliedAt: null,
                  assignmentId: null,
                  failureReason: null,
                  id: "item-1",
                  node: { number: "NODE-001" },
                  nodeId: "node-1",
                },
              ],
              nodeTypeId: "node-type-1",
              responsePayload: null,
              status: "SENT",
            },
            requesterId: "admin-1",
            requesterType: "GSS_ADMIN",
            responsePayload: null,
            sentAt: "2026-07-16T00:00:00.000Z",
            status: "SENT",
            topic: "GSSIOT/test/GATE_SUB/GRM22JU22PGW-001",
            updatedAt: "2026-07-16T00:00:00.000Z",
          },
        ]);
      }
      if (path === "/admin/devices/provisioning-options") {
        return Promise.resolve({
          areas: [{ companyId: "company-1", id: "area-1", name: "Area A", status: "ACTIVE" }],
          buildings: [
            {
              areaId: "area-1",
              companyId: "company-1",
              id: "building-1",
              status: "ACTIVE",
              title: "Building A",
            },
          ],
          companies: [{ id: "company-1", name: "Company A", status: "ACTIVE" }],
        });
      }
      return Promise.reject(new Error(`Unhandled API path: ${path}`));
    });
  });

  it("renders selector-based MQTT provisioning and command status", async () => {
    render(
      <MantineProvider theme={gssTheme}>
        <AdminDevicesPage />
      </MantineProvider>,
    );

    expect(await screen.findByText("MQTT node provisioning")).toBeTruthy();
    expect(screen.getByText("Eligible nodes")).toBeTruthy();
    expect(
      screen.getByText(
        "Active node-gateway assignment is created only after a successful gateway response.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("SENT")).toBeTruthy();
    expect(screen.getByText("NODE-001")).toBeTruthy();
  });
});
