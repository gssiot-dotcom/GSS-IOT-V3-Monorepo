import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BuildingMonitoringPage } from "../features/monitoring/CompanyMonitoringPage";
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
        permissions: ["monitoring.view", "monitoring.realtime"],
      },
    },
  }),
}));

vi.mock("../shared/api/api-client", () => ({
  apiRequest: vi.fn(),
}));

describe("Phase 6 monitoring UI", () => {
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
});
