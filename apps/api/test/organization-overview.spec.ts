import { describe, expect, it, vi } from "vitest";

import { OrganizationsService } from "../src/modules/organizations/organizations.service";

const area = {
  address: null,
  companyId: "00000000-0000-0000-0000-000000000001",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  deletedAt: null,
  description: null,
  id: "00000000-0000-0000-0000-000000000010",
  name: "Site A",
  status: "ACTIVE" as const,
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function building(index: number) {
  return {
    address: null,
    areaId: area.id,
    buildingType: null,
    companyId: area.companyId,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
    id: `00000000-0000-0000-0001-${String(index).padStart(12, "0")}`,
    number: String(index),
    startDate: null,
    status: "ACTIVE" as const,
    title: `Building ${index}`,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function serviceWith(permissions: string[]) {
  const selectedBuilding = building(1);
  const prisma = {
    companyUser: {
      count: vi.fn().mockResolvedValue(123),
      findMany: vi.fn().mockResolvedValue([
        {
          areaAccess: [{ areaId: area.id }],
          buildingAccess: [{ buildingId: building(1).id }],
          email: "owner@example.com",
          id: "00000000-0000-0000-0002-000000000001",
          isActive: true,
          name: "Owner",
          role: {
            id: "00000000-0000-0000-0003-000000000001",
            isCompanyOwnerRole: true,
            name: "Owner",
          },
        },
      ]),
    },
    constructionBuilding: {
      count: vi.fn().mockResolvedValue(137),
      findMany: vi
        .fn()
        .mockResolvedValue(Array.from({ length: 100 }, (_, index) => building(index))),
    },
    constructionArea: {
      findUnique: vi.fn().mockResolvedValue(area),
    },
    gatewayBuildingAssignment: {
      count: vi.fn().mockResolvedValue(222),
      findMany: vi.fn().mockResolvedValue([
        {
          gateway: {
            id: "00000000-0000-0000-0004-000000000001",
            installedLocation: "Entrance",
            lastSeenAt: new Date(),
            serialNumber: "0300",
            status: "ACTIVE",
          },
        },
      ]),
    },
    latestNodeState: {
      count: vi.fn().mockResolvedValue(7),
    },
    nodeGatewayAssignment: {
      count: vi.fn().mockResolvedValue(333),
      findMany: vi.fn().mockResolvedValue([
        {
          gateway: { id: "00000000-0000-0000-0004-000000000001", serialNumber: "0300" },
          node: {
            id: "00000000-0000-0000-0005-000000000001",
            installedLocation: "Door",
            lastSeenAt: new Date("2026-01-01T01:00:00.000Z"),
            latestState: { status: "SAFE" },
            nodeType: {
              displayName: "Door Node",
              id: "00000000-0000-0000-0006-000000000001",
              key: "door_node",
            },
            number: "100",
            status: "ACTIVE",
          },
        },
      ]),
    },
  };
  const resolver = {
    resolve: vi.fn().mockResolvedValue({
      isSuperAdmin: false,
      permissions: new Set(permissions),
    }),
  };
  const service = new OrganizationsService(prisma as never, {} as never, resolver as never);
  vi.spyOn(service, "assertCompanyArea").mockResolvedValue(area);
  vi.spyOn(service, "assertCompanyBuilding").mockResolvedValue(selectedBuilding);
  return { prisma, service };
}

describe("company organization overviews", () => {
  it("uses backend totals beyond the bounded preview and deduplicates user access sources", async () => {
    const { service } = serviceWith([
      "areas.view",
      "buildings.view",
      "company-devices.view",
      "company-users.view",
    ]);

    const result = await service.getCompanyAreaOverview(
      area.id,
      "00000000-0000-0000-0002-000000000001",
    );

    expect(result.buildings.items).toHaveLength(100);
    expect(result.buildings.total).toBe(137);
    expect(result.metrics).toEqual({
      assignedUsers: 123,
      buildings: 137,
      gateways: 222,
      nodes: 333,
    });
    expect(result.users.items).toEqual([
      expect.objectContaining({
        accessSources: ["COMPANY", "AREA", "BUILDING"],
        id: "00000000-0000-0000-0002-000000000001",
      }),
    ]);
  });

  it("omits optional sections and their aggregates when permissions are absent", async () => {
    const { prisma, service } = serviceWith(["areas.view"]);

    const result = await service.getCompanyAreaOverview(
      area.id,
      "00000000-0000-0000-0002-000000000001",
    );

    expect(result.buildings).toEqual({ available: false, items: [], total: null });
    expect(result.users).toEqual({ available: false, items: [], total: null });
    expect(result.metrics).toEqual({
      assignedUsers: null,
      buildings: null,
      gateways: null,
      nodes: null,
    });
    expect(prisma.constructionBuilding.findMany).not.toHaveBeenCalled();
    expect(prisma.companyUser.findMany).not.toHaveBeenCalled();
    expect(prisma.gatewayBuildingAssignment.count).not.toHaveBeenCalled();
    expect(prisma.nodeGatewayAssignment.count).not.toHaveBeenCalled();

    const buildingResult = await service.getCompanyBuildingOverview(
      building(1).id,
      "00000000-0000-0000-0002-000000000001",
    );
    expect(buildingResult.devices).toEqual({ available: false, items: [], total: null });
    expect(buildingResult.nodes).toEqual({ available: false, items: [], total: null });
  });

  it("returns independent bounded gateway, node and user sections for a building", async () => {
    const { service } = serviceWith([
      "areas.view",
      "buildings.view",
      "company-devices.view",
      "company-users.view",
    ]);

    const result = await service.getCompanyBuildingOverview(
      building(1).id,
      "00000000-0000-0000-0002-000000000001",
    );

    expect(result.devices).toMatchObject({ available: true, total: 222 });
    expect(result.devices.items[0]).toMatchObject({ nodeCount: 333, serialNumber: "0300" });
    expect(result.nodes).toMatchObject({ available: true, total: 333 });
    expect(result.nodes.items[0]).toMatchObject({
      gateway: { serialNumber: "0300" },
      latestStatus: "safe",
      number: "100",
    });
    expect(result.users.items[0]?.accessSources).toEqual(["COMPANY", "AREA", "BUILDING"]);
  });
});
