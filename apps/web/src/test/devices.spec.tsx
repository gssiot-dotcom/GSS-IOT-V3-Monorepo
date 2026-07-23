import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
        isActive: true,
        isSuperAdmin: false,
        name: "Admin",
        permissions: ((globalThis as Record<string, unknown>).__deviceTestPermissions as
          string[] | undefined) ?? [
          "devices.assign",
          "devices.view",
          "gateways.assign",
          "gateways.create",
          "gateways.delete",
          "gateways.update",
          "gateways.view",
          "mqtt-commands.manage",
          "mqtt-commands.view",
          "nodes.assign",
          "nodes.create",
          "nodes.delete",
          "nodes.update",
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
  let deletionAllowed = false;
  let deleteError = "";
  let bulkOptions: RequestInit | undefined;
  let provisioningOptions: RequestInit | undefined;

  afterEach(() => {
    cleanup();
    delete (globalThis as Record<string, unknown>).__deviceTestPermissions;
  });

  beforeEach(() => {
    deletionAllowed = false;
    deleteError = "";
    bulkOptions = undefined;
    provisioningOptions = undefined;
    vi.mocked(apiRequest).mockImplementation((_session, path, options) => {
      if (path === "/admin/devices/nodes/bulk") {
        bulkOptions = options;
      }
      if (path === "/admin/gateway-commands/register-nodes") {
        provisioningOptions = options;
        return Promise.resolve(undefined);
      }
      if (path.startsWith("/admin/devices/gateways/") || path.startsWith("/admin/devices/nodes/")) {
        if (deleteError) return Promise.reject(new Error(deleteError));
        return Promise.resolve(undefined);
      }
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
            deletion: {
              allowed: deletionAllowed,
              blocker: deletionAllowed ? null : "companyAssignmentHistory",
            },
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
            deletion: {
              allowed: deletionAllowed,
              blocker: deletionAllowed ? null : "companyAssignmentHistory",
            },
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

  it("selects APPEND mode and sends the explicit provisioning mode", async () => {
    render(
      <MantineProvider theme={gssTheme}>
        <AdminDevicesPage />
      </MantineProvider>,
    );

    expect(await screen.findByText("Assignment mode")).toBeTruthy();
    fireEvent.click(screen.getByRole("combobox", { name: "Company" }));
    fireEvent.click(screen.getAllByText("Company A")[0]!);
    fireEvent.click(screen.getByRole("combobox", { name: "Building" }));
    fireEvent.click(screen.getAllByText("Building A")[0]!);
    fireEvent.click(screen.getByRole("combobox", { name: "Gateway" }));
    fireEvent.click(screen.getAllByText("GW-001")[0]!);
    fireEvent.click(screen.getByRole("combobox", { name: "Assignment mode" }));
    fireEvent.click(await screen.findByText("APPEND — keep current nodes"));
    fireEvent.click(screen.getByRole("combobox", { name: "Eligible nodes" }));
    fireEvent.click(await screen.findByText("NODE-001 (Door Node)"));
    expect(screen.getByText("Current: 0")).toBeTruthy();
    expect(screen.getByText("Final: 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Provision nodes" }));

    await waitFor(() => expect(provisioningOptions).toBeDefined());
    expect(JSON.parse(String(provisioningOptions?.body))).toMatchObject({ mode: "APPEND" });
  });

  it("renders compact edit/delete actions with server-derived history blockers", async () => {
    render(
      <MantineProvider theme={gssTheme}>
        <AdminDevicesPage />
      </MantineProvider>,
    );

    expect(await screen.findByRole("button", { name: "Edit gateway" })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Delete gateway" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("tab", { name: "Nodes" }));
    expect(screen.getByRole("button", { name: "Edit node" })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Delete node" }) as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole("tab", { name: "Gateways" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit gateway" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Edit gateway" })).toBeTruthy());
    expect(screen.getByDisplayValue("GW-001")).toBeTruthy();
  });

  it("shows localized success and conflict feedback for delete mutations", async () => {
    deletionAllowed = true;
    render(
      <MantineProvider theme={gssTheme}>
        <AdminDevicesPage />
      </MantineProvider>,
    );

    const deleteButton = await screen.findByRole("button", { name: "Delete gateway" });
    fireEvent.click(deleteButton);
    fireEvent.click(await screen.findByRole("button", { name: "Delete permanently" }));
    await waitFor(() => expect(screen.getByText("Device deleted.")).toBeTruthy());

    deleteError = "This gateway has business history and cannot be hard-deleted.";
    fireEvent.click(screen.getByRole("button", { name: "Delete gateway" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete permanently" }));
    await waitFor(() => expect(screen.getByText(deleteError)).toBeTruthy());
  });

  it("previews canonical bulk node input and submits one atomic request", async () => {
    render(
      <MantineProvider theme={gssTheme}>
        <AdminDevicesPage />
      </MantineProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Create node" }));
    expect(await screen.findByRole("heading", { name: "Create node" })).toBeTruthy();
    fireEvent.change(await screen.findByRole("textbox", { name: "Node number" }), {
      target: { value: "100-102, 102" },
    });
    expect(await screen.findByText("3 nodes will be created")).toBeTruthy();
    expect(screen.getByText("100")).toBeTruthy();
    expect(screen.getByText("102")).toBeTruthy();

    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Create node" }),
    );
    await waitFor(() => {
      expect(bulkOptions?.method).toBe("POST");
      expect(JSON.parse(String(bulkOptions?.body))).toEqual({
        input: "100-102, 102",
        installedLocation: "",
        nodeTypeId: "node-type-1",
      });
    });
    expect(await screen.findByText("Device created.")).toBeTruthy();
  });

  it("hides bulk node creation when nodes.create is not granted", async () => {
    (globalThis as Record<string, unknown>).__deviceTestPermissions = [
      "devices.view",
      "gateways.view",
      "nodes.view",
      "mqtt-commands.view",
    ];
    render(
      <MantineProvider theme={gssTheme}>
        <AdminDevicesPage />
      </MantineProvider>,
    );

    await screen.findByText("Device inventory");
    expect(screen.queryByRole("button", { name: "Create node" })).toBeNull();
  });
});
