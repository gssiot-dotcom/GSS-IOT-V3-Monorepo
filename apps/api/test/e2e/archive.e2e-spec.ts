import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { loadApiEnv } from "@gss-iot/config";
import { GatewayType, PermissionScopeType } from "@prisma/client";
import { hash } from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../../src/app.module";
import { configureApiApp } from "../../src/bootstrap";
import { PrismaService } from "../../src/prisma/prisma.service";
import { ReportJobProcessorService } from "../../src/modules/reports/report-job-processor.service";
import { ArchiveJobProcessorService } from "../../src/modules/archive/archive-job-processor.service";

describe("two-tier Archive capability, evidence and security e2e", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Parameters<typeof request>[0];
  let baseUrl: string;
  let gssToken: string;
  let noArchiveToken: string;
  let purgeWithoutDomainToken: string;
  let archiveExporterToken: string;
  let companyToken: string;
  let companyId: string;
  let siteId: string;
  let siteBuildingId: string;
  let activeBuildingId: string;
  let endedBuildingId: string;
  let readingId: string;
  let soleOwnerId: string;

  const suffix = randomUUID().slice(0, 8);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app, loadApiEnv());
    await app.init();
    await app.listen(0);
    prisma = app.get(PrismaService);
    server = app.getHttpServer() as Parameters<typeof request>[0];
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    const keys = [
      "archive.purge",
      "archive.view",
      "areas.delete",
      "areas.view",
      "buildings.delete",
      "buildings.view",
      "companies.delete",
      "companies.view",
      "company-users.delete",
      "reports.export",
      "sensor-readings.purge",
    ];
    for (const key of keys) {
      const [module, action] = key.split(".") as [string, string];
      await prisma.permission.upsert({
        create: {
          action,
          key,
          module,
          scopeType:
            key.startsWith("archive") || key === "sensor-readings.purge"
              ? PermissionScopeType.GSS
              : PermissionScopeType.BOTH,
        },
        update: {},
        where: { key },
      });
    }
    const permissionByKey = new Map(
      (await prisma.permission.findMany({ where: { key: { in: keys } } })).map((item) => [
        item.key,
        item,
      ]),
    );
    const passwordHash = await hash("archive-test-password", 12);
    const superRole = await prisma.gssRole.create({
      data: { isSuperAdmin: true, key: `archive-super-${suffix}`, name: "Archive Super Admin" },
    });
    const noArchiveRole = await prisma.gssRole.create({
      data: {
        key: `archive-none-${suffix}`,
        name: "No Archive",
        permissions: { create: { permissionId: permissionByKey.get("companies.view")!.id } },
      },
    });
    const purgeWithoutDomainRole = await prisma.gssRole.create({
      data: {
        key: `archive-purge-only-${suffix}`,
        name: "Archive Purge Without Domain",
        permissions: {
          createMany: {
            data: ["archive.purge", "archive.view"].map((key) => ({
              permissionId: permissionByKey.get(key)!.id,
            })),
          },
        },
      },
    });
    const archiveExporterRole = await prisma.gssRole.create({
      data: {
        key: `archive-exporter-${suffix}`,
        name: "Archive Exporter",
        permissions: {
          createMany: {
            data: ["archive.view", "reports.export"].map((key) => ({
              permissionId: permissionByKey.get(key)!.id,
            })),
          },
        },
      },
    });
    await prisma.gssAdminUser.createMany({
      data: [
        {
          email: `archive-super-${suffix}@example.com`,
          name: "Archive Super",
          passwordHash,
          roleId: superRole.id,
        },
        {
          email: `archive-none-${suffix}@example.com`,
          name: "No Archive",
          passwordHash,
          roleId: noArchiveRole.id,
        },
        {
          email: `archive-purge-${suffix}@example.com`,
          name: "Purge No Domain",
          passwordHash,
          roleId: purgeWithoutDomainRole.id,
        },
        {
          email: `archive-exporter-${suffix}@example.com`,
          name: "Archive Exporter",
          passwordHash,
          roleId: archiveExporterRole.id,
        },
      ],
    });

    const company = await prisma.company.create({ data: { name: `Archive Company ${suffix}` } });
    companyId = company.id;
    const companyRole = await prisma.companyRole.create({
      data: {
        companyId,
        isCompanyOwnerRole: true,
        isSystem: true,
        key: `platform_manager_${suffix}`,
        name: "Platform Manager",
        permissions: {
          createMany: {
            data: [
              "areas.delete",
              "areas.view",
              "buildings.delete",
              "buildings.view",
              "company-users.delete",
            ].map((key) => ({ permissionId: permissionByKey.get(key)!.id })),
          },
        },
      },
    });
    const owner = await prisma.companyUser.create({
      data: {
        companyId,
        email: `archive-owner-${suffix}@example.com`,
        name: "Archive Owner",
        passwordHash,
        roleId: companyRole.id,
      },
    });
    soleOwnerId = owner.id;

    const activeSite = await prisma.constructionArea.create({
      data: { companyId, name: "Active Archive Site" },
    });
    const activeBuilding = await prisma.constructionBuilding.create({
      data: { areaId: activeSite.id, companyId, title: "Active Assignment Building" },
    });
    activeBuildingId = activeBuilding.id;
    const endedBuilding = await prisma.constructionBuilding.create({
      data: { areaId: activeSite.id, companyId, title: "Ended Assignment Building" },
    });
    endedBuildingId = endedBuilding.id;
    const parentSite = await prisma.constructionArea.create({
      data: { companyId, name: "Parent Archive Site" },
    });
    siteId = parentSite.id;
    const parentBuilding = await prisma.constructionBuilding.create({
      data: { areaId: parentSite.id, companyId, title: "Parent Derived Building" },
    });
    siteBuildingId = parentBuilding.id;
    const gateway = await prisma.gateway.create({
      data: { gatewayType: GatewayType.NODES_GATEWAY, serialNumber: `ARCHIVE-GW-${suffix}` },
    });
    await prisma.gatewayBuildingAssignment.createMany({
      data: [
        { buildingId: activeBuilding.id, gatewayId: gateway.id },
        {
          activeKey: `ended-${suffix}`,
          buildingId: endedBuilding.id,
          gatewayId: gateway.id,
          status: "ENDED",
          unassignedAt: new Date(),
        },
      ],
    });
    const nodeType = await prisma.nodeType.upsert({
      create: {
        displayName: "Archive Node",
        imageAssetKey: "door.png",
        key: `archive_node_${suffix}`,
        numericCode: 9800 + Number.parseInt(suffix.slice(0, 2), 16),
      },
      update: {},
      where: { key: `archive_node_${suffix}` },
    });
    const node = await prisma.node.create({
      data: { nodeTypeId: nodeType.id, number: `ARCHIVE-NODE-${suffix}` },
    });
    await prisma.nodeGatewayAssignment.create({ data: { gatewayId: gateway.id, nodeId: node.id } });
    const reading = await prisma.sensorReading.create({
      data: {
        areaId: activeSite.id,
        buildingId: activeBuilding.id,
        companyId,
        deduplicationKey: `archive-reading-${suffix}`,
        deduplicationSource: "archive-e2e",
        gatewayId: gateway.id,
        nodeId: node.id,
        nodeTypeId: nodeType.id,
        status: "WARNING",
        valueHash: `archive-hash-${suffix}`,
        values: { value: 42 },
      },
    });
    readingId = reading.id;

    gssToken = await login(`archive-super-${suffix}@example.com`);
    noArchiveToken = await login(`archive-none-${suffix}@example.com`);
    purgeWithoutDomainToken = await login(`archive-purge-${suffix}@example.com`);
    archiveExporterToken = await login(`archive-exporter-${suffix}@example.com`);
    companyToken = await login(`archive-owner-${suffix}@example.com`, true);
  });

  afterAll(async () => {
    await app?.close();
  });

  it("exposes ARCHIVE capabilities despite child and historical dependencies", async () => {
    const buildings = await request(server)
      .get("/company/buildings?pageSize=100")
      .set("Cookie", companyToken)
      .set("x-csrf-token", "test-csrf-token")
      .expect(200);
    for (const id of [activeBuildingId, endedBuildingId, siteBuildingId]) {
      expect(
        buildings.body.items.find((item: { id: string }) => item.id === id)?.deletion.mode,
      ).toBe("ARCHIVE");
    }
    const sites = await request(server)
      .get("/company/areas?pageSize=100")
      .set("Cookie", companyToken)
      .set("x-csrf-token", "test-csrf-token")
      .expect(200);
    expect(sites.body.items.find((item: { id: string }) => item.id === siteId)?.deletion.mode).toBe(
      "ARCHIVE",
    );
  });

  it("archives a Building with an active assignment, retains history, and hides direct access", async () => {
    await request(server)
      .delete(`/company/buildings/${activeBuildingId}`)
      .set("Cookie", companyToken)
      .set("x-csrf-token", "test-csrf-token")
      .send({ reason: "Archive active building" })
      .expect(200);
    expect(
      await prisma.constructionBuilding.findUnique({ where: { id: activeBuildingId } }),
    ).toMatchObject({ deletedAt: expect.any(Date) });
    expect(
      await prisma.gatewayBuildingAssignment.findFirst({ where: { buildingId: activeBuildingId } }),
    ).toMatchObject({ status: "ENDED", unassignedAt: expect.any(Date) });
    await expect(
      prisma.sensorReading.findUnique({ where: { id: readingId } }),
    ).resolves.not.toBeNull();
    await request(server)
      .get(`/company/buildings/${activeBuildingId}`)
      .set("Cookie", companyToken)
      .set("x-csrf-token", "test-csrf-token")
      .expect(404);
    const detail = await request(server)
      .get(`/admin/archive/CONSTRUCTION_BUILDING/${activeBuildingId}`)
      .set("Cookie", gssToken)
      .set("x-csrf-token", "test-csrf-token")
      .expect(200);
    expect(detail.body).toMatchObject({ root: { id: activeBuildingId } });
  });

  it("archives a non-empty Site and exposes its child as parent-derived evidence", async () => {
    await request(server)
      .delete(`/company/areas/${siteId}`)
      .set("Cookie", companyToken)
      .set("x-csrf-token", "test-csrf-token")
      .send({ reason: "Archive site subtree" })
      .expect(200);
    expect(await prisma.constructionArea.findUnique({ where: { id: siteId } })).toMatchObject({
      deletedAt: expect.any(Date),
    });
    expect(
      await prisma.constructionBuilding.findUnique({ where: { id: siteBuildingId } }),
    ).toMatchObject({ deletedAt: null });
    const evidence = await request(server)
      .get(`/admin/archive?entityType=CONSTRUCTION_BUILDING&areaId=${siteId}&pageSize=50`)
      .set("Cookie", gssToken)
      .set("x-csrf-token", "test-csrf-token")
      .expect(200);
    expect(
      evidence.body.items.find((item: { id: string }) => item.id === siteBuildingId),
    ).toMatchObject({ parentDerived: true });
  });

  it("preserves archive security, last-owner safety and purge permission conjunction", async () => {
    await request(server)
      .get("/admin/archive")
      .set("Cookie", companyToken)
      .set("x-csrf-token", "test-csrf-token")
      .expect(403);
    await request(server)
      .get("/admin/archive")
      .set("Cookie", noArchiveToken)
      .set("x-csrf-token", "test-csrf-token")
      .expect(403);
    await request(server)
      .delete(`/company/users/${soleOwnerId}`)
      .set("Cookie", companyToken)
      .set("x-csrf-token", "test-csrf-token")
      .send({ reason: "must fail" })
      .expect(403);

    await request(server)
      .delete(`/company/buildings/${endedBuildingId}`)
      .set("Cookie", companyToken)
      .set("x-csrf-token", "test-csrf-token")
      .send({ reason: "Archive historical assignment building" })
      .expect(200);

    const preview = await request(server)
      .post("/admin/archive/purge/preview")
      .set("Cookie", gssToken)
      .set("x-csrf-token", "test-csrf-token")
      .send({ rootId: endedBuildingId, rootType: "CONSTRUCTION_BUILDING" })
      .expect(201);
    await request(server)
      .post("/admin/archive/purge/jobs")
      .set("Cookie", noArchiveToken)
      .set("x-csrf-token", "test-csrf-token")
      .send({
        confirmation: preview.body.rootName,
        idempotencyKey: randomUUID(),
        previewHash: preview.body.previewHash,
        rootId: endedBuildingId,
        rootType: "CONSTRUCTION_BUILDING",
      })
      .expect(403);
    await request(server)
      .post("/admin/archive/purge/jobs")
      .set("Cookie", purgeWithoutDomainToken)
      .set("x-csrf-token", "test-csrf-token")
      .send({
        confirmation: preview.body.rootName,
        idempotencyKey: randomUUID(),
        previewHash: preview.body.previewHash,
        rootId: endedBuildingId,
        rootType: "CONSTRUCTION_BUILDING",
      })
      .expect(403);
    const idempotencyKey = randomUUID();
    const allowed = await request(server)
      .post("/admin/archive/purge/jobs")
      .set("Cookie", gssToken)
      .set("x-csrf-token", "test-csrf-token")
      .send({
        confirmation: preview.body.rootName,
        idempotencyKey,
        previewHash: preview.body.previewHash,
        rootId: endedBuildingId,
        rootType: "CONSTRUCTION_BUILDING",
      })
      .expect(201);
    const duplicate = await request(server)
      .post("/admin/archive/purge/jobs")
      .set("Cookie", gssToken)
      .set("x-csrf-token", "test-csrf-token")
      .send({
        confirmation: preview.body.rootName,
        idempotencyKey,
        previewHash: preview.body.previewHash,
        rootId: endedBuildingId,
        rootType: "CONSTRUCTION_BUILDING",
      })
      .expect(201);
    expect(duplicate.body.id).toBe(allowed.body.id);
  });

  it.each(["CSV", "XLSX"])(
    "exports backend-filtered Archive evidence through the existing %s report pipeline",
    async (format) => {
      const requested = await request(server)
        .post("/admin/reports/export")
        .set("Cookie", archiveExporterToken)
        .set("x-csrf-token", "test-csrf-token")
        .send({
          filters: { archiveEntityType: "CONSTRUCTION_AREA", companyId },
          format,
          reportType: "ARCHIVE_EVIDENCE",
        })
        .expect(201);
      const processor = app.get(ReportJobProcessorService);
      await expect(processor.processPending(100)).resolves.toBeGreaterThanOrEqual(1);
      const job = await request(server)
        .get(`/admin/reports/${requested.body.id}`)
        .set("Cookie", archiveExporterToken)
        .set("x-csrf-token", "test-csrf-token")
        .expect(200);
      expect(job.body.status).toBe("COMPLETED");
      expect(job.body.exports).toHaveLength(1);
      expect(JSON.stringify(job.body)).not.toContain("storageKey");
      await request(server)
        .get(`/admin/reports/exports/${job.body.exports[0].id}/download`)
        .set("Cookie", archiveExporterToken)
        .set("x-csrf-token", "test-csrf-token")
        .expect(200);
      await expect(
        prisma.auditLog.count({
          where: { action: { in: ["report-job.create", "report-export.download"] } },
        }),
      ).resolves.toBeGreaterThanOrEqual(2);
    },
  );

  it("never permits a Company user to request Archive evidence export", async () => {
    await request(server)
      .post("/company/reports/export")
      .set("Cookie", companyToken)
      .set("x-csrf-token", "test-csrf-token")
      .send({ format: "CSV", reportType: "ARCHIVE_EVIDENCE" })
      .expect(403);
  });

  it("purges a backend-filtered SensorReading snapshot and rejects stale previews and Company callers", async () => {
    const first = await prisma.sensorReading.findUniqueOrThrow({ where: { id: readingId } });
    const filters = {
      buildingId: first.buildingId,
      companyId,
      from: new Date(first.receivedAt.getTime() - 60_000).toISOString(),
      status: "WARNING",
      to: new Date(first.receivedAt.getTime() + 60_000).toISOString(),
    };
    await request(server)
      .post("/admin/archive/sensor-readings/preview")
      .set("Cookie", companyToken)
      .set("x-csrf-token", "test-csrf-token")
      .send(filters)
      .expect(403);
    const stale = await request(server)
      .post("/admin/archive/sensor-readings/preview")
      .set("Cookie", gssToken)
      .set("x-csrf-token", "test-csrf-token")
      .send(filters)
      .expect(201);
    await prisma.sensorReading.create({
      data: {
        areaId: first.areaId,
        buildingId: first.buildingId,
        companyId,
        deduplicationKey: `archive-reading-stale-${suffix}`,
        deduplicationSource: "archive-e2e",
        gatewayId: first.gatewayId,
        nodeId: first.nodeId,
        nodeTypeId: first.nodeTypeId,
        receivedAt: new Date(first.receivedAt.getTime() + 1),
        status: "WARNING",
        valueHash: `archive-hash-stale-${suffix}`,
        values: { value: 43 },
      },
    });
    await request(server)
      .post("/admin/archive/sensor-readings/jobs")
      .set("Cookie", gssToken)
      .set("x-csrf-token", "test-csrf-token")
      .send({
        ...filters,
        confirmation: stale.body.confirmation,
        idempotencyKey: randomUUID(),
        previewHash: stale.body.previewHash,
      })
      .expect(409);
    const fresh = await request(server)
      .post("/admin/archive/sensor-readings/preview")
      .set("Cookie", gssToken)
      .set("x-csrf-token", "test-csrf-token")
      .send(filters)
      .expect(201);
    expect(fresh.body).toMatchObject({ eligible: 2, matched: 2, preservedReferenced: 0 });
    const queued = await request(server)
      .post("/admin/archive/sensor-readings/jobs")
      .set("Cookie", gssToken)
      .set("x-csrf-token", "test-csrf-token")
      .send({
        ...filters,
        confirmation: fresh.body.confirmation,
        idempotencyKey: randomUUID(),
        previewHash: fresh.body.previewHash,
      })
      .expect(201);
    const processor = app.get(ArchiveJobProcessorService);
    for (let attempt = 0; attempt < 4; attempt += 1) await processor.runOnce();
    const status = await request(server)
      .get(`/admin/archive/purge/jobs/${queued.body.id}`)
      .set("Cookie", gssToken)
      .set("x-csrf-token", "test-csrf-token")
      .expect(200);
    expect(status.body).toMatchObject({ status: "COMPLETED" });
    await expect(
      prisma.sensorReading.count({ where: { buildingId: first.buildingId } }),
    ).resolves.toBe(0);
  });

  it("returns a safe deterministic reconciliation report with no unexpected orphan", async () => {
    const report = await request(server)
      .get("/admin/archive/reconciliation/report")
      .set("Cookie", gssToken)
      .set("x-csrf-token", "test-csrf-token")
      .expect(200);
    expect(report.body.unexpectedCount).toBe(0);
    expect(report.body.provenance.ambiguousLegacyAssignments).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(report.body)).not.toContain("storageKey");
  });

  it("archives a non-empty Company while retaining its subtree as evidence", async () => {
    await request(server)
      .delete(`/admin/companies/${companyId}`)
      .set("Cookie", gssToken)
      .set("x-csrf-token", "test-csrf-token")
      .send({ reason: "Tenant offboarding" })
      .expect(200);
    expect(await prisma.company.findUnique({ where: { id: companyId } })).toMatchObject({
      deletedAt: expect.any(Date),
      status: "INACTIVE",
    });
    await request(server)
      .get(`/admin/companies/${companyId}`)
      .set("Cookie", gssToken)
      .set("x-csrf-token", "test-csrf-token")
      .expect(404);
    const companies = await request(server)
      .get("/admin/companies?pageSize=100")
      .set("Cookie", gssToken)
      .set("x-csrf-token", "test-csrf-token")
      .expect(200);
    expect(companies.body.items.some((item: { id: string }) => item.id === companyId)).toBe(false);
    const detail = await request(server)
      .get(`/admin/archive/COMPANY/${companyId}`)
      .set("Cookie", gssToken)
      .set("x-csrf-token", "test-csrf-token")
      .expect(200);
    expect(detail.body).toMatchObject({
      root: { id: companyId, name: `Archive Company ${suffix}` },
    });
  });

  async function login(email: string, company = false): Promise<string> {
    const response = await request(baseUrl)
      .post(company ? "/auth/company/login" : "/auth/gss/login")
      .set("Cookie", "gss_csrf=test-csrf-token")
      .set("x-csrf-token", "test-csrf-token")
      .send({ email, password: "archive-test-password" })
      .expect(201);
    const setCookies = response.headers["set-cookie"];
    const cookieValues = Array.isArray(setCookies) ? setCookies : setCookies ? [setCookies] : [];
    return ["gss_csrf=test-csrf-token", ...cookieValues.map((cookie) => cookie.split(";")[0])].join(
      "; ",
    );
  }
});
