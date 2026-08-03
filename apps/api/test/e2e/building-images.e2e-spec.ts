import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { loadApiEnv } from "@gss-iot/config";
import { PermissionScopeType } from "@prisma/client";
import { hash } from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../../src/app.module";
import { configureApiApp } from "../../src/bootstrap";
import { PrivateAssetStorageService } from "../../src/modules/private-assets/private-asset-storage.service";
import { PrismaService } from "../../src/prisma/prisma.service";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

describe("private building images e2e", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: PrivateAssetStorageService;
  let buildingId: string;
  let foreignBuildingId: string;
  let adminToken: string;
  let companyToken: string;
  let noPermissionToken: string;

  beforeAll(async () => {
    process.env.ASSET_STORAGE_PROVIDER = "memory";
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app, loadApiEnv());
    await app.init();
    prisma = app.get(PrismaService);
    storage = app.get(PrivateAssetStorageService);
    await clearDatabase(prisma);

    const permissions = await Promise.all(
      ["building-plans.view", "building-plans.manage", "buildings.delete"].map((key) => {
        const [module, action] = key.split(".") as [string, string];
        return prisma.permission.create({
          data: { action, key, module, scopeType: PermissionScopeType.BOTH },
        });
      }),
    );
    const passwordHash = await hash("test-password", 12);
    const adminRole = await prisma.gssRole.create({
      data: { isSuperAdmin: true, key: "building-image-admin", name: "Building Image Admin" },
    });
    await prisma.gssAdminUser.create({
      data: {
        email: "building-admin@example.com",
        name: "Admin",
        passwordHash,
        roleId: adminRole.id,
      },
    });
    const [company, foreignCompany] = await Promise.all([
      prisma.company.create({ data: { name: "Image Company" } }),
      prisma.company.create({ data: { name: "Foreign Image Company" } }),
    ]);
    const [ownerRole, noPermissionRole, foreignOwnerRole] = await Promise.all([
      prisma.companyRole.create({
        data: {
          companyId: company.id,
          isCompanyOwnerRole: true,
          key: "image-owner",
          name: "Image Owner",
          permissions: {
            createMany: { data: permissions.slice(0, 2).map(({ id }) => ({ permissionId: id })) },
          },
        },
      }),
      prisma.companyRole.create({
        data: { companyId: company.id, key: "image-none", name: "Image None" },
      }),
      prisma.companyRole.create({
        data: {
          companyId: foreignCompany.id,
          isCompanyOwnerRole: true,
          key: "foreign-image-owner",
          name: "Foreign Image Owner",
          permissions: {
            createMany: { data: permissions.slice(0, 2).map(({ id }) => ({ permissionId: id })) },
          },
        },
      }),
    ]);
    await Promise.all([
      prisma.companyUser.create({
        data: {
          companyId: company.id,
          email: "building-owner@example.com",
          name: "Owner",
          passwordHash,
          roleId: ownerRole.id,
        },
      }),
      prisma.companyUser.create({
        data: {
          companyId: company.id,
          email: "building-none@example.com",
          name: "No permission",
          passwordHash,
          roleId: noPermissionRole.id,
        },
      }),
      prisma.companyUser.create({
        data: {
          companyId: foreignCompany.id,
          email: "foreign-building-owner@example.com",
          name: "Foreign owner",
          passwordHash,
          roleId: foreignOwnerRole.id,
        },
      }),
    ]);
    const [area, foreignArea] = await Promise.all([
      prisma.constructionArea.create({ data: { companyId: company.id, name: "Main Site" } }),
      prisma.constructionArea.create({
        data: { companyId: foreignCompany.id, name: "Foreign Site" },
      }),
    ]);
    const [building, foreignBuilding] = await Promise.all([
      prisma.constructionBuilding.create({
        data: { areaId: area.id, companyId: company.id, title: "Tower A" },
      }),
      prisma.constructionBuilding.create({
        data: {
          areaId: foreignArea.id,
          companyId: foreignCompany.id,
          title: "Foreign Tower",
        },
      }),
    ]);
    buildingId = building.id;
    foreignBuildingId = foreignBuilding.id;
    adminToken = await login("/auth/gss/login", "building-admin@example.com");
    companyToken = await login("/auth/company/login", "building-owner@example.com");
    noPermissionToken = await login("/auth/company/login", "building-none@example.com");
  });

  afterAll(async () => app?.close());

  it("has the migrated lifecycle and private-image columns before serving endpoints", async () => {
    const columns = await prisma.$queryRaw<Array<{ column_name: string; table_name: string }>>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND (
          (table_name IN ('AlarmEvent', 'AlarmNotification') AND column_name = 'deletedAt')
          OR (table_name = 'BuildingPlanImage' AND column_name IN ('contentType', 'byteSize', 'deletionState'))
        )
    `;
    expect(columns.map((column) => `${column.table_name}.${column.column_name}`).sort()).toEqual([
      "AlarmEvent.deletedAt",
      "AlarmNotification.deletedAt",
      "BuildingPlanImage.byteSize",
      "BuildingPlanImage.contentType",
      "BuildingPlanImage.deletionState",
    ]);
  });

  it("uploads, privately streams, lists and idempotently deletes in both auth contexts", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const uploaded = await request(server)
      .post(`/admin/buildings/${buildingId}/images`)
      .set("Cookie", adminToken)
      .set("x-csrf-token", "test-csrf-token")
      .field("kind", "PLAN")
      .attach("image", png, { contentType: "image/png", filename: "plan.png" })
      .expect(201);
    expect(uploaded.body).toMatchObject({
      byteSize: png.length,
      contentType: "image/png",
      kind: "PLAN",
    });
    expect(uploaded.body.storageKey).toBeUndefined();
    const stored = await prisma.buildingPlanImage.findUniqueOrThrow({
      where: { id: uploaded.body.id },
    });
    await expect(storage.get(stored.storageKey)).resolves.toMatchObject({ body: png });

    const listed = await request(server)
      .get(`/company/buildings/${buildingId}/images`)
      .set("Cookie", companyToken)
      .set("x-csrf-token", "test-csrf-token")
      .expect(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].contentPath).toBe(`/company/building-images/${uploaded.body.id}/content`);
    const content = await request(server)
      .get(listed.body[0].contentPath)
      .set("Cookie", companyToken)
      .set("x-csrf-token", "test-csrf-token")
      .expect(200)
      .expect("Content-Type", /image\/png/);
    expect(content.body).toEqual(png);

    await request(server)
      .get(`/company/buildings/${buildingId}/images`)
      .set("Cookie", noPermissionToken)
      .set("x-csrf-token", "test-csrf-token")
      .expect(403);
    await request(server)
      .delete(`/company/building-images/${uploaded.body.id}`)
      .set("Cookie", companyToken)
      .set("x-csrf-token", "test-csrf-token")
      .expect(200);
    await request(server)
      .delete(`/company/building-images/${uploaded.body.id}`)
      .set("Cookie", companyToken)
      .set("x-csrf-token", "test-csrf-token")
      .expect(200);
    await expect(storage.get(stored.storageKey)).resolves.toBeUndefined();
    expect(
      await prisma.auditLog.count({
        where: { action: { in: ["building-image.upload", "building-image.delete-completed"] } },
      }),
    ).toBe(2);
  });

  it("rejects disguised, oversized, over-limit and cross-company access", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server)
      .post(`/company/buildings/${buildingId}/images`)
      .set("Cookie", companyToken)
      .set("x-csrf-token", "test-csrf-token")
      .field("kind", "REAL")
      .attach("image", png, { contentType: "image/jpeg", filename: "fake.jpg" })
      .expect(400);
    await request(server)
      .post(`/company/buildings/${buildingId}/images`)
      .set("Cookie", companyToken)
      .set("x-csrf-token", "test-csrf-token")
      .field("kind", "REAL")
      .attach("image", Buffer.alloc(8 * 1024 * 1024 + 1), {
        contentType: "image/png",
        filename: "large.png",
      })
      .expect(413);

    for (let index = 0; index < 4; index += 1) {
      await request(server)
        .post(`/admin/buildings/${buildingId}/images`)
        .set("Cookie", adminToken)
        .set("x-csrf-token", "test-csrf-token")
        .field("kind", "PLAN")
        .attach("image", png, { contentType: "image/png", filename: `plan-${index}.png` })
        .expect(201);
    }
    await request(server)
      .post(`/admin/buildings/${buildingId}/images`)
      .set("Cookie", adminToken)
      .set("x-csrf-token", "test-csrf-token")
      .field("kind", "PLAN")
      .attach("image", png, { contentType: "image/png", filename: "plan-5.png" })
      .expect(409);
    await request(server)
      .delete(`/admin/buildings/${buildingId}`)
      .set("Cookie", adminToken)
      .set("x-csrf-token", "test-csrf-token")
      .send({ reason: "Building image archive regression" })
      .expect(200);
    expect(await prisma.buildingPlanImage.count({ where: { buildingId } })).toBe(4);
    expect(
      await prisma.constructionBuilding.findUniqueOrThrow({
        select: { deletedAt: true },
        where: { id: buildingId },
      }),
    ).toMatchObject({ deletedAt: expect.any(Date) });

    const foreignImage = await request(server)
      .post(`/admin/buildings/${foreignBuildingId}/images`)
      .set("Cookie", adminToken)
      .set("x-csrf-token", "test-csrf-token")
      .field("kind", "REAL")
      .attach("image", png, { contentType: "image/png", filename: "foreign.png" })
      .expect(201);
    await request(server)
      .get(`/company/building-images/${foreignImage.body.id}/content`)
      .set("Cookie", companyToken)
      .set("x-csrf-token", "test-csrf-token")
      .expect(403);
  });

  async function login(path: string, email: string): Promise<string> {
    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post(path)
      .set("Cookie", "gss_csrf=test-csrf-token")
      .set("x-csrf-token", "test-csrf-token")
      .send({ email, password: "test-password" })
      .expect(201);
    const setCookies = response.headers["set-cookie"];
    const cookieValues = Array.isArray(setCookies) ? setCookies : setCookies ? [setCookies] : [];
    return ["gss_csrf=test-csrf-token", ...cookieValues.map((cookie) => cookie.split(";")[0])].join(
      "; ",
    );
  }
});

async function clearDatabase(prisma: PrismaService): Promise<void> {
  await prisma.reportExport.deleteMany();
  await prisma.reportJob.deleteMany();
  await prisma.alarmDeliveryLog.deleteMany();
  await prisma.alarmNotification.deleteMany();
  await prisma.alarmPolicyTrigger.deleteMany();
  await prisma.alarmCounterState.deleteMany();
  await prisma.alarmEvent.deleteMany();
  await prisma.alarmRecipientPolicy.deleteMany();
  await prisma.alarmRule.deleteMany();
  await prisma.latestNodeState.deleteMany();
  await prisma.sensorReading.deleteMany();
  await prisma.gatewayFaultFilterAppliedState.deleteMany();
  await prisma.gatewayFaultFilterDesiredState.deleteMany();
  await prisma.gatewayAlarmLevelApplication.deleteMany();
  await prisma.buildingAlarmLevelConfigurationHistory.deleteMany();
  await prisma.buildingAlarmLevelConfiguration.deleteMany();
  await prisma.nodeGatewayProvisioningItem.deleteMany();
  await prisma.nodeGatewayProvisioningRequest.deleteMany();
  await prisma.gatewayCommand.deleteMany();
  await prisma.nodeGatewayAssignment.deleteMany();
  await prisma.gatewayBuildingAssignment.deleteMany();
  await prisma.companyDeviceAssignment.deleteMany();
  await prisma.node.deleteMany();
  await prisma.gateway.deleteMany();
  await prisma.nodeType.deleteMany();
  await prisma.buildingPlanImage.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.companyUserBuildingAccess.deleteMany();
  await prisma.companyUserAreaAccess.deleteMany();
  await prisma.companyUserPermission.deleteMany();
  await prisma.companyRolePermission.deleteMany();
  await prisma.companyUserPositionAssignment.deleteMany();
  await prisma.companyPosition.deleteMany();
  await prisma.companyUser.deleteMany();
  await prisma.companyRole.deleteMany();
  await prisma.constructionBuilding.deleteMany();
  await prisma.constructionArea.deleteMany();
  await prisma.company.deleteMany();
  await prisma.gssAdminUserPermission.deleteMany();
  await prisma.gssRolePermission.deleteMany();
  await prisma.gssAdminUser.deleteMany();
  await prisma.gssRole.deleteMany();
  await prisma.permission.deleteMany();
}
