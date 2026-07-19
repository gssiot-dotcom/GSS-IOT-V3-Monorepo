import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BuildingMonitoringPage,
  NodeTypeMonitoringPage,
} from "../features/monitoring/CompanyMonitoringPage";
import { apiRequest } from "../shared/api/api-client";

vi.mock("../shared/auth/auth-context", () => ({
  useAuth: () => ({
    session: {
      accessToken: "token",
      context: "company-user",
      user: {
        email: "monitor@example.com",
        id: "user-1",
        isSuperAdmin: false,
        name: "Monitor",
        permissions: [
          "monitoring.view",
          "monitoring.realtime",
          "alarm-levels.view",
          "alarm-levels.manage",
        ],
      },
    },
  }),
}));

vi.mock("../shared/api/api-client", () => ({
  apiRequest: vi.fn(),
}));

vi.mock("socket.io-client", () => ({
  io: () => ({
    disconnect: vi.fn(),
    emit: vi.fn(),
    io: { on: vi.fn() },
    on: vi.fn(),
  }),
}));

describe("Phase 6 monitoring UI", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(apiRequest).mockResolvedValue({
      building: {
        address: null,
        areaId: "area-1",
        buildingType: null,
        companyId: "company-1",
        id: "building-1",
        number: null,
        status: "ACTIVE",
        title: "Tower A",
      },
      nodeTypes: [
        {
          count: 2,
          latestStatus: "safe",
          nodeType: {
            displayName: "Door Node",
            id: "door",
            imageAssetKey: "door-node.png",
            key: "door_node",
            numericCode: 0,
          },
        },
        {
          count: 1,
          latestStatus: "safe",
          nodeType: {
            displayName: "Angle Node",
            id: "angle",
            imageAssetKey: "angle-node.png",
            key: "angle_node",
            numericCode: 1,
          },
        },
        {
          count: 1,
          latestStatus: "safe",
          nodeType: {
            displayName: "Gangform Node",
            id: "gangform",
            imageAssetKey: "gangform.png",
            key: "gangform_node",
            numericCode: 2,
          },
        },
      ],
    });
  });

  it("renders live building monitoring through the three legacy node-type cards", async () => {
    render(
      <MantineProvider theme={gssTheme}>
        <MemoryRouter initialEntries={["/company/buildings/building-1/monitoring"]}>
          <Routes>
            <Route
              element={<BuildingMonitoringPage />}
              path="/company/buildings/:buildingId/monitoring"
            />
          </Routes>
        </MemoryRouter>
      </MantineProvider>,
    );

    expect(await screen.findByText("Tower A")).toBeTruthy();
    expect(screen.getByTestId("node-type-card-door_node")).toBeTruthy();
    expect(screen.getByTestId("node-type-card-angle_node")).toBeTruthy();
    expect(screen.getByTestId("node-type-card-gangform_node")).toBeTruthy();
  });

  it("renders unconfigured monitoring state and Phase 9 configuration tabs", async () => {
    vi.mocked(apiRequest).mockImplementation(async (_session, path) => {
      if (path === "/company/buildings/building-1/monitoring/angle_node") {
        return {
          building: {
            address: null,
            areaId: "area-1",
            buildingType: null,
            companyId: "company-1",
            id: "building-1",
            number: null,
            status: "ACTIVE",
            title: "Tower A",
          },
          historyRetentionDays: 180,
          nodeType: {
            displayName: "Angle Node",
            id: "angle",
            imageAssetKey: "angle-node.png",
            key: "angle_node",
            numericCode: 1,
          },
          states: [
            {
              areaId: "area-1",
              building: { id: "building-1", title: "Tower A" },
              buildingId: "building-1",
              classificationEvidence: { classification: "unconfigured" },
              companyId: "company-1",
              faultFiltered: false,
              gateway: { id: "gateway-1", serialNumber: "0300" },
              gatewayId: "gateway-1",
              lastSeenAt: new Date().toISOString(),
              node: { id: "node-1", installedLocation: null, number: "100" },
              nodeId: "node-1",
              nodeType: {
                displayName: "Angle Node",
                id: "angle",
                imageAssetKey: "angle-node.png",
                key: "angle_node",
                numericCode: 1,
              },
              nodeTypeId: "angle",
              status: "unconfigured",
              updatedAt: new Date().toISOString(),
              values: { angleX: 1, angleY: 0 },
            },
          ],
        };
      }
      if (path.includes("/history")) {
        return { items: [], page: 1, pageSize: 25, total: 0 };
      }
      if (path === "/company/buildings/building-1/alarm-levels") {
        return {
          building: {
            address: null,
            areaId: "area-1",
            buildingType: null,
            companyId: "company-1",
            id: "building-1",
            number: null,
            status: "ACTIVE",
            title: "Tower A",
          },
          configurations: [
            {
              buildingId: "building-1",
              cautionThreshold: 1,
              dangerThreshold: 4,
              enabled: true,
              id: "config-1",
              nodeType: {
                displayName: "Angle Node",
                id: "angle",
                imageAssetKey: "angle-node.png",
                key: "angle_node",
                numericCode: 1,
              },
              nodeTypeId: "angle",
              updatedAt: new Date().toISOString(),
              version: 1,
              warningThreshold: 2,
            },
          ],
          gatewayApplications: [
            {
              appliedAt: null,
              appliedCommandId: null,
              appliedConfigurationVersion: null,
              appliedEnabled: true,
              appliedRequestId: null,
              desiredCommandId: "command-1",
              desiredEnabled: true,
              desiredStatus: "ACKNOWLEDGED",
              failureReason: null,
              gateway: { id: "gateway-1", serialNumber: "0300" },
              gatewayId: "gateway-1",
              id: "application-1",
              nodeTypeId: "angle",
            },
          ],
          nodeTypes: [
            {
              displayName: "Angle Node",
              id: "angle",
              imageAssetKey: "angle-node.png",
              key: "angle_node",
              numericCode: 1,
            },
          ],
        };
      }
      if (path === "/company/buildings/building-1/alarm-levels/fault-filters") {
        return { building: { id: "building-1", title: "Tower A" }, gateways: [] };
      }
      if (path === "/company/buildings/building-1/alarm-levels/gateways/gateway-1") {
        return {
          building: { id: "building-1", title: "Tower A" },
          configurations: [],
          gatewayApplications: [
            {
              appliedAt: null,
              appliedCommandId: null,
              appliedConfigurationVersion: null,
              appliedEnabled: true,
              appliedRequestId: null,
              desiredCommandId: "command-2",
              desiredEnabled: false,
              desiredStatus: "SENT",
              failureReason: null,
              gateway: { id: "gateway-1", serialNumber: "0300" },
              gatewayId: "gateway-1",
              id: "application-1",
              nodeTypeId: "angle",
            },
          ],
          nodeTypes: [
            {
              displayName: "Angle Node",
              id: "angle",
              imageAssetKey: "angle-node.png",
              key: "angle_node",
              numericCode: 1,
            },
          ],
        };
      }
      return {};
    });

    render(
      <MantineProvider theme={gssTheme}>
        <MemoryRouter initialEntries={["/company/buildings/building-1/monitoring/angle_node"]}>
          <Routes>
            <Route
              element={<NodeTypeMonitoringPage />}
              path="/company/buildings/:buildingId/monitoring/:nodeType"
            />
          </Routes>
        </MemoryRouter>
      </MantineProvider>,
    );

    expect(await screen.findByText("Unconfigured")).toBeTruthy();
    expect(screen.getByText("Alarm levels")).toBeTruthy();
    expect(screen.getByText("Fault filters")).toBeTruthy();
    fireEvent.click(screen.getByText("Alarm levels"));
    await waitFor(() => expect(screen.getAllByText("0300").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByLabelText("Toggle alarm for gateway 0300"));
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        expect.anything(),
        "/company/buildings/building-1/alarm-levels/gateways/gateway-1",
        expect.objectContaining({
          body: JSON.stringify({ enabled: false, nodeType: "angle_node" }),
          method: "PATCH",
        }),
      ),
    );
  });
});
