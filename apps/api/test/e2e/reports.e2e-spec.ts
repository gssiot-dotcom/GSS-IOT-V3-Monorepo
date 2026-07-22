import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { loadApiEnv } from "@gss-iot/config";
import { PermissionScopeType, ReportFileFormat, ReportType } from "@prisma/client";
import { hash } from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../../src/app.module";
import { configureApiApp } from "../../src/bootstrap";
import { ReportGenerationService } from "../../src/modules/reports/report-generation.service";
import { ReportJobProcessorService } from "../../src/modules/reports/report-job-processor.service";
import { ReportExportCleanupService } from "../../src/modules/reports/report-export-cleanup.service";
import { PrismaService } from "../../src/prisma/prisma.service";

describe("Phase 13 report foundation e2e", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let generation: ReportGenerationService;
  let processor: ReportJobProcessorService;
  let cleanup: ReportExportCleanupService;
  let companyAId: string;
  let allowedBuildingId: string;
  let otherBuildingId: string;
  let companyBId: string;
  let areaBId: string;
  let foreignBuildingId: string;
  let gssToken: string;
  let companyViewToken: string;
  let companyExportToken: string;
  let foreignExportToken: string;
  let inactiveEmail: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app, loadApiEnv());
    await app.init();
    prisma = app.get(PrismaService);
    generation = app.get(ReportGenerationService);
    processor = app.get(ReportJobProcessorService);
    cleanup = app.get(ReportExportCleanupService);

    await prisma.reportExport.deleteMany();
    await prisma.reportJob.deleteMany();

    const suffix = Date.now().toString();
    const [viewPermission, exportPermission, companyPermission, auditPermission] =
      await Promise.all([
        prisma.permission.upsert({
          where: { key: "reports.view" },
          create: {
            action: "view",
            key: "reports.view",
            module: "reports",
            scopeType: PermissionScopeType.BOTH,
          },
          update: {},
        }),
        prisma.permission.upsert({
          where: { key: "reports.export" },
          create: {
            action: "export",
            key: "reports.export",
            module: "reports",
            scopeType: PermissionScopeType.BOTH,
          },
          update: {},
        }),
        prisma.permission.upsert({
          where: { key: "reports.audit" },
          create: {
            action: "audit",
            key: "reports.audit",
            module: "reports",
            scopeType: PermissionScopeType.GSS,
          },
          update: {},
        }),
        prisma.permission.upsert({
          where: { key: "reports.company" },
          create: {
            action: "company",
            key: "reports.company",
            module: "reports",
            scopeType: PermissionScopeType.GSS,
          },
          update: {},
        }),
      ]);

    const [, gssExportRole, companyA, companyB] = await Promise.all([
      prisma.gssRole.create({
        data: {
          key: `reports-view-${suffix}`,
          name: "Reports View",
          permissions: {
            create: [viewPermission, companyPermission].map((permission) => ({
              permissionId: permission.id,
            })),
          },
        },
      }),
      prisma.gssRole.create({
        data: {
          key: `reports-export-${suffix}`,
          name: "Reports Export",
          permissions: {
            create: [viewPermission, exportPermission, companyPermission, auditPermission].map(
              (permission) => ({
                permissionId: permission.id,
              }),
            ),
          },
        },
      }),
      prisma.company.create({ data: { name: `Report Company A ${suffix}` } }),
      prisma.company.create({ data: { name: `Report Company B ${suffix}` } }),
    ]);
    const gssUser = await prisma.gssAdminUser.create({
      data: {
        email: `reports-admin-${suffix}@example.com`,
        name: "Reports Admin",
        passwordHash: await hash("test-password", 12),
        roleId: gssExportRole.id,
      },
    });
    const [companyRoleA, companyRoleB] = await Promise.all([
      prisma.companyRole.create({
        data: {
          companyId: companyA.id,
          key: `reports-export-${suffix}`,
          name: "Reports Export",
          permissions: {
            create: [{ permissionId: viewPermission.id }, { permissionId: exportPermission.id }],
          },
        },
      }),
      prisma.companyRole.create({
        data: {
          companyId: companyB.id,
          key: `reports-export-${suffix}`,
          name: "Reports Export",
          permissions: {
            create: [{ permissionId: viewPermission.id }, { permissionId: exportPermission.id }],
          },
        },
      }),
    ]);
    const viewRole = await prisma.companyRole.create({
      data: {
        companyId: companyA.id,
        key: `reports-view-${suffix}`,
        name: "Reports View",
        permissions: { create: [{ permissionId: viewPermission.id }] },
      },
    });

    const [areaA, areaB] = await Promise.all([
      prisma.constructionArea.create({
        data: { companyId: companyA.id, name: `Site A ${suffix}` },
      }),
      prisma.constructionArea.create({
        data: { companyId: companyB.id, name: `Site B ${suffix}` },
      }),
    ]);
    const [allowedBuilding, otherBuilding, foreignBuilding] = await Promise.all([
      prisma.constructionBuilding.create({
        data: { areaId: areaA.id, companyId: companyA.id, title: `Allowed ${suffix}` },
      }),
      prisma.constructionBuilding.create({
        data: { areaId: areaA.id, companyId: companyA.id, title: `Other ${suffix}` },
      }),
      prisma.constructionBuilding.create({
        data: { areaId: areaB.id, companyId: companyB.id, title: `Foreign ${suffix}` },
      }),
    ]);
    companyAId = companyA.id;
    allowedBuildingId = allowedBuilding.id;
    otherBuildingId = otherBuilding.id;
    companyBId = companyB.id;
    areaBId = areaB.id;
    foreignBuildingId = foreignBuilding.id;

    const [companyView, companyExport, foreignExport, inactive] = await Promise.all([
      prisma.companyUser.create({
        data: {
          companyId: companyA.id,
          email: `reports-view-${suffix}@example.com`,
          name: "Report Viewer",
          passwordHash: await hash("test-password", 12),
          roleId: viewRole.id,
        },
      }),
      prisma.companyUser.create({
        data: {
          companyId: companyA.id,
          email: `reports-exporter-${suffix}@example.com`,
          name: "Report Exporter",
          passwordHash: await hash("test-password", 12),
          roleId: companyRoleA.id,
        },
      }),
      prisma.companyUser.create({
        data: {
          companyId: companyB.id,
          email: `reports-foreign-${suffix}@example.com`,
          name: "Foreign Exporter",
          passwordHash: await hash("test-password", 12),
          roleId: companyRoleB.id,
        },
      }),
      prisma.companyUser.create({
        data: {
          companyId: companyA.id,
          email: `reports-inactive-${suffix}@example.com`,
          isActive: false,
          name: "Inactive Report User",
          passwordHash: await hash("test-password", 12),
          roleId: companyRoleA.id,
        },
      }),
    ]);
    inactiveEmail = inactive.email;
    await prisma.companyUserBuildingAccess.create({
      data: { buildingId: allowedBuilding.id, companyUserId: companyView.id },
    });
    await prisma.companyUserBuildingAccess.create({
      data: { buildingId: allowedBuilding.id, companyUserId: companyExport.id },
    });

    gssToken = await login("/auth/gss/login", gssUser.email);
    companyViewToken = await login("/auth/company/login", companyView.email);
    companyExportToken = await login("/auth/company/login", companyExport.email);
    foreignExportToken = await login("/auth/company/login", foreignExport.email);
  });

  afterAll(async () => {
    await app?.close();
  });

  it("separates report viewing from export requests", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server)
      .get("/company/reports")
      .set("Authorization", `Bearer ${companyViewToken}`)
      .expect(200);
    await request(server)
      .post("/company/reports/export")
      .set("Authorization", `Bearer ${companyViewToken}`)
      .send({ reportType: ReportType.COMPANY_SUMMARY, format: ReportFileFormat.CSV })
      .expect(403);
  });

  it("rejects cross-company and construction-site/building scope requests", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    for (const filters of [
      { companyId: companyBId },
      { areaId: areaBId },
      { buildingId: otherBuildingId },
      { buildingId: foreignBuildingId },
    ]) {
      await request(server)
        .post("/company/reports/export")
        .set("Authorization", `Bearer ${companyExportToken}`)
        .send({ filters, format: ReportFileFormat.CSV, reportType: ReportType.SENSOR_HISTORY })
        .expect(403);
    }
    await request(server)
      .post("/company/reports/export")
      .set("Authorization", `Bearer ${companyExportToken}`)
      .send({
        filters: { from: "2026-07-22T00:00:00.000Z", to: "2026-07-21T00:00:00.000Z" },
        format: ReportFileFormat.CSV,
        reportType: ReportType.SENSOR_HISTORY,
      })
      .expect(400);
    await request(server)
      .post("/company/reports/export")
      .set("Authorization", `Bearer ${companyExportToken}`)
      .send({ format: ReportFileFormat.CSV, reportType: "unsupported" })
      .expect(400);
  });

  it("allows a scoped Company request and a global GSS request through separate endpoints", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const companyResponse = await request(server)
      .post("/company/reports/export")
      .set("Authorization", `Bearer ${companyExportToken}`)
      .send({
        filters: { buildingId: allowedBuildingId },
        format: ReportFileFormat.CSV,
        reportType: ReportType.SENSOR_HISTORY,
      })
      .expect(201);
    expect(companyResponse.body).toMatchObject({
      buildingId: allowedBuildingId,
      companyId: companyAId,
      reportType: ReportType.SENSOR_HISTORY,
      status: "PENDING",
    });
    expect(companyResponse.body.exports).toEqual([]);

    const gssResponse = await request(server)
      .post("/admin/reports/export")
      .set("Authorization", `Bearer ${gssToken}`)
      .send({
        filters: { companyId: companyAId },
        format: ReportFileFormat.XLSX,
        reportType: ReportType.COMPANY_SUMMARY,
      })
      .expect(201);
    expect(gssResponse.body.companyId).toBe(companyAId);
    await request(server)
      .get(`/company/reports/${gssResponse.body.id as string}`)
      .set("Authorization", `Bearer ${companyExportToken}`)
      .expect(404);
    await request(server)
      .get(`/admin/reports/${companyResponse.body.id as string}`)
      .set("Authorization", `Bearer ${companyExportToken}`)
      .expect(403);
  });

  it("processes every approved report type and claims a job once", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const companyCases: Array<{ reportType: ReportType; filters?: Record<string, string> }> = [
      { reportType: ReportType.COMPANY_SUMMARY },
      {
        filters: {
          areaId: (
            await prisma.constructionBuilding.findUniqueOrThrow({
              where: { id: allowedBuildingId },
            })
          ).areaId,
        },
        reportType: ReportType.SITE_SUMMARY,
      },
      { filters: { buildingId: allowedBuildingId }, reportType: ReportType.BUILDING_SUMMARY },
      { filters: { buildingId: allowedBuildingId }, reportType: ReportType.DEVICE_INVENTORY },
      {
        filters: { buildingId: allowedBuildingId },
        reportType: ReportType.DEVICE_ASSIGNMENT_HISTORY,
      },
      { filters: { buildingId: allowedBuildingId }, reportType: ReportType.GATEWAY_STATUS_HISTORY },
      { filters: { buildingId: allowedBuildingId }, reportType: ReportType.NODE_STATUS_HISTORY },
      { filters: { buildingId: allowedBuildingId }, reportType: ReportType.SENSOR_HISTORY },
      { filters: { buildingId: allowedBuildingId }, reportType: ReportType.ALARM_HISTORY },
      { filters: { buildingId: allowedBuildingId }, reportType: ReportType.MQTT_COMMAND_HISTORY },
    ];
    for (const item of companyCases) {
      const response = await request(server)
        .post("/company/reports/export")
        .set("Authorization", `Bearer ${companyExportToken}`)
        .send({ filters: item.filters, format: ReportFileFormat.CSV, reportType: item.reportType })
        .expect(201);
      const [first, second] = await Promise.all([
        processor.processJob(response.body.id as string),
        processor.processJob(response.body.id as string),
      ]);
      expect([first.status, second.status]).toContain("COMPLETED");
      const job = await prisma.reportJob.findUniqueOrThrow({
        include: { exports: true },
        where: { id: response.body.id as string },
      });
      expect(job.status).toBe("COMPLETED");
      expect(job.exports).toHaveLength(1);
    }

    for (const reportType of [ReportType.USER_ACTIVITY, ReportType.AUDIT_LOG]) {
      const response = await request(server)
        .post("/admin/reports/export")
        .set("Authorization", `Bearer ${gssToken}`)
        .send({ format: ReportFileFormat.XLSX, reportType })
        .expect(201);
      const result = await processor.processJob(response.body.id as string);
      expect(result.status).toBe("COMPLETED");
    }
  });

  it("records a sanitized failure and does not retry a terminal job implicitly", async () => {
    const job = await prisma.reportJob.create({
      data: {
        companyId: companyAId,
        filters: {
          format: ReportFileFormat.CSV,
          from: "not-a-date",
          password: "do-not-store-in-error",
        },
        reportType: ReportType.SENSOR_HISTORY,
        requestedById: companyAId,
        requestedByType: "COMPANY_USER",
        scopeSnapshot: {
          access: "company",
          allowedBuildingIds: [allowedBuildingId],
          companyId: companyAId,
        },
      },
    });
    const result = await processor.processJob(job.id);
    expect(result.status).toBe("FAILED");
    const failed = await prisma.reportJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(failed.status).toBe("FAILED");
    expect(failed.errorMessage).not.toContain("do-not-store-in-error");
    expect((await processor.processJob(job.id)).status).toBe("FAILED");
  });

  it("creates a download audit and rejects expired files without exposing metadata", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const jobResponse = await request(server)
      .post("/company/reports/export")
      .set("Authorization", `Bearer ${companyExportToken}`)
      .send({
        filters: { buildingId: allowedBuildingId },
        format: ReportFileFormat.CSV,
        reportType: ReportType.SENSOR_HISTORY,
      })
      .expect(201);
    const jobId = jobResponse.body.id as string;
    await generation.markProcessing(jobId);
    expect((await prisma.reportJob.findUniqueOrThrow({ where: { id: jobId } })).status).toBe(
      "PROCESSING",
    );
    const reportExport = await generation.complete(jobId, {
      content: Buffer.from("node,value\n1,42\n"),
      contentType: "text/csv",
      expiresAt: new Date(Date.now() + 60_000),
      fileName: "sensor-report.csv",
      format: ReportFileFormat.CSV,
    });
    expect((await prisma.reportJob.findUniqueOrThrow({ where: { id: jobId } })).status).toBe(
      "COMPLETED",
    );

    const download = await request(server)
      .get(`/company/reports/exports/${reportExport.id}/download`)
      .set("Authorization", `Bearer ${companyExportToken}`)
      .expect(200);
    expect(download.headers["content-disposition"]).toContain("sensor-report.csv");
    expect(download.text).toContain("node,value");
    expect(
      await prisma.auditLog.count({
        where: { action: "report-export.download", entityId: reportExport.id },
      }),
    ).toBe(1);

    await prisma.reportExport.update({
      data: { expiresAt: new Date(Date.now() - 1_000) },
      where: { id: reportExport.id },
    });
    const expired = await request(server)
      .get(`/company/reports/exports/${reportExport.id}/download`)
      .set("Authorization", `Bearer ${companyExportToken}`)
      .expect(404);
    expect(expired.text).not.toContain("sensor-report.csv");

    expect(await cleanup.cleanupExpired(10)).toBe(1);
    expect(
      (await prisma.reportExport.findUniqueOrThrow({ where: { id: reportExport.id } }))
        .storageDeletedAt,
    ).not.toBeNull();
    expect(await cleanup.cleanupExpired(10)).toBe(0);
  });

  it("rejects inactive sessions through the existing auth layer", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server)
      .post("/auth/company/login")
      .send({ email: inactiveEmail, password: "test-password" })
      .expect(401);
  });

  it("rejects a completed export download from another company", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const job = await request(server)
      .post("/company/reports/export")
      .set("Authorization", `Bearer ${companyExportToken}`)
      .send({
        filters: { buildingId: allowedBuildingId },
        format: "CSV",
        reportType: "SENSOR_HISTORY",
      })
      .expect(201);
    await generation.markProcessing(job.body.id as string);
    const reportExport = await generation.complete(job.body.id as string, {
      content: Buffer.from("private"),
      contentType: "text/csv",
      expiresAt: new Date(Date.now() + 60_000),
      fileName: "private.csv",
      format: ReportFileFormat.CSV,
    });
    const response = await request(server)
      .get(`/company/reports/exports/${reportExport.id}/download`)
      .set("Authorization", `Bearer ${foreignExportToken}`)
      .expect(404);
    expect(response.text).not.toContain("private.csv");
  });

  async function login(path: string, email: string): Promise<string> {
    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post(path)
      .send({ email, password: "test-password" })
      .expect(201);
    return response.body.accessToken as string;
  }
});
