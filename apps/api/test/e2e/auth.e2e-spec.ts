import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../../src/app.module";
import { configureApiApp } from "../../src/bootstrap";
import { PrismaService } from "../../src/prisma/prisma.service";
import { loadApiEnv } from "@gss-iot/config";

const origin = "http://localhost:5173";

function cookieValue(setCookies: string[] | undefined, name: string): string {
  const cookie = setCookies?.find((value) => value.startsWith(`${name}=`));
  if (!cookie) throw new Error(`Missing ${name} cookie.`);
  return cookie.split(";")[0]!;
}

describe("HttpOnly rotating authentication e2e", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Parameters<typeof request>[0];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app, { ...loadApiEnv(), CORS_ALLOWED_ORIGINS: [origin] });
    await app.init();
    prisma = app.get(PrismaService);
    server = app.getHttpServer() as Parameters<typeof request>[0];

    const passwordHash = await hash("test-password", 12);
    const [adminRole, company] = await Promise.all([
      prisma.gssRole.create({ data: { isSuperAdmin: true, key: "auth-super", name: "Super" } }),
      prisma.company.create({ data: { name: "Auth Company" } }),
    ]);
    const companyRole = await prisma.companyRole.create({
      data: {
        companyId: company.id,
        isCompanyOwnerRole: true,
        key: "auth-owner",
        name: "Owner",
      },
    });
    await Promise.all([
      prisma.gssAdminUser.create({
        data: {
          email: "auth-admin@example.com",
          name: "Auth Admin",
          passwordHash,
          roleId: adminRole.id,
        },
      }),
      prisma.companyUser.create({
        data: {
          companyId: company.id,
          email: "auth-company@example.com",
          name: "Auth Company User",
          passwordHash,
          roleId: companyRole.id,
        },
      }),
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  async function csrf(agent: ReturnType<typeof request.agent>) {
    const response = await agent.get("/auth/csrf").set("Origin", origin).expect(200);
    return response.body.csrfToken as string;
  }

  async function loginAdmin(agent: ReturnType<typeof request.agent>, csrfToken: string) {
    return agent
      .post("/auth/gss/login")
      .set("Origin", origin)
      .set("x-csrf-token", csrfToken)
      .send({ email: "auth-admin@example.com", password: "test-password" })
      .expect(201);
  }

  async function loginCompany(agent: ReturnType<typeof request.agent>, csrfToken: string) {
    return agent
      .post("/auth/company/login")
      .set("Origin", origin)
      .set("x-csrf-token", csrfToken)
      .send({ email: "auth-company@example.com", password: "test-password" })
      .expect(201);
  }

  it("requires CSRF on login and rejects an untrusted Origin", async () => {
    await request(server)
      .post("/auth/gss/login")
      .send({ email: "auth-admin@example.com", password: "test-password" })
      .expect(403);
    await request(server)
      .post("/auth/gss/login")
      .set("Cookie", "gss_csrf=csrf-value")
      .set("Origin", "http://evil.example")
      .set("x-csrf-token", "csrf-value")
      .send({ email: "auth-admin@example.com", password: "test-password" })
      .expect(403);
  });

  it("sets hardened cookies, returns no token body and isolates auth contexts", async () => {
    const agent = request.agent(server);
    const csrfToken = await csrf(agent);
    const response = await loginAdmin(agent, csrfToken);
    const setCookies = response.headers["set-cookie"] as unknown as string[];

    expect(response.body.accessToken).toBeUndefined();
    expect(setCookies.find((value) => value.startsWith("gss_access="))).toContain("HttpOnly");
    expect(setCookies.find((value) => value.startsWith("gss_access="))).toContain("SameSite=Lax");
    expect(setCookies.find((value) => value.startsWith("gss_refresh="))).toContain("HttpOnly");
    expect(setCookies.find((value) => value.startsWith("gss_refresh="))).toContain("Path=/auth");
    expect(setCookies.find((value) => value.startsWith("gss_refresh="))).toContain(
      "Max-Age=2592000",
    );

    await agent.get("/auth/gss/me").expect(200);
    await agent.get("/auth/company/me").expect(403);

    const companyAgent = request.agent(server);
    const companyCsrf = await csrf(companyAgent);
    const companyResponse = await loginCompany(companyAgent, companyCsrf);
    const companyCookies = companyResponse.headers["set-cookie"] as unknown as string[];
    expect(companyResponse.body).toMatchObject({ context: "company-user" });
    expect(companyResponse.body.accessToken).toBeUndefined();
    expect(companyCookies.find((value) => value.startsWith("gss_access="))).toContain("HttpOnly");
    expect(companyCookies.find((value) => value.startsWith("gss_refresh="))).toContain(
      "Path=/auth",
    );
    await companyAgent.get("/auth/company/me").expect(200);
    await companyAgent.get("/auth/gss/me").expect(403);
  });

  it("rotates once, stores only hashes and revokes the family on old-token reuse", async () => {
    const agent = request.agent(server);
    const csrfToken = await csrf(agent);
    const login = await loginAdmin(agent, csrfToken);
    const loginCookies = login.headers["set-cookie"] as unknown as string[];
    const oldRefresh = cookieValue(loginCookies, "gss_refresh");
    const before = await prisma.refreshSession.findFirstOrThrow({
      where: { revokedAt: null },
      orderBy: { createdAt: "desc" },
    });
    expect(before.tokenHash).not.toContain(oldRefresh.split("=")[1]!);
    expect(before.expiresAt.getTime() - before.createdAt.getTime()).toBeGreaterThanOrEqual(
      2_592_000_000 - 2_000,
    );

    const rotated = await agent
      .post("/auth/refresh")
      .set("Origin", origin)
      .set("x-csrf-token", csrfToken)
      .expect(201);
    const nextRefresh = cookieValue(
      rotated.headers["set-cookie"] as unknown as string[],
      "gss_refresh",
    );
    const nextCsrf = cookieValue(
      rotated.headers["set-cookie"] as unknown as string[],
      "gss_csrf",
    ).split("=")[1]!;
    expect(nextRefresh).not.toBe(oldRefresh);
    expect(
      await prisma.refreshSession.count({ where: { familyId: before.familyId, revokedAt: null } }),
    ).toBe(1);
    const replacement = await prisma.refreshSession.findFirstOrThrow({
      where: { familyId: before.familyId, revokedAt: null },
    });
    expect(replacement.expiresAt).toEqual(before.expiresAt);
    expect(
      await prisma.refreshSession.count({
        where: { familyId: before.familyId, replacedById: { not: null }, revokeReason: "ROTATED" },
      }),
    ).toBe(1);

    await request(server)
      .post("/auth/refresh")
      .set("Cookie", `${oldRefresh}; gss_csrf=${nextCsrf}`)
      .set("Origin", origin)
      .set("x-csrf-token", nextCsrf)
      .expect(401);
    expect(
      await prisma.refreshSession.count({ where: { familyId: before.familyId, revokedAt: null } }),
    ).toBe(0);
  });

  it("resolves a parallel refresh race deterministically and logout revokes the session", async () => {
    const agent = request.agent(server);
    const csrfToken = await csrf(agent);
    const login = await loginAdmin(agent, csrfToken);
    const cookies = login.headers["set-cookie"] as unknown as string[];
    const refreshCookie = cookieValue(cookies, "gss_refresh");
    const accessCookie = cookieValue(cookies, "gss_access");
    const cookieHeader = `${refreshCookie}; ${accessCookie}; gss_csrf=${csrfToken}`;

    const responses = await Promise.all([
      request(server)
        .post("/auth/refresh")
        .set("Cookie", cookieHeader)
        .set("Origin", origin)
        .set("x-csrf-token", csrfToken),
      request(server)
        .post("/auth/refresh")
        .set("Cookie", cookieHeader)
        .set("Origin", origin)
        .set("x-csrf-token", csrfToken),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 401]);

    const logoutAgent = request.agent(server);
    const logoutCsrf = await csrf(logoutAgent);
    const logoutLogin = await loginAdmin(logoutAgent, logoutCsrf);
    const logoutRefresh = cookieValue(
      logoutLogin.headers["set-cookie"] as unknown as string[],
      "gss_refresh",
    );
    await logoutAgent
      .post("/auth/logout")
      .set("Origin", origin)
      .set("x-csrf-token", logoutCsrf)
      .expect(204);
    await logoutAgent.get("/auth/gss/me").expect(401);
    await request(server)
      .post("/auth/refresh")
      .set("Cookie", `${logoutRefresh}; gss_csrf=${logoutCsrf}`)
      .set("Origin", origin)
      .set("x-csrf-token", logoutCsrf)
      .expect(401);
  });

  it("rejects expired, token-version-changed and inactive-company refresh sessions", async () => {
    const expiredAgent = request.agent(server);
    const expiredCsrf = await csrf(expiredAgent);
    const expiredLogin = await loginAdmin(expiredAgent, expiredCsrf);
    const expiredRefresh = cookieValue(
      expiredLogin.headers["set-cookie"] as unknown as string[],
      "gss_refresh",
    );
    const expiredSession = await prisma.refreshSession.findFirstOrThrow({
      where: { revokedAt: null },
      orderBy: { createdAt: "desc" },
    });
    await prisma.refreshSession.update({
      data: { expiresAt: new Date(Date.now() - 1_000) },
      where: { id: expiredSession.id },
    });
    const expiredResponse = await request(server)
      .post("/auth/refresh")
      .set("Cookie", `${expiredRefresh}; gss_csrf=${expiredCsrf}`)
      .set("Origin", origin)
      .set("x-csrf-token", expiredCsrf)
      .expect(401);
    expect(String(expiredResponse.headers["set-cookie"])).toContain("gss_refresh=;");

    const versionAgent = request.agent(server);
    const versionCsrf = await csrf(versionAgent);
    await loginAdmin(versionAgent, versionCsrf);
    const versionSession = await prisma.refreshSession.findFirstOrThrow({
      where: { revokedAt: null },
      orderBy: { createdAt: "desc" },
    });
    const admin = await prisma.gssAdminUser.findUniqueOrThrow({
      where: { email: "auth-admin@example.com" },
    });
    await prisma.gssAdminUser.update({
      data: { tokenVersion: { increment: 1 } },
      where: { id: admin.id },
    });
    await versionAgent
      .post("/auth/refresh")
      .set("Origin", origin)
      .set("x-csrf-token", versionCsrf)
      .expect(401);
    expect(
      await prisma.refreshSession.count({
        where: { familyId: versionSession.familyId, revokedAt: null },
      }),
    ).toBe(0);

    const companyAgent = request.agent(server);
    const companyCsrf = await csrf(companyAgent);
    await loginCompany(companyAgent, companyCsrf);
    const companySession = await prisma.refreshSession.findFirstOrThrow({
      where: { revokedAt: null },
      orderBy: { createdAt: "desc" },
    });
    const companyUser = await prisma.companyUser.findUniqueOrThrow({
      where: { email: "auth-company@example.com" },
    });
    await prisma.company.update({
      data: { status: "INACTIVE" },
      where: { id: companyUser.companyId },
    });
    await companyAgent
      .post("/auth/refresh")
      .set("Origin", origin)
      .set("x-csrf-token", companyCsrf)
      .expect(401);
    expect(
      await prisma.refreshSession.count({
        where: { familyId: companySession.familyId, revokedAt: null },
      }),
    ).toBe(0);
    await prisma.company.update({
      data: { status: "ACTIVE" },
      where: { id: companyUser.companyId },
    });

    const deletedUserAgent = request.agent(server);
    const deletedUserCsrf = await csrf(deletedUserAgent);
    await loginCompany(deletedUserAgent, deletedUserCsrf);
    const deletedUserSession = await prisma.refreshSession.findFirstOrThrow({
      where: { revokedAt: null },
      orderBy: { createdAt: "desc" },
    });
    await prisma.companyUser.update({
      data: { deletedAt: new Date() },
      where: { id: companyUser.id },
    });
    await deletedUserAgent
      .post("/auth/refresh")
      .set("Origin", origin)
      .set("x-csrf-token", deletedUserCsrf)
      .expect(401);
    expect(
      await prisma.refreshSession.count({
        where: { familyId: deletedUserSession.familyId, revokedAt: null },
      }),
    ).toBe(0);
    await prisma.companyUser.update({
      data: { deletedAt: null },
      where: { id: companyUser.id },
    });

    const inactiveUserAgent = request.agent(server);
    const inactiveUserCsrf = await csrf(inactiveUserAgent);
    await loginCompany(inactiveUserAgent, inactiveUserCsrf);
    const inactiveUserSession = await prisma.refreshSession.findFirstOrThrow({
      where: { revokedAt: null },
      orderBy: { createdAt: "desc" },
    });
    await prisma.companyUser.update({
      data: { isActive: false },
      where: { id: companyUser.id },
    });
    await inactiveUserAgent
      .post("/auth/refresh")
      .set("Origin", origin)
      .set("x-csrf-token", inactiveUserCsrf)
      .expect(401);
    expect(
      await prisma.refreshSession.count({
        where: { familyId: inactiveUserSession.familyId, revokedAt: null },
      }),
    ).toBe(0);
    await prisma.companyUser.update({
      data: { isActive: true },
      where: { id: companyUser.id },
    });
  });
});
