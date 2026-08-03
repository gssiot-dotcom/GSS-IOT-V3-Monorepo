import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminMonitoringSummaryRecord, MonitoringNodeStateRecord } from "@gss-iot/contracts";

import {
  BuildingMonitoringPage,
  CompanyMonitoringIndexPage,
  NodeTypeMonitoringPage,
  upsertState,
} from "../features/monitoring/CompanyMonitoringPage";
import {
  AdminMonitoringPage,
  applyAdminMonitoringState,
} from "../features/monitoring/AdminMonitoringPage";
import { NodeStateCard } from "../features/monitoring/components/NodeStateCard";
import { NodeHistoryChart } from "../features/monitoring/components/NodeHistoryChart";
import { NodeDetailDrawer } from "../features/monitoring/components/NodeDetailDrawer";
import { hourRange, localDayRange } from "../features/monitoring/components/useNodeHistoryRange";
import { apiRequest } from "../shared/api/api-client";

vi.mock("../shared/auth/auth-context", () => ({
  useAuth: () => ({
    session: {
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

function tomorrowCalendarLabel() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(tomorrow);
}

describe("Phase 6 monitoring UI", () => {
  it("orders realtime states by heartbeat and keeps old values through offline recovery", () => {
    const safe = monitoringState({
      lastSeenAt: "2026-07-22T11:55:00.000Z",
      status: "safe",
      updatedAt: "2026-07-22T11:55:00.000Z",
    });
    const offline = monitoringState({
      lastSeenAt: safe.lastSeenAt,
      status: "offline",
      updatedAt: "2026-07-22T12:00:00.000Z",
    });
    const offlineStates = upsertState([safe], offline);
    expect(offlineStates[0]).toMatchObject({ status: "offline", values: safe.values });

    const recovered = monitoringState({
      lastSeenAt: "2026-07-22T12:00:01.000Z",
      status: "warning",
      updatedAt: "2026-07-22T12:00:01.000Z",
    });
    const recoveredStates = upsertState(offlineStates, recovered);
    expect(recoveredStates[0]?.status).toBe("warning");

    const delayedOffline = { ...offline, updatedAt: "2026-07-22T12:00:02.000Z" };
    expect(upsertState(recoveredStates, delayedOffline)).toBe(recoveredStates);
  });

  it("updates Admin severity and building counts for an offline realtime transition", () => {
    const safe = monitoringState({ status: "safe" });
    const offline = monitoringState({
      lastSeenAt: safe.lastSeenAt,
      status: "offline",
      updatedAt: "2026-07-22T12:00:00.000Z",
    });
    const summary: AdminMonitoringSummaryRecord = {
      buildings: [
        {
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
          danger: 0,
          offline: 0,
          total: 1,
          warning: 0,
        },
      ],
      gateways: { offline: 0, online: 1, stale: 0, total: 1 },
      recentNodes: [safe],
      severityDistribution: {
        caution: 0,
        danger: 0,
        offline: 0,
        safe: 1,
        unconfigured: 0,
        warning: 0,
      },
    };

    const next = applyAdminMonitoringState(summary, safe, offline);
    expect(next.severityDistribution).toMatchObject({ offline: 1, safe: 0 });
    expect(next.buildings[0]).toMatchObject({ offline: 1, total: 1 });
    expect(next.recentNodes[0]?.status).toBe("offline");
  });

  it("builds exact rolling-hour and local-calendar half-open ranges", () => {
    const anchor = new Date("2026-07-22T12:00:00.000Z");
    expect(hourRange(12, anchor)).toEqual({
      from: "2026-07-22T00:00:00.000Z",
      to: "2026-07-22T12:00:00.000Z",
    });
    const localDay = localDayRange("2026-07-22");
    expect(localDay).toEqual({
      from: new Date(2026, 6, 22).toISOString(),
      to: new Date(2026, 6, 23).toISOString(),
    });
    expect(new Date(localDay.to).getTime()).toBeGreaterThan(new Date(localDay.from).getTime());
  });
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-22T12:00:00.000Z"));
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
      if (!path.startsWith("/company/buildings?")) throw new Error(`Unexpected request: ${path}`);
      const items = [
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
      return { items, page: 1, pageSize: 100, total: items.length };
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
      if (path.includes("/history/chart")) {
        return {
          from: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          items: [],
          returnedPointCount: 0,
          sampled: false,
          sampleLimit: 500,
          to: new Date().toISOString(),
          totalRawPointCount: 0,
        };
      }
      if (path.includes("/history")) {
        return { items: [], page: 1, pageSize: 50, total: 0 };
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
    await waitFor(() => {
      const tableCall = vi
        .mocked(apiRequest)
        .mock.calls.find(
          ([, path]) =>
            typeof path === "string" && path.includes("/history?") && !path.includes("/chart?"),
        );
      expect(tableCall).toBeTruthy();
      const query = new URL(tableCall![1] as string, "http://local").searchParams;
      expect(query.get("pageSize")).toBe("50");
      expect(new Date(query.get("to")!).getTime() - new Date(query.get("from")!).getTime()).toBe(
        12 * 60 * 60 * 1000,
      );
    });
    for (const hours of [1, 24]) {
      fireEvent.change(screen.getByLabelText("Hour range"), { target: { value: String(hours) } });
      await waitFor(() =>
        expect(
          vi.mocked(apiRequest).mock.calls.some(([, path]) => {
            if (typeof path !== "string" || !path.includes("/history?")) return false;
            const query = new URL(path, "http://local").searchParams;
            return (
              new Date(query.get("to")!).getTime() - new Date(query.get("from")!).getTime() ===
              hours * 60 * 60 * 1000
            );
          }),
        ).toBe(true),
      );
    }
    fireEvent.click(screen.getByText("Day"));
    const dateInput = await screen.findByLabelText("History date");
    expect(dateInput.getAttribute("type")).not.toBe("date");
    fireEvent.click(dateInput);
    expect(await screen.findByRole("button", { name: tomorrowCalendarLabel() })).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.click(screen.getByText("20", { selector: "button" }));
    expect(dateInput.textContent).toContain("2026-07-20");
    const selectedDay = localDayRange("2026-07-20");
    await waitFor(() =>
      expect(
        vi.mocked(apiRequest).mock.calls.some(([, path]) => {
          if (typeof path !== "string" || !path.includes("/history?")) return false;
          const query = new URL(path, "http://local").searchParams;
          return query.get("from") === selectedDay.from && query.get("to") === selectedDay.to;
        }),
      ).toBe(true),
    );
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
          chart={{
            from: "2026-07-21T13:02:03.000Z",
            items: [],
            returnedPointCount: 0,
            sampled: false,
            sampleLimit: 500,
            to: now,
            totalRawPointCount: 0,
          }}
          date="2026-07-22"
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
          hours={12}
          loadingHistory={false}
          maxDate="2026-07-22"
          mode="HOUR"
          onClose={vi.fn()}
          onDateChange={vi.fn()}
          onHoursChange={vi.fn()}
          onModeChange={vi.fn()}
          range={{ from: "2026-07-21T13:02:03.000Z", to: now }}
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
      if (path.includes("/nodes/node-1/history/chart?")) {
        const query = new URL(path, "http://local").searchParams;
        return {
          from: query.get("from"),
          items: [],
          returnedPointCount: 0,
          sampled: false,
          sampleLimit: 500,
          to: query.get("to"),
          totalRawPointCount: 0,
        };
      }
      if (path.includes("/nodes/node-1/history?")) {
        return { items: [], page: 1, pageSize: 50, total: 0 };
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
    fireEvent.click(await screen.findByTestId("node-type-card-door_node"));
    fireEvent.click(await screen.findByRole("radio", { name: "Cards" }));
    fireEvent.click(await screen.findByRole("button", { name: "Node 100, Safe" }));
    const drawer = await screen.findByRole("dialog", { name: "Node 100 detail" });
    fireEvent.click(within(drawer).getByText("Day"));
    const dateInput = await within(drawer).findByLabelText("History date");
    fireEvent.click(dateInput);
    expect(await screen.findByRole("button", { name: tomorrowCalendarLabel() })).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.click(screen.getByText("20", { selector: "button" }));
    expect(dateInput.textContent).toContain("2026-07-20");
    const selectedDay = localDayRange("2026-07-20");
    await waitFor(() => {
      const historyPaths = vi
        .mocked(apiRequest)
        .mock.calls.map(([, path]) => path)
        .filter(
          (path): path is string =>
            typeof path === "string" && path.includes("/nodes/node-1/history"),
        );
      expect(
        historyPaths.some((path) => {
          const query = new URL(path, "http://local").searchParams;
          return (
            path.includes("/chart?") &&
            query.get("from") === selectedDay.from &&
            query.get("to") === selectedDay.to
          );
        }),
      ).toBe(true);
      expect(
        historyPaths.some((path) => {
          const query = new URL(path, "http://local").searchParams;
          return (
            !path.includes("/chart?") &&
            query.get("from") === selectedDay.from &&
            query.get("to") === selectedDay.to
          );
        }),
      ).toBe(true);
    });
  });
});

function monitoringState(
  overrides: Partial<MonitoringNodeStateRecord> = {},
): MonitoringNodeStateRecord {
  return {
    areaId: "area-1",
    building: { id: "building-1", title: "Tower A" },
    buildingId: "building-1",
    classificationEvidence: null,
    companyId: "company-1",
    faultFiltered: false,
    gateway: { id: "gateway-1", serialNumber: "GW-001" },
    gatewayId: "gateway-1",
    lastSeenAt: "2026-07-22T11:59:00.000Z",
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
    status: "safe",
    updatedAt: "2026-07-22T11:59:00.000Z",
    values: { angleX: 2.4, angleY: -1.1 },
    ...overrides,
  };
}
