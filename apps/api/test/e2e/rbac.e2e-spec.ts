import { Controller, Get } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { loadApiEnv } from "@gss-iot/config";
import { hash } from "bcrypt";
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
    await prisma.constructionBuilding.deleteMany();
    await prisma.constructionArea.deleteMany();
    await prisma.company.deleteMany();
    await prisma.gssAdminUserPermission.deleteMany();
    await prisma.gssRolePermission.deleteMany();
    await prisma.gssAdminUser.deleteMany();
    await prisma.gssRole.deleteMany();
    await prisma.permission.deleteMany();

    const [dashboardPermission, monitoringPermission] = await Promise.all([
      prisma.permission.create({
        data: { action: "view", key: "dashboard.view", module: "dashboard", scopeType: "BOTH" },
      }),
      prisma.permission.create({
        data: { action: "view", key: "monitoring.view", module: "monitoring", scopeType: "BOTH" },
      }),
    ]);
    const [gssSuperRole, gssNoPermissionRole, scopedCompanyRole, noPermissionCompanyRole] =
      await Promise.all([
        prisma.gssRole.create({ data: { isSuperAdmin: true, key: "super", name: "Super" } }),
        prisma.gssRole.create({ data: { key: "none", name: "None" } }),
        prisma.companyRole.create({
          data: {
            isCompanyOwnerRole: false,
            key: "scoped",
            name: "Scoped",
            permissions: { create: { permissionId: monitoringPermission.id } },
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

    await request(server)
      .get("/auth/company/me")
      .set("Origin", loopbackOrigin)
      .set("Authorization", `Bearer ${loginResponse.body.accessToken as string}`)
      .expect(200)
      .expect("Access-Control-Allow-Origin", loopbackOrigin);
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
    expect(firstCompanyRoles.body.map((role: { key: string }) => role.key).sort()).toEqual(
      [...DEFAULT_COMPANY_ROLE_KEYS].sort(),
    );
    expect(
      firstCompanyRoles.body.every((role: { companyId: string; isSystem: boolean }) => {
        return role.companyId === firstCompany.body.company.id && role.isSystem;
      }),
    ).toBe(true);
    expect(
      firstCompanyRoles.body.find((role: { key: string }) => role.key === "platform_manager")
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
    expect(backfilledRoles.body.map((role: { key: string }) => role.key).sort()).toEqual(
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
