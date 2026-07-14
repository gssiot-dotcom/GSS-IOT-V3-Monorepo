import { Controller, Get } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AdminEndpoint } from "../../src/common/decorators/admin-endpoint.decorator";
import { CompanyEndpoint } from "../../src/common/decorators/company-endpoint.decorator";
import { RequirePermissions } from "../../src/common/decorators/require-permissions.decorator";
import { RequireBuildingScope } from "../../src/common/decorators/require-scope.decorator";
import { AppModule } from "../../src/app.module";
import { AuthModule } from "../../src/modules/auth/auth.module";
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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, AuthModule],
      controllers: [RbacProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

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
});
