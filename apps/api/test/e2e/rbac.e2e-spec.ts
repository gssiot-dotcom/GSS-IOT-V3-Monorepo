import { Controller, Get } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { loadApiEnv } from "@gss-iot/config";
import { hash } from "bcrypt";
import { PermissionScopeType } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AdminEndpoint } from "../../src/common/decorators/admin-endpoint.decorator";
import { CompanyEndpoint } from "../../src/common/decorators/company-endpoint.decorator";
import { RequirePermissions } from "../../src/common/decorators/require-permissions.decorator";
import { RequireBuildingScope } from "../../src/common/decorators/require-scope.decorator";
import { AppModule } from "../../src/app.module";
import { configureApiApp } from "../../src/bootstrap";
import { AuthModule } from "../../src/modules/auth/auth.module";
import { DEFAULT_COMPANY_ROLE_KEYS } from "../../src/modules/company-management/default-company-roles";
import { PrismaService } from "../../src/prisma/prisma.service";

@Controller("rbac-probe")
class RbacProbeController {
  @AdminEndpoint()
  @RequirePermissions("dashboard.view")
  @Get("admin")
  getAdminProbe() {
    return { ok: true };
  }

  @CompanyEndpoint()
  @RequirePermissions("monitoring.view")
  @RequireBuildingScope("buildingId")
  @Get("buildings/:buildingId")
  getBuildingProbe() {
    return { ok: true };
  }
}

describe("RBAC e2e", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sameCompanyOtherBuildingId: string;
  let otherCompanyBuildingId: string;
  let companySettingsViewPermissionId: string;
  const localhostOrigin = "http://localhost:5173";
  const loopbackOrigin = "http://127.0.0.1:5173";

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, AuthModule],
      controllers: [RbacProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApiApp(app, {
      ...loadApiEnv(),
      CORS_ALLOWED_ORIGINS: [localhostOrigin, loopbackOrigin],
    });
    await app.init();
    prisma = app.get(PrismaService);

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
    await prisma.companyUserBuildingAccess.deleteMany();
    await prisma.companyUserAreaAccess.deleteMany();
    await prisma.companyUserPermission.deleteMany();
    await prisma.companyRolePermission.deleteMany();
    await prisma.companyUser.deleteMany();
    await prisma.companyRole.deleteMany();
    await prisma.buildingPlanImage.deleteMany();
    await prisma.constructionBuilding.deleteMany();
    await prisma.constructionArea.deleteMany();
    await prisma.company.deleteMany();
    await prisma.gssAdminUserPermission.deleteMany();
    await prisma.gssRolePermission.deleteMany();
    await prisma.gssAdminUser.deleteMany();
    await prisma.gssRole.deleteMany();
    await prisma.permission.deleteMany();

    const [
      dashboardPermission,
      monitoringPermission,
      companySettingsViewPermission,
      companySettingsManagePermission,
    ] = await Promise.all([
      prisma.permission.create({
        data: { action: "view", key: "dashboard.view", module: "dashboard", scopeType: "BOTH" },
      }),
      prisma.permission.create({
        data: { action: "view", key: "monitoring.view", module: "monitoring", scopeType: "BOTH" },
      }),
      prisma.permission.create({
        data: {
          action: "view",
          key: "settings.company.view",
          module: "settings",
          scopeType: "COMPANY",
        },
      }),
      prisma.permission.create({
        data: {
          action: "manage",
          key: "settings.company.manage",
          module: "settings",
          scopeType: "COMPANY",
        },
      }),
    ]);
    companySettingsViewPermissionId = companySettingsViewPermission.id;
    const [
      gssSuperRole,
      gssNoPermissionRole,
      scopedCompanyRole,
      settingsCompanyRole,
      noPermissionCompanyRole,
    ] = await Promise.all([
      prisma.gssRole.create({ data: { isSuperAdmin: true, key: "super", name: "Super" } }),
      prisma.gssRole.create({ data: { key: "none", name: "None" } }),
      prisma.companyRole.create({
        data: {
          isCompanyOwnerRole: false,
          key: "scoped",
          name: "Scoped",
          permissions: {
            create: [
              { permissionId: dashboardPermission.id },
              { permissionId: monitoringPermission.id },
              { permissionId: companySettingsViewPermission.id },
            ],
          },
        },
      }),
      prisma.companyRole.create({
        data: {
          key: "company-settings-manager",
          name: "Company Settings Manager",
          permissions: {
            create: [
              { permissionId: companySettingsViewPermission.id },
              { permissionId: companySettingsManagePermission.id },
            ],
          },
        },
      }),
      prisma.companyRole.create({ data: { key: "company-none", name: "Company None" } }),
    ]);
    const passwordHash = await hash("test-password", 12);
    await prisma.gssAdminUser.create({
      data: { email: "super@example.com", name: "Super", passwordHash, roleId: gssSuperRole.id },
    });
    await prisma.gssAdminUser.create({
      data: {
        email: "gss-none@example.com",
        name: "No Permission",
        passwordHash,
        roleId: gssNoPermissionRole.id,
      },
    });
    const [companyA, companyB] = await Promise.all([
      prisma.company.create({ data: { name: "Company A" } }),
      prisma.company.create({ data: { name: "Company B" } }),
    ]);
    const [areaA, areaB] = await Promise.all([
      prisma.constructionArea.create({ data: { companyId: companyA.id, name: "Area A" } }),
      prisma.constructionArea.create({ data: { companyId: companyB.id, name: "Area B" } }),
    ]);
    const [allowedBuilding, otherBuilding, otherCompanyBuilding] = await Promise.all([
      prisma.constructionBuilding.create({
        data: { areaId: areaA.id, companyId: companyA.id, title: "Allowed" },
      }),
      prisma.constructionBuilding.create({
        data: { areaId: areaA.id, companyId: companyA.id, title: "Other" },
      }),
      prisma.constructionBuilding.create({
        data: { areaId: areaB.id, companyId: companyB.id, title: "Foreign" },
      }),
    ]);
    sameCompanyOtherBuildingId = otherBuilding.id;
    otherCompanyBuildingId = otherCompanyBuilding.id;

    const scopedUser = await prisma.companyUser.create({
      data: {
        companyId: companyA.id,
        email: "scoped@example.com",
        name: "Scoped User",
        passwordHash,
        roleId: scopedCompanyRole.id,
      },
    });
    await prisma.companyUserBuildingAccess.create({
      data: { buildingId: allowedBuilding.id, companyUserId: scopedUser.id },
    });
    await prisma.companyUser.create({
      data: {
        companyId: companyA.id,
        email: "settings-manager@example.com",
        name: "Settings Manager",
        passwordHash,
        roleId: settingsCompanyRole.id,
      },
    });
    await prisma.companyUser.create({
      data: {
        companyId: companyA.id,
        email: "company-none@example.com",
        name: "Company No Permission",
        passwordHash,
        roleId: noPermissionCompanyRole.id,
      },
    });
    await prisma.companyUser.create({
      data: {
        companyId: companyA.id,
        email: "inactive@example.com",
        isActive: false,
        name: "Inactive",
        passwordHash,
        roleId: noPermissionCompanyRole.id,
      },
    });

    expect(dashboardPermission.key).toBe("dashboard.view");
  });

  afterAll(async () => {
    await app?.close();
  });

  async function login(path: string, email: string): Promise<string> {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server)
      .post(path)
      .send({ email, password: "test-password" })
      .expect(201);
    return response.body.accessToken as string;
  }

  it("allows local Vite origins during auth preflight", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    for (const origin of [localhostOrigin, loopbackOrigin]) {
      await request(server)
        .options("/auth/gss/login")
        .set("Origin", origin)
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "content-type")
        .expect(204)
        .expect("Access-Control-Allow-Origin", origin);
    }
  });

  it("does not allow unknown browser origins during auth preflight", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    const response = await request(server)
      .options("/auth/gss/login")
      .set("Origin", "http://evil.example")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type")
      .expect(404);

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("adds CORS headers to GSS login and current-user requests without cookies", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    const loginResponse = await request(server)
      .post("/auth/gss/login")
      .set("Origin", loopbackOrigin)
      .send({ email: "super@example.com", password: "test-password" })
      .expect(201)
      .expect("Access-Control-Allow-Origin", loopbackOrigin);

    expect(loginResponse.headers["set-cookie"]).toBeUndefined();
    expect(loginResponse.body.context).toBe("gss-admin");
    expect(loginResponse.body.user).toMatchObject({
      email: "super@example.com",
      isActive: true,
      role: { key: "super", name: "Super", isSuperAdmin: true },
    });
    expect(loginResponse.body.user.passwordHash).toBeUndefined();
    expect(loginResponse.body.user.tokenVersion).toBeUndefined();

    await request(server)
      .get("/auth/gss/me")
      .set("Origin", loopbackOrigin)
      .set("Authorization", `Bearer ${loginResponse.body.accessToken as string}`)
      .expect(200)
      .expect("Access-Control-Allow-Origin", loopbackOrigin);
  });

  it("adds CORS headers to company login and current-user requests", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    const loginResponse = await request(server)
      .post("/auth/company/login")
      .set("Origin", loopbackOrigin)
      .send({ email: "scoped@example.com", password: "test-password" })
      .expect(201)
      .expect("Access-Control-Allow-Origin", loopbackOrigin);

    expect(loginResponse.body.context).toBe("company-user");
    expect(loginResponse.body.user).toMatchObject({
      company: { id: expect.any(String), name: expect.any(String) },
      email: "scoped@example.com",
      isActive: true,
      role: { key: expect.any(String), name: expect.any(String), isSuperAdmin: false },
    });
    expect(loginResponse.body.user.passwordHash).toBeUndefined();
    expect(loginResponse.body.user.tokenVersion).toBeUndefined();

    await request(server)
      .get("/auth/company/me")
      .set("Origin", loopbackOrigin)
      .set("Authorization", `Bearer ${loginResponse.body.accessToken as string}`)
      .expect(200)
      .expect("Access-Control-Allow-Origin", loopbackOrigin);
  });

  it("returns bounded permission-aware dashboard summaries", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const adminToken = await login("/auth/gss/login", "super@example.com");
    const adminSummary = await request(server)
      .get("/admin/dashboard/summary?range=30d")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(adminSummary.body.range.key).toBe("30d");
    expect(adminSummary.body.kpis.activeCompanies).toBeGreaterThan(0);
    expect(adminSummary.body.gateways).toBeDefined();

    await request(server)
      .get("/admin/dashboard/summary?range=365d")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);

    const companyToken = await login("/auth/company/login", "scoped@example.com");
    const companySummary = await request(server)
      .get("/company/dashboard/summary?range=7d")
      .set("Authorization", `Bearer ${companyToken}`)
      .expect(200);
    expect(companySummary.body.kpis.activeBuildings).toBe(1);

    const noPermissionToken = await login("/auth/company/login", "company-none@example.com");
    await request(server)
      .get("/company/dashboard/summary")
      .set("Authorization", `Bearer ${noPermissionToken}`)
      .expect(403);
  });

  it("serves context-scoped read-only permission catalogs with explicit denial paths", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const [adminCatalogPermission, companyCatalogPermission] = await Promise.all([
      prisma.permission.upsert({
        where: { key: "permissions.view" },
        create: {
          action: "view",
          description: "View the GSS permission catalog across the authorized GSS Admin context.",
          key: "permissions.view",
          module: "permissions",
          scopeType: PermissionScopeType.GSS,
        },
        update: {
          description: "View the GSS permission catalog across the authorized GSS Admin context.",
          scopeType: PermissionScopeType.GSS,
        },
      }),
      prisma.permission.upsert({
        where: { key: "company-permissions.view" },
        create: {
          action: "view",
          description:
            "View the company permission catalog within the authenticated company scope.",
          key: "company-permissions.view",
          module: "company-permissions",
          scopeType: PermissionScopeType.BOTH,
        },
        update: {
          description:
            "View the company permission catalog within the authenticated company scope.",
          scopeType: PermissionScopeType.BOTH,
        },
      }),
    ]);
    await prisma.permission.upsert({
      where: { key: "catalog-company-only.view" },
      create: {
        action: "view",
        description: "View a company-only catalog fixture within the authenticated company scope.",
        key: "catalog-company-only.view",
        module: "catalog-company-only",
        scopeType: PermissionScopeType.COMPANY,
      },
      update: { description: "View a company-only catalog fixture.", scopeType: "COMPANY" },
    });
    await prisma.permission.upsert({
      where: { key: "catalog-gss-only.view" },
      create: {
        action: "view",
        description: "View a GSS-only catalog fixture in the Admin context.",
        key: "catalog-gss-only.view",
        module: "catalog-gss-only",
        scopeType: PermissionScopeType.GSS,
      },
      update: { description: "View a GSS-only catalog fixture.", scopeType: "GSS" },
    });
    await prisma.permission.updateMany({
      data: { description: "View authorized E2E catalog data." },
      where: { OR: [{ description: null }, { description: "" }] },
    });

    const passwordHash = await hash("test-password", 12);
    const adminRole = await prisma.gssRole.create({
      data: {
        key: "catalog-admin",
        name: "Catalog Admin",
        permissions: { create: { permissionId: adminCatalogPermission.id } },
      },
    });
    await prisma.gssAdminUser.create({
      data: {
        email: "catalog-admin@example.com",
        name: "Catalog Admin",
        passwordHash,
        roleId: adminRole.id,
      },
    });
    const company = await prisma.company.findFirstOrThrow({ where: { name: "Company A" } });
    const companyRole = await prisma.companyRole.create({
      data: {
        companyId: company.id,
        key: "catalog-viewer",
        name: "Catalog Viewer",
        permissions: { create: { permissionId: companyCatalogPermission.id } },
      },
    });
    const companyUser = await prisma.companyUser.create({
      data: {
        companyId: company.id,
        email: "catalog-company@example.com",
        name: "Catalog Company User",
        passwordHash,
        roleId: companyRole.id,
      },
    });

    const adminToken = await login("/auth/gss/login", "catalog-admin@example.com");
    const companyToken = await login("/auth/company/login", "catalog-company@example.com");
    const adminCatalog = await request(server)
      .get("/admin/permissions")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(
      adminCatalog.body.items.some(
        (permission: { key: string }) => permission.key === "catalog-gss-only.view",
      ),
    ).toBe(true);
    expect(
      adminCatalog.body.items.some(
        (permission: { key: string }) => permission.key === "catalog-company-only.view",
      ),
    ).toBe(false);
    expect(
      adminCatalog.body.items.every(
        (permission: Record<string, unknown>) =>
          ["id", "key", "module", "action", "scopeType", "description"].every(
            (field) => permission[field] !== undefined && permission[field] !== null,
          ) && String(permission.description).trim().length > 0,
      ),
    ).toBe(true);

    const companyCatalog = await request(server)
      .get("/company/permissions")
      .set("Authorization", `Bearer ${companyToken}`)
      .expect(200);
    expect(
      companyCatalog.body.items.some(
        (permission: { key: string }) => permission.key === "catalog-company-only.view",
      ),
    ).toBe(true);
    expect(
      companyCatalog.body.items.some(
        (permission: { key: string }) => permission.key === "catalog-gss-only.view",
      ),
    ).toBe(false);
    expect(
      companyCatalog.body.items.every((permission: { description: string | null }) =>
        Boolean(permission.description?.trim()),
      ),
    ).toBe(true);

    const noAdminPermissionToken = await login("/auth/gss/login", "gss-none@example.com");
    await request(server)
      .get("/admin/permissions")
      .set("Authorization", `Bearer ${noAdminPermissionToken}`)
      .expect(403);
    const noCompanyPermissionToken = await login("/auth/company/login", "company-none@example.com");
    await request(server)
      .get("/company/permissions")
      .set("Authorization", `Bearer ${noCompanyPermissionToken}`)
      .expect(403);
    await request(server)
      .get("/company/permissions")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(403);
    await request(server)
      .get("/admin/permissions")
      .set("Authorization", `Bearer ${companyToken}`)
      .expect(403);

    await prisma.companyUser.update({
      data: { isActive: false },
      where: { id: companyUser.id },
    });
    await request(server)
      .get("/company/permissions")
      .set("Authorization", `Bearer ${companyToken}`)
      .expect(401);
  });

  it("enforces Task 06 GSS roles, redacted system settings and Company settings separation", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const adminToken = await login("/auth/gss/login", "super@example.com");
    const roles = await request(server)
      .get("/admin/roles")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(
      roles.body.items.some((role: { key: string; isSuperAdmin: boolean }) => role.isSuperAdmin),
    ).toBe(true);

    const permissions = await request(server)
      .get("/admin/roles/permissions")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(
      permissions.body.every(
        (permission: { scopeType: string }) => permission.scopeType !== "COMPANY",
      ),
    ).toBe(true);

    const gssOnlyToken = await login("/auth/gss/login", "gss-none@example.com");
    await request(server)
      .get("/admin/roles")
      .set("Authorization", `Bearer ${gssOnlyToken}`)
      .expect(403);

    await request(server)
      .post("/admin/roles")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        key: "bad-company-role",
        name: "Bad Company Role",
        permissionIds: [companySettingsViewPermissionId],
      })
      .expect(400);
    const customRole = await request(server)
      .post("/admin/roles")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ key: "settings-auditor", name: "Settings Auditor", permissionIds: [] })
      .expect(201);
    await request(server)
      .patch(`/admin/roles/${customRole.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Settings Auditor Updated", permissionIds: [] })
      .expect(200);
    await request(server)
      .delete(`/admin/roles/${customRole.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const superRole = roles.body.items.find((role: { isSuperAdmin: boolean }) => role.isSuperAdmin);
    await request(server)
      .patch(`/admin/roles/${superRole.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Unsafe rename" })
      .expect(409);
    const inUseRole = roles.body.items.find((role: { key: string }) => role.key === "none");
    await request(server)
      .delete(`/admin/roles/${inUseRole.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(409);
    expect(
      await prisma.auditLog.count({ where: { entityType: "GssRole" } }),
    ).toBeGreaterThanOrEqual(3);

    const systemSettings = await request(server)
      .get("/admin/settings/system")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(systemSettings.body.controls.readOnly).toBe(true);
    expect(systemSettings.body.mqtt.brokerHost).toBeUndefined();
    expect(systemSettings.body.mqtt.clientId).toBeUndefined();
    expect(JSON.stringify(systemSettings.body)).not.toContain("GSS_SUPER_ADMIN_PASSWORD");

    const companyViewToken = await login("/auth/company/login", "scoped@example.com");
    const companySettings = await request(server)
      .get("/company/settings")
      .set("Authorization", `Bearer ${companyViewToken}`)
      .expect(200);
    expect(companySettings.body.name).toBe("Company A");
    await request(server)
      .patch("/company/settings")
      .set("Authorization", `Bearer ${companyViewToken}`)
      .send({ name: "Tampered", companyId: "foreign" })
      .expect(403);

    const companyManageToken = await login("/auth/company/login", "settings-manager@example.com");
    await request(server)
      .patch("/company/settings")
      .set("Authorization", `Bearer ${companyManageToken}`)
      .send({ email: "settings-manager@company-a.example", phone: "+82-2-0000-0000" })
      .expect(200)
      .expect(({ body }) => {
        expect(body.email).toBe("settings-manager@company-a.example");
        expect(body.name).toBe("Company A");
        expect(body.status).toBe("ACTIVE");
      });
    expect(
      await prisma.auditLog.count({ where: { action: "company-settings.update" } }),
    ).toBeGreaterThanOrEqual(1);

    const noPermissionCompanyToken = await login("/auth/company/login", "company-none@example.com");
    await request(server)
      .get("/company/branding/logo")
      .set("Authorization", `Bearer ${noPermissionCompanyToken}`)
      .expect(404);
    await request(server)
      .put("/company/settings/logo")
      .set("Authorization", `Bearer ${companyViewToken}`)
      .attach("logo", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), {
        filename: "logo.png",
        contentType: "image/png",
      })
      .expect(403);
    await request(server)
      .put("/company/settings/logo")
      .set("Authorization", `Bearer ${companyManageToken}`)
      .attach("logo", Buffer.from("<svg></svg>"), {
        filename: "logo.svg",
        contentType: "image/svg+xml",
      })
      .expect(400);
    await request(server)
      .put("/company/settings/logo")
      .set("Authorization", `Bearer ${companyManageToken}`)
      .attach("logo", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]), {
        filename: "logo.png",
        contentType: "text/plain",
      })
      .expect(200)
      .expect({ hasLogo: true });

    const companyLogo = await request(server)
      .get("/company/branding/logo")
      .set("Authorization", `Bearer ${noPermissionCompanyToken}`)
      .expect(200)
      .expect("Content-Type", "image/png");
    expect(companyLogo.headers.etag).toMatch(/^"[a-f0-9]{64}"$/);
    expect(companyLogo.headers["cache-control"]).toContain("private");
    await request(server)
      .get("/company/branding/logo")
      .set("Authorization", `Bearer ${noPermissionCompanyToken}`)
      .set("If-None-Match", companyLogo.headers.etag as string)
      .expect(304);
    const settingsWithLogo = await request(server)
      .get("/company/settings")
      .set("Authorization", `Bearer ${companyViewToken}`)
      .expect(200);
    expect(settingsWithLogo.body.hasLogo).toBe(true);
    expect(settingsWithLogo.body.logoKey).toBeUndefined();

    const companyId = settingsWithLogo.body.id as string;
    const noAdminPermissionToken = await login("/auth/gss/login", "gss-none@example.com");
    await request(server)
      .get(`/admin/companies/${companyId}/logo`)
      .set("Authorization", `Bearer ${noAdminPermissionToken}`)
      .expect(403);
    await request(server)
      .get(`/admin/companies/${companyId}/logo`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    await request(server)
      .put(`/admin/companies/${companyId}/logo`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("logo", Buffer.from("RIFF1234WEBPprivate"), {
        filename: "replacement.webp",
        contentType: "image/webp",
      })
      .expect(200);
    await request(server)
      .delete(`/admin/companies/${companyId}/logo`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200)
      .expect({ hasLogo: false });
    await request(server)
      .delete(`/admin/companies/${companyId}/logo`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200)
      .expect({ hasLogo: false });
    await request(server)
      .get("/company/branding/logo")
      .set("Authorization", `Bearer ${noPermissionCompanyToken}`)
      .expect(404);
    expect(
      await prisma.auditLog.count({ where: { action: { startsWith: "company-logo." } } }),
    ).toBeGreaterThanOrEqual(3);
  });

  it("allows a GSS super admin without explicit permission rows", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const token = await login("/auth/gss/login", "super@example.com");

    await request(server)
      .get("/rbac-probe/admin")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
  });

  it("rejects inactive users during login", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    await request(server)
      .post("/auth/company/login")
      .send({ email: "inactive@example.com", password: "test-password" })
      .expect(401);
  });

  it("rejects a company user without the required permission", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const token = await login("/auth/company/login", "company-none@example.com");

    await request(server)
      .get(`/rbac-probe/buildings/${sameCompanyOtherBuildingId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("rejects cross-building and cross-company direct object access", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const token = await login("/auth/company/login", "scoped@example.com");

    await request(server)
      .get(`/rbac-probe/buildings/${sameCompanyOtherBuildingId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
    await request(server)
      .get(`/rbac-probe/buildings/${otherCompanyBuildingId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("rejects a GSS token at a company endpoint", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const token = await login("/auth/gss/login", "super@example.com");

    await request(server)
      .get(`/rbac-probe/buildings/${sameCompanyOtherBuildingId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("enforces Phase 3 company boundaries, position scope, and last-manager protection", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const phaseThreeKeys = [
      "welcome.view",
      "dashboard.view",
      "companies.create",
      "areas.view",
      "areas.create",
      "areas.update",
      "areas.delete",
      "buildings.view",
      "buildings.create",
      "buildings.update",
      "buildings.delete",
      "company-users.view",
      "company-users.create",
      "company-users.update",
      "company-users.delete",
      "company-users.manage",
      "company-roles.view",
      "company-roles.manage",
      "company-permissions.view",
    ];
    const existingPermissions = await prisma.permission.findMany({
      where: { key: { in: phaseThreeKeys } },
    });
    const existingKeys = new Set(existingPermissions.map((permission) => permission.key));
    await prisma.permission.createMany({
      data: phaseThreeKeys
        .filter((key) => !existingKeys.has(key))
        .map((key) => {
          const [module, action] = key.split(".") as [string, string];
          return { action, key, module, scopeType: key === "companies.create" ? "GSS" : "COMPANY" };
        }),
    });
    const companyPermissions = await prisma.permission.findMany({
      where: { key: { in: phaseThreeKeys.filter((key) => key !== "companies.create") } },
      select: { id: true },
    });
    for (const roleKey of DEFAULT_COMPANY_ROLE_KEYS) {
      await prisma.companyRole.create({
        data: {
          isCompanyOwnerRole: roleKey === "platform_manager",
          isSystem: true,
          key: roleKey,
          name: defaultRoleName(roleKey),
          permissions: {
            createMany: { data: companyPermissions.map(({ id }) => ({ permissionId: id })) },
          },
        },
      });
    }
    const gssToken = await login("/auth/gss/login", "super@example.com");
    const firstCompany = await request(server)
      .post("/admin/companies")
      .set("Authorization", `Bearer ${gssToken}`)
      .send({
        name: "Phase 3 Company A",
        platformManager: {
          email: "phase3-manager@example.com",
          name: "Phase 3 Manager",
          password: "test-password",
        },
      })
      .expect(201);
    expect(firstCompany.body.platformManager.roleId).toBeDefined();
    const firstCompanyRoles = await request(server)
      .get(`/admin/companies/${firstCompany.body.company.id}/roles`)
      .set("Authorization", `Bearer ${gssToken}`)
      .expect(200);
    expect(firstCompanyRoles.body.items.map((role: { key: string }) => role.key).sort()).toEqual(
      [...DEFAULT_COMPANY_ROLE_KEYS].sort(),
    );
    expect(
      firstCompanyRoles.body.items.every((role: { companyId: string; isSystem: boolean }) => {
        return role.companyId === firstCompany.body.company.id && role.isSystem;
      }),
    ).toBe(true);
    expect(
      firstCompanyRoles.body.items.find((role: { key: string }) => role.key === "platform_manager")
        .isCompanyOwnerRole,
    ).toBe(true);

    const legacyCompany = await prisma.company.create({ data: { name: "Legacy Company" } });
    await prisma.companyRole.create({
      data: {
        companyId: legacyCompany.id,
        key: "viewer",
        name: "Legacy Viewer",
      },
    });
    const backfilledRoles = await request(server)
      .get(`/admin/companies/${legacyCompany.id}/roles`)
      .set("Authorization", `Bearer ${gssToken}`)
      .expect(200);
    expect(backfilledRoles.body.items.map((role: { key: string }) => role.key).sort()).toEqual(
      [...DEFAULT_COMPANY_ROLE_KEYS].sort(),
    );
    expect(
      await prisma.companyRole.count({
        where: { companyId: legacyCompany.id, key: { in: [...DEFAULT_COMPANY_ROLE_KEYS] } },
      }),
    ).toBe(DEFAULT_COMPANY_ROLE_KEYS.length);
    await request(server)
      .get(`/admin/companies/${legacyCompany.id}/roles`)
      .set("Authorization", `Bearer ${gssToken}`)
      .expect(200);
    expect(
      await prisma.companyRole.count({
        where: { companyId: legacyCompany.id, key: { in: [...DEFAULT_COMPANY_ROLE_KEYS] } },
      }),
    ).toBe(DEFAULT_COMPANY_ROLE_KEYS.length);
    const systemViewer = await prisma.companyRole.findFirstOrThrow({
      where: { companyId: legacyCompany.id, key: "viewer" },
      select: { id: true, isSystem: true, name: true },
    });
    expect(systemViewer).toMatchObject({ isSystem: true, name: "Viewer" });
    await request(server)
      .patch(`/admin/companies/${legacyCompany.id}/roles/${systemViewer.id}/permissions`)
      .set("Authorization", `Bearer ${gssToken}`)
      .send({ permissionIds: companyPermissions.map(({ id }) => id) })
      .expect(403);

    const managerToken = await login("/auth/company/login", "phase3-manager@example.com");
    const companyArea = await request(server)
      .post("/company/areas")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Scoped Area" })
      .expect(201);
    await request(server)
      .post(`/company/areas/${companyArea.body.id}/buildings`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ title: "Scoped Building" })
      .expect(201);

    const secondCompany = await request(server)
      .post("/admin/companies")
      .set("Authorization", `Bearer ${gssToken}`)
      .send({
        name: "Phase 3 Company B",
        platformManager: {
          email: "phase3-manager-b@example.com",
          name: "Phase 3 Manager B",
          password: "test-password",
        },
      })
      .expect(201);
    const foreignArea = await request(server)
      .post(`/admin/companies/${secondCompany.body.company.id}/areas`)
      .set("Authorization", `Bearer ${gssToken}`)
      .send({ name: "Foreign Area" })
      .expect(201);

    const position = await request(server)
      .post("/company/positions")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ key: "site_manager", name: "Site Manager" })
      .expect(201);
    await request(server)
      .patch(`/company/users/${firstCompany.body.platformManager.id}/positions`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ assignments: [{ areaId: foreignArea.body.id, positionId: position.body.id }] })
      .expect(403);

    const gssOnlyPermission = await prisma.permission.create({
      data: { action: "manage", key: "gss-only.manage", module: "gss-only", scopeType: "GSS" },
    });
    await request(server)
      .post("/company/users")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        directPermissions: [{ effect: "ALLOW", permissionId: gssOnlyPermission.id }],
        email: "invalid-permission@example.com",
        name: "Invalid Permission",
        password: "test-password",
        roleId: firstCompany.body.platformManager.roleId,
      })
      .expect(403);
    await request(server)
      .delete(`/company/users/${firstCompany.body.platformManager.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(403);

    expect(
      await prisma.auditLog.count({ where: { entityType: "Company" } }),
    ).toBeGreaterThanOrEqual(2);
  });

  it("supports Phase 10 company role, user, scope, permission and position management", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await ensurePhaseTenSeed(prisma);
    const gssToken = await login("/auth/gss/login", "super@example.com");
    const companyResponse = await request(server)
      .post("/admin/companies")
      .set("Authorization", `Bearer ${gssToken}`)
      .send({
        name: "Phase 10 Company",
        platformManager: {
          email: "phase10-manager@example.com",
          name: "Phase 10 Manager",
          password: "test-password",
        },
      })
      .expect(201);
    const managerToken = await login("/auth/company/login", "phase10-manager@example.com");
    const permissions = await request(server)
      .get("/company/permissions")
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    const permissionByKey = new Map(
      (permissions.body.items as Array<{ id: string; key: string }>).map((permission) => [
        permission.key,
        permission.id,
      ]),
    );
    const monitoringPermissionId = permissionByKey.get("monitoring.view")!;
    const reportsPermissionId = permissionByKey.get("reports.view")!;
    const userViewPermissionId = permissionByKey.get("company-users.view")!;

    const customRole = await request(server)
      .post("/company/roles")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        key: "Safety Lead",
        name: "Safety Lead",
        permissionIds: [monitoringPermissionId],
      })
      .expect(201);
    expect(customRole.body.key).toBe("safety_lead");

    const updatedRole = await request(server)
      .patch(`/company/roles/${customRole.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        name: "Safety Lead Updated",
        permissionIds: [monitoringPermissionId, reportsPermissionId],
      })
      .expect(200);
    expect(updatedRole.body.permissions).toHaveLength(2);

    const gssOnlyPermission = await prisma.permission.create({
      data: {
        action: "phase10",
        key: "phase10-gss-only.manage",
        module: "phase10-gss-only",
        scopeType: PermissionScopeType.GSS,
      },
    });
    await request(server)
      .patch(`/company/roles/${customRole.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ permissionIds: [gssOnlyPermission.id] })
      .expect(403);

    const area = await request(server)
      .post("/company/areas")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Phase 10 Site" })
      .expect(201);
    const building = await request(server)
      .post(`/company/areas/${area.body.id}/buildings`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ title: "Phase 10 Building" })
      .expect(201);
    const position = await request(server)
      .post("/company/positions")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ key: "safety_owner", name: "Safety Owner" })
      .expect(201);

    const user = await request(server)
      .post("/company/users")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        areaAccess: [{ accessLevel: "VIEW", areaId: area.body.id }],
        directPermissions: [
          { effect: "ALLOW", permissionId: userViewPermissionId },
          { effect: "DENY", permissionId: monitoringPermissionId },
        ],
        email: "phase10-user@example.com",
        name: "Phase 10 User",
        password: "test-password",
        roleId: customRole.body.id,
      })
      .expect(201);
    await request(server)
      .patch(`/company/users/${user.body.id}/positions`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        assignments: [
          { areaId: area.body.id, buildingId: building.body.id, positionId: position.body.id },
        ],
      })
      .expect(200);
    const effectiveAccess = await request(server)
      .get(`/company/users/${user.body.id}/effective-access`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    expect(
      effectiveAccess.body.effectivePermissions.map(
        (permission: { key: string }) => permission.key,
      ),
    ).toContain("reports.view");
    expect(
      effectiveAccess.body.effectivePermissions.map(
        (permission: { key: string }) => permission.key,
      ),
    ).not.toContain("monitoring.view");
    expect(
      effectiveAccess.body.inheritedBuildings.map((inherited: { id: string }) => inherited.id),
    ).toContain(building.body.id);

    await request(server)
      .delete(`/company/positions/${position.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    await request(server)
      .patch(`/company/users/${user.body.id}/positions`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ assignments: [{ positionId: position.body.id }] })
      .expect(403);

    const companyRoles = await request(server)
      .get("/company/roles")
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    const noPermissionRole = (companyRoles.body.items as Array<{ id: string; key: string }>).find(
      (role) => role.key === "no_permission",
    )!;
    await request(server)
      .post("/company/users")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        email: "phase10-none@example.com",
        name: "Phase 10 None",
        password: "test-password",
        roleId: noPermissionRole.id,
      })
      .expect(201);
    const noPermissionToken = await login("/auth/company/login", "phase10-none@example.com");
    await request(server)
      .get("/auth/company/me")
      .set("Authorization", `Bearer ${noPermissionToken}`)
      .expect(200);
    await request(server)
      .get("/company/buildings")
      .set("Authorization", `Bearer ${noPermissionToken}`)
      .expect(403);

    const activeToken = await login("/auth/company/login", "phase10-user@example.com");
    await request(server)
      .delete(`/company/users/${user.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    await request(server)
      .get("/auth/company/me")
      .set("Authorization", `Bearer ${activeToken}`)
      .expect(401);

    const foreignCompany = await request(server)
      .post("/admin/companies")
      .set("Authorization", `Bearer ${gssToken}`)
      .send({
        name: "Phase 10 Foreign Company",
        platformManager: {
          email: "phase10-foreign-manager@example.com",
          name: "Phase 10 Foreign Manager",
          password: "test-password",
        },
      })
      .expect(201);
    await request(server)
      .patch(`/company/roles/${foreignCompany.body.platformManager.roleId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Cross Company Mutation" })
      .expect(404);

    expect(companyResponse.body.company.id).toBeDefined();
  });

  it("allows scoped non-platform-manager Phase 10 reads without weakening scope or lockout rules", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await ensurePhaseTenSeed(prisma);
    const gssToken = await login("/auth/gss/login", "super@example.com");
    const companyResponse = await request(server)
      .post("/admin/companies")
      .set("Authorization", `Bearer ${gssToken}`)
      .send({
        name: "Phase 10 Maintenance Company",
        platformManager: {
          email: "phase10-maintenance-manager@example.com",
          name: "Phase 10 Maintenance Manager",
          password: "test-password",
        },
      })
      .expect(201);
    const managerToken = await login(
      "/auth/company/login",
      "phase10-maintenance-manager@example.com",
    );
    const permissions = await request(server)
      .get("/company/permissions")
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    const permissionByKey = new Map(
      (permissions.body.items as Array<{ id: string; key: string }>).map((permission) => [
        permission.key,
        permission.id,
      ]),
    );

    const area = await request(server)
      .post("/company/areas")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Phase 10 Maintenance Site" })
      .expect(201);
    const building = await request(server)
      .post(`/company/areas/${area.body.id}/buildings`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ title: "Phase 10 Maintenance Building" })
      .expect(201);
    const siblingArea = await request(server)
      .post("/company/areas")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Phase 10 Maintenance Sibling Site" })
      .expect(201);
    const siblingBuilding = await request(server)
      .post(`/company/areas/${siblingArea.body.id}/buildings`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ title: "Phase 10 Maintenance Sibling Building" })
      .expect(201);

    const customRole = await request(server)
      .post("/company/roles")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        key: "Scoped Maintenance Reader",
        name: "Scoped Maintenance Reader",
        permissionIds: [
          permissionByKey.get("welcome.view")!,
          permissionByKey.get("areas.view")!,
          permissionByKey.get("buildings.view")!,
        ],
      })
      .expect(201);
    const scopedUser = await request(server)
      .post("/company/users")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        areaAccess: [{ accessLevel: "VIEW", areaId: area.body.id }],
        directPermissions: [
          { effect: "ALLOW", permissionId: permissionByKey.get("company-users.view")! },
          { effect: "ALLOW", permissionId: permissionByKey.get("company-roles.view")! },
        ],
        email: "phase10-maintenance-reader@example.com",
        name: "Phase 10 Maintenance Reader",
        password: "test-password",
        roleId: customRole.body.id,
      })
      .expect(201);
    const scopedToken = await login(
      "/auth/company/login",
      "phase10-maintenance-reader@example.com",
    );
    const session = await request(server)
      .get("/auth/company/me")
      .set("Authorization", `Bearer ${scopedToken}`)
      .expect(200);
    expect(session.body.user.permissions).toEqual(
      expect.arrayContaining([
        "areas.view",
        "buildings.view",
        "company-users.view",
        "company-roles.view",
      ]),
    );

    await request(server)
      .get("/company/users")
      .set("Authorization", `Bearer ${scopedToken}`)
      .expect(200);
    await request(server)
      .get(`/company/users/${scopedUser.body.id}/effective-access`)
      .set("Authorization", `Bearer ${scopedToken}`)
      .expect(200);
    await request(server)
      .get("/company/roles")
      .set("Authorization", `Bearer ${scopedToken}`)
      .expect(200);
    await request(server)
      .get("/company/positions")
      .set("Authorization", `Bearer ${scopedToken}`)
      .expect(200);
    await request(server)
      .get(`/company/areas/${area.body.id}`)
      .set("Authorization", `Bearer ${scopedToken}`)
      .expect(200);
    await request(server)
      .get(`/company/buildings/${building.body.id}`)
      .set("Authorization", `Bearer ${scopedToken}`)
      .expect(200);
    await request(server)
      .get(`/company/areas/${siblingArea.body.id}`)
      .set("Authorization", `Bearer ${scopedToken}`)
      .expect(403);
    await request(server)
      .get(`/company/buildings/${siblingBuilding.body.id}`)
      .set("Authorization", `Bearer ${scopedToken}`)
      .expect(403);

    const companyRoles = await request(server)
      .get("/company/roles")
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    const siteManagerRole = (companyRoles.body.items as Array<{ id: string; key: string }>).find(
      (role) => role.key === "site_manager",
    )!;
    await request(server)
      .post("/company/users")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        areaAccess: [{ accessLevel: "VIEW", areaId: area.body.id }],
        email: "phase10-maintenance-site-manager@example.com",
        name: "Phase 10 Maintenance Site Manager",
        password: "test-password",
        roleId: siteManagerRole.id,
      })
      .expect(201);
    const siteManagerToken = await login(
      "/auth/company/login",
      "phase10-maintenance-site-manager@example.com",
    );
    await request(server)
      .get(`/company/areas/${area.body.id}`)
      .set("Authorization", `Bearer ${siteManagerToken}`)
      .expect(200);
    await request(server)
      .get(`/company/buildings/${building.body.id}`)
      .set("Authorization", `Bearer ${siteManagerToken}`)
      .expect(200);

    await request(server)
      .post("/company/users")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        email: "phase10-maintenance-no-scope@example.com",
        name: "Phase 10 Maintenance No Scope",
        password: "test-password",
        roleId: customRole.body.id,
      })
      .expect(201);
    const noScopeToken = await login(
      "/auth/company/login",
      "phase10-maintenance-no-scope@example.com",
    );
    await request(server)
      .get(`/company/areas/${area.body.id}`)
      .set("Authorization", `Bearer ${noScopeToken}`)
      .expect(403);
    await request(server)
      .get(`/company/buildings/${building.body.id}`)
      .set("Authorization", `Bearer ${noScopeToken}`)
      .expect(403);

    const noPermissionRole = (companyRoles.body.items as Array<{ id: string; key: string }>).find(
      (role) => role.key === "no_permission",
    )!;
    await request(server)
      .post("/company/users")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        areaAccess: [{ accessLevel: "VIEW", areaId: area.body.id }],
        email: "phase10-maintenance-no-permission@example.com",
        name: "Phase 10 Maintenance No Permission",
        password: "test-password",
        roleId: noPermissionRole.id,
      })
      .expect(201);
    const noPermissionToken = await login(
      "/auth/company/login",
      "phase10-maintenance-no-permission@example.com",
    );
    await request(server)
      .get(`/company/areas/${area.body.id}`)
      .set("Authorization", `Bearer ${noPermissionToken}`)
      .expect(403);
    await request(server)
      .get(`/company/buildings/${building.body.id}`)
      .set("Authorization", `Bearer ${noPermissionToken}`)
      .expect(403);

    const foreignCompany = await request(server)
      .post("/admin/companies")
      .set("Authorization", `Bearer ${gssToken}`)
      .send({
        name: "Phase 10 Maintenance Foreign Company",
        platformManager: {
          email: "phase10-maintenance-foreign-manager@example.com",
          name: "Phase 10 Maintenance Foreign Manager",
          password: "test-password",
        },
      })
      .expect(201);
    const foreignManagerToken = await login(
      "/auth/company/login",
      "phase10-maintenance-foreign-manager@example.com",
    );
    const foreignArea = await request(server)
      .post("/company/areas")
      .set("Authorization", `Bearer ${foreignManagerToken}`)
      .send({ name: "Phase 10 Maintenance Foreign Site" })
      .expect(201);
    const foreignBuilding = await request(server)
      .post(`/company/areas/${foreignArea.body.id}/buildings`)
      .set("Authorization", `Bearer ${foreignManagerToken}`)
      .send({ title: "Phase 10 Maintenance Foreign Building" })
      .expect(201);
    await request(server)
      .get(`/company/areas/${foreignArea.body.id}`)
      .set("Authorization", `Bearer ${scopedToken}`)
      .expect(403);
    await request(server)
      .get(`/company/buildings/${foreignBuilding.body.id}`)
      .set("Authorization", `Bearer ${scopedToken}`)
      .expect(403);

    await request(server)
      .patch(`/company/users/${companyResponse.body.platformManager.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ roleId: customRole.body.id })
      .expect(403);
    expect(foreignCompany.body.company.id).toBeDefined();
  });
});

function defaultRoleName(roleKey: (typeof DEFAULT_COMPANY_ROLE_KEYS)[number]) {
  const names = {
    building_manager: "Building Manager",
    no_permission: "No Permission",
    platform_manager: "Platform Manager",
    site_manager: "Site Manager",
    viewer: "Viewer",
  } satisfies Record<(typeof DEFAULT_COMPANY_ROLE_KEYS)[number], string>;
  return names[roleKey];
}

async function ensurePhaseTenSeed(prisma: PrismaService) {
  const permissionKeys = [
    "welcome.view",
    "dashboard.view",
    "areas.view",
    "areas.create",
    "areas.update",
    "areas.delete",
    "buildings.view",
    "buildings.create",
    "buildings.update",
    "buildings.delete",
    "building-plans.view",
    "company-users.view",
    "company-users.create",
    "company-users.update",
    "company-users.delete",
    "company-users.manage",
    "company-roles.view",
    "company-roles.manage",
    "company-permissions.view",
    "monitoring.view",
    "reports.view",
    "companies.create",
  ];
  for (const key of permissionKeys) {
    const [module, action] = key.split(".") as [string, string];
    await prisma.permission.upsert({
      where: { key },
      create: {
        action,
        key,
        module,
        scopeType:
          key === "companies.create" ? PermissionScopeType.GSS : PermissionScopeType.COMPANY,
      },
      update: {
        action,
        module,
        scopeType:
          key === "companies.create" ? PermissionScopeType.GSS : PermissionScopeType.COMPANY,
      },
    });
  }

  const companyPermissions = await prisma.permission.findMany({
    where: { key: { in: permissionKeys.filter((key) => key !== "companies.create") } },
    select: { id: true },
  });

  for (const roleKey of DEFAULT_COMPANY_ROLE_KEYS) {
    const existing = await prisma.companyRole.findFirst({
      where: { companyId: null, isSystem: true, key: roleKey },
      select: { id: true },
    });
    const role = existing
      ? await prisma.companyRole.update({
          where: { id: existing.id },
          data: {
            isCompanyOwnerRole: roleKey === "platform_manager",
            isSystem: true,
            name: defaultRoleName(roleKey),
          },
          select: { id: true },
        })
      : await prisma.companyRole.create({
          data: {
            isCompanyOwnerRole: roleKey === "platform_manager",
            isSystem: true,
            key: roleKey,
            name: defaultRoleName(roleKey),
          },
          select: { id: true },
        });
    await prisma.companyRolePermission.deleteMany({ where: { roleId: role.id } });
    const noPermissionWelcome = await prisma.permission.findUnique({
      where: { key: "welcome.view" },
      select: { id: true },
    });
    await prisma.companyRolePermission.createMany({
      data: (roleKey === "no_permission" ? [noPermissionWelcome!] : companyPermissions).map(
        ({ id }) => ({ permissionId: id, roleId: role.id }),
      ),
    });
  }
}
