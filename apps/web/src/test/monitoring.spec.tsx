import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BuildingMonitoringPage,
  CompanyMonitoringIndexPage,
  NodeTypeMonitoringPage,
} from "../features/monitoring/CompanyMonitoringPage";
import { AdminMonitoringPage } from "../features/monitoring/AdminMonitoringPage";
import { NodeStateCard } from "../features/monitoring/components/NodeStateCard";
import { NodeHistoryChart } from "../features/monitoring/components/NodeHistoryChart";
import { NodeDetailDrawer } from "../features/monitoring/components/NodeDetailDrawer";
import { apiRequest } from "../shared/api/api-client";

vi.mock("../shared/auth/auth-context", () => ({
  useAuth: () => ({
    session: {
      accessToken: "token",
      context: "company-user",
      user: {
        email: "monitor@example.com",
        id: "user-1",
        isActive: true,
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
    window.localStorage.clear();
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

  it("renders compact semantic building entry cards and preserves monitoring navigation", async () => {
    vi.mocked(apiRequest).mockImplementation(async (_session, path) => {
      if (path !== "/company/buildings") throw new Error(`Unexpected request: ${path}`);
      return [
        {
          address: "10 Safety Road",
          areaId: "area-1",
          buildingType: "Tower",
          companyId: "company-1",
          id: "building-1",
          number: "BLD-01",
          status: "ACTIVE",
          title: "Tower A",
        },
        {
          address: null,
          areaId: "area-1",
          buildingType: "Warehouse",
          companyId: "company-1",
          id: "building-2",
          number: "BLD-02",
          status: "INACTIVE",
          title: "Warehouse B",
        },
      ];
    });

    render(
      <MantineProvider theme={gssTheme}>
        <MemoryRouter initialEntries={["/company/monitoring"]}>
          <Routes>
            <Route element={<CompanyMonitoringIndexPage />} path="/company/monitoring" />
            <Route
              element={<div>Building monitoring destination</div>}
              path="/company/buildings/:buildingId/monitoring"
            />
          </Routes>
        </MemoryRouter>
      </MantineProvider>,
    );

    const towerCard = await screen.findByRole("button", {
      name: "Open monitoring for Tower A",
    });
    expect(towerCard.textContent).toContain("Active");
    expect(towerCard.textContent).toContain("10 Safety Road");
    expect(towerCard.textContent).toContain("BLD-01");
    expect(
      screen.getByRole("button", { name: "Open monitoring for Warehouse B" }).textContent,
    ).toContain("Inactive");
    fireEvent.click(towerCard);
    expect(await screen.findByText("Building monitoring destination")).toBeTruthy();
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

    expect((await screen.findAllByText("Unconfigured")).length).toBeGreaterThan(0);
    const summaryGrid = screen.getByTestId("monitoring-summary-grid");
    for (const label of ["Total nodes", "Safe", "Caution", "Warning", "Danger", "Offline"]) {
      expect(summaryGrid.textContent).toContain(label);
    }
    expect(screen.getByLabelText("Monitoring view")).toBeTruthy();
    expect(screen.getByText("Alarm levels")).toBeTruthy();
    expect(screen.getByText("Fault filters")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Cards" }));
    expect(screen.getByRole("button", { name: "Node 100, Unconfigured" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Node 100, Unconfigured" }));
    expect(await screen.findByText("Node 100 detail")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /fault filter/i })).toBeNull();
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

  it("restores the card preference and renders door, angle and bounded history presentation", async () => {
    window.localStorage.setItem("gss.monitoring.view", "CARD");
    const now = new Date().toISOString();
    const common = {
      areaId: "area-1",
      building: { id: "building-1", title: "Tower A" },
      buildingId: "building-1",
      companyId: "company-1",
      gateway: { id: "gateway-1", serialNumber: "0300" },
      gatewayId: "gateway-1",
      lastSeenAt: now,
      nodeTypeId: "node-type-1",
      updatedAt: now,
    } as const;
    render(
      <MantineProvider theme={gssTheme}>
        <NodeStateCard
          onOpen={vi.fn()}
          state={{
            ...common,
            classificationEvidence: null,
            faultFiltered: false,
            node: { id: "door-1", installedLocation: null, number: "101" },
            nodeId: "door-1",
            nodeType: {
              displayName: "Door Node",
              id: "door",
              imageAssetKey: "door.png",
              key: "door_node",
              numericCode: 0,
            },
            status: "danger",
            values: { batteryLevel: 42, doorState: "open" },
          }}
        />
        <NodeStateCard
          onOpen={vi.fn()}
          state={{
            ...common,
            classificationEvidence: null,
            faultFiltered: false,
            node: { id: "angle-1", installedLocation: null, number: "102" },
            nodeId: "angle-1",
            nodeType: {
              displayName: "Angle Node",
              id: "angle",
              imageAssetKey: "angle.png",
              key: "angle_node",
              numericCode: 1,
            },
            status: "warning",
            values: { angleX: 3, angleY: -1 },
          }}
        />
        <NodeHistoryChart
          history={{
            items: [
              {
                buildingId: "building-1",
                faultFiltered: false,
                gateway: { id: "gateway-1", serialNumber: "0300" },
                gatewayId: "gateway-1",
                id: "reading-1",
                measuredAt: now,
                node: { id: "angle-1", installedLocation: null, number: "102" },
                nodeId: "angle-1",
                nodeType: {
                  displayName: "Angle Node",
                  id: "angle",
                  imageAssetKey: "angle.png",
                  key: "angle_node",
                  numericCode: 1,
                },
                nodeTypeId: "angle",
                receivedAt: now,
                classificationEvidence: null,
                status: "warning",
                values: { angleX: 3, angleY: -1 },
              },
            ],
            page: 1,
            pageSize: 25,
            total: 1,
          }}
          nodeType="angle_node"
          thresholds={{ cautionThreshold: 1, dangerThreshold: 4, warningThreshold: 2 }}
        />
      </MantineProvider>,
    );
    expect(screen.getByText("Open")).toBeTruthy();
    expect(screen.getAllByText("Warning").length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: /T-shaped status indicator/i })).toBeTruthy();
    expect(screen.getByRole("img", { name: "X/Y angle history" })).toBeTruthy();
    fireEvent.mouseEnter(screen.getByRole("button", { name: /Reading received.*Warning.*X/i }));
    expect((await screen.findByRole("tooltip")).textContent).toContain("X angle: 3.0°");
    expect((await screen.findByRole("tooltip")).textContent).toContain("Y angle: -1.0°");
  });

  it("shows complete door reading details on hover and keyboard focus", async () => {
    const now = "2026-07-22T01:02:03.000Z";
    render(
      <MantineProvider theme={gssTheme}>
        <NodeHistoryChart
          history={{
            items: [
              {
                buildingId: "building-1",
                classificationEvidence: null,
                faultFiltered: false,
                gateway: { id: "gateway-1", serialNumber: "0300" },
                gatewayId: "gateway-1",
                id: "door-reading-1",
                measuredAt: now,
                node: { id: "door-1", installedLocation: null, number: "101" },
                nodeId: "door-1",
                nodeType: {
                  displayName: "Door Node",
                  id: "door",
                  imageAssetKey: "door.png",
                  key: "door_node",
                  numericCode: 0,
                },
                nodeTypeId: "door",
                receivedAt: now,
                status: "danger",
                values: { batteryLevel: 42, doorState: "open" },
              },
            ],
            page: 1,
            pageSize: 25,
            total: 1,
          }}
          nodeType="door_node"
        />
      </MantineProvider>,
    );

    const point = screen.getByRole("button", { name: /Reading received.*Danger/i });
    fireEvent.focus(point);
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toContain("Door state: Open");
    expect(tooltip.textContent).toContain("Battery: 42%");
    expect(tooltip.textContent).toContain("Status: Danger");
  });

  it("explains angle deviation and direction in the node detail drawer", async () => {
    const now = "2026-07-22T01:02:03.000Z";
    render(
      <MantineProvider theme={gssTheme}>
        <NodeDetailDrawer
          history={{
            items: [
              {
                buildingId: "building-1",
                faultFiltered: false,
                gateway: { id: "gateway-1", serialNumber: "0300" },
                gatewayId: "gateway-1",
                id: "reading-1",
                measuredAt: now,
                node: { id: "angle-1", installedLocation: null, number: "102" },
                nodeId: "angle-1",
                nodeType: {
                  displayName: "Angle Node",
                  id: "angle",
                  imageAssetKey: "angle.png",
                  key: "angle_node",
                  numericCode: 1,
                },
                nodeTypeId: "angle",
                receivedAt: now,
                classificationEvidence: null,
                status: "warning",
                values: { angleX: 2.4, angleY: -1.1 },
              },
            ],
            page: 1,
            pageSize: 25,
            total: 1,
          }}
          node={{
            areaId: "area-1",
            building: { id: "building-1", title: "Tower A" },
            buildingId: "building-1",
            classificationEvidence: null,
            companyId: "company-1",
            faultFiltered: false,
            gateway: { id: "gateway-1", serialNumber: "0300" },
            gatewayId: "gateway-1",
            lastSeenAt: now,
            node: { id: "angle-1", installedLocation: "Roof", number: "102" },
            nodeId: "angle-1",
            nodeType: {
              displayName: "Angle Node",
              id: "angle",
              imageAssetKey: "angle.png",
              key: "angle_node",
              numericCode: 1,
            },
            nodeTypeId: "angle",
            status: "warning",
            updatedAt: now,
            values: { angleX: 2.4, angleY: -1.1 },
          }}
          nodeType="angle_node"
          onClose={vi.fn()}
        />
      </MantineProvider>,
    );

    expect(await screen.findByText("X deviation: 2.4°")).toBeTruthy();
    expect(screen.getByText("Y deviation: -1.1°")).toBeTruthy();
    expect(screen.getByText("Reference / zero line")).toBeTruthy();
    expect(screen.getByText("Current tilt direction")).toBeTruthy();
    expect(screen.getAllByText("Warning").length).toBeGreaterThan(0);
    expect(screen.getByText(/Last reading:/)).toBeTruthy();
    expect(screen.getByRole("img", { name: "Tilt direction plot" })).toBeTruthy();
  });

  it("applies a distinct tint, glow and top line for every live node status", () => {
    const statuses = ["safe", "caution", "warning", "danger", "offline"] as const;
    const common = {
      areaId: "area-1",
      building: { id: "building-1", title: "Tower A" },
      buildingId: "building-1",
      companyId: "company-1",
      gateway: { id: "gateway-1", serialNumber: "0300" },
      gatewayId: "gateway-1",
      lastSeenAt: new Date().toISOString(),
      nodeTypeId: "angle",
      updatedAt: new Date().toISOString(),
    } as const;

    render(
      <MantineProvider theme={gssTheme}>
        {statuses.map((status, index) => (
          <NodeStateCard
            key={status}
            onOpen={vi.fn()}
            state={{
              ...common,
              classificationEvidence: null,
              faultFiltered: false,
              node: { id: `node-${status}`, installedLocation: null, number: String(200 + index) },
              nodeId: `node-${status}`,
              nodeType: {
                displayName: "Angle Node",
                id: "angle",
                imageAssetKey: "angle.png",
                key: "angle_node",
                numericCode: 1,
              },
              status,
              values: { angleX: 2.4, angleY: -1.1 },
            }}
          />
        ))}
      </MantineProvider>,
    );

    const cards = screen.getAllByRole("button");
    expect(cards).toHaveLength(statuses.length);
    expect(new Set(cards.map((card) => card.getAttribute("style"))).size).toBe(statuses.length);
    for (const card of cards) {
      expect(card.getAttribute("style")).toContain("background-color");
      expect(card.getAttribute("style")).toContain("box-shadow");
      expect(card.querySelector('[data-testid="node-card-status-line"]')).toBeTruthy();
    }
  });

  it("renders the permission-gated Admin summary and selector cascade", async () => {
    vi.mocked(apiRequest).mockImplementation(async (_session, path) => {
      if (path === "/admin/monitoring/options") {
        return {
          areas: [{ companyId: "company-1", id: "area-1", name: "Site A", status: "ACTIVE" }],
          buildings: [
            {
              areaId: "area-1",
              companyId: "company-1",
              id: "building-1",
              status: "ACTIVE",
              title: "Tower A",
            },
          ],
          companies: [{ id: "company-1", name: "Company A", status: "ACTIVE" }],
        };
      }
      if (path.startsWith("/admin/monitoring/summary")) {
        return {
          buildings: [],
          gateways: { offline: 0, online: 1, stale: 0, total: 1 },
          recentNodes: [],
          severityDistribution: {
            caution: 0,
            danger: 0,
            offline: 0,
            safe: 1,
            unconfigured: 0,
            warning: 0,
          },
        };
      }
      if (path === "/admin/monitoring/buildings/building-1") {
        return {
          building: { id: "building-1", title: "Tower A" },
          nodeTypes: [
            {
              count: 1,
              latestStatus: "safe",
              nodeType: {
                displayName: "Door Node",
                id: "door",
                imageAssetKey: "door.png",
                key: "door_node",
                numericCode: 0,
              },
            },
          ],
        };
      }
      if (path.includes("/node-types/door_node")) {
        return {
          building: { id: "building-1", title: "Tower A" },
          historyRetentionDays: 180,
          nodeType: {
            displayName: "Door Node",
            id: "door",
            imageAssetKey: "door.png",
            key: "door_node",
            numericCode: 0,
          },
          states: [
            {
              areaId: "area-1",
              building: { id: "building-1", title: "Tower A" },
              buildingId: "building-1",
              classificationEvidence: null,
              companyId: "company-1",
              faultFiltered: false,
              gateway: { id: "gateway-1", serialNumber: "GW-001" },
              gatewayId: "gateway-1",
              lastSeenAt: new Date().toISOString(),
              node: { id: "node-1", installedLocation: null, number: "100" },
              nodeId: "node-1",
              nodeType: {
                displayName: "Door Node",
                id: "door",
                imageAssetKey: "door.png",
                key: "door_node",
                numericCode: 0,
              },
              nodeTypeId: "door",
              status: "safe",
              updatedAt: new Date().toISOString(),
              values: { batteryLevel: 80, doorState: "closed" },
            },
          ],
        };
      }
      return {};
    });

    render(
      <MantineProvider theme={gssTheme}>
        <AdminMonitoringPage />
      </MantineProvider>,
    );
    expect(await screen.findByText("Admin monitoring")).toBeTruthy();
    expect(screen.getByText("Latest monitored nodes")).toBeTruthy();
    fireEvent.click(screen.getByRole("combobox", { name: "Company" }));
    fireEvent.click(screen.getAllByText("Company A")[0]!);
    fireEvent.click(screen.getByRole("combobox", { name: "Construction site" }));
    fireEvent.click(screen.getByText("Site A"));
    fireEvent.click(screen.getByRole("combobox", { name: "Building" }));
    fireEvent.click(screen.getAllByText("Tower A")[0]!);
    expect(await screen.findByText("Tower A")).toBeTruthy();
    expect(await screen.findByTestId("node-type-card-door_node")).toBeTruthy();
  });
});
