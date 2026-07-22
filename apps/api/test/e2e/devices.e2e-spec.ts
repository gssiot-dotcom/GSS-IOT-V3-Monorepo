import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { loadApiEnv } from "@gss-iot/config";
import { hash } from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../../src/app.module";
import { configureApiApp } from "../../src/bootstrap";
import { PrismaService } from "../../src/prisma/prisma.service";

describe("Phase 4 device inventory e2e", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let allowedAreaId: string;
  let allowedBuildingId: string;
  let sameCompanyOtherAreaId: string;
  let sameCompanyOtherBuildingId: string;
  let foreignBuildingId: string;
  let companyAId: string;
  let companyBId: string;
  let doorNodeTypeId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApiApp(app, loadApiEnv());
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
    await prisma.auditLog.deleteMany();
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

    const permissionKeys = [
      "company-devices.view",
      "devices.view",
      "gateways.assign",
      "gateways.create",
      "gateways.delete",
      "gateways.update",
      "gateways.view",
      "gateway-node-connections.view",
      "nodes.assign",
      "nodes.create",
      "nodes.delete",
      "nodes.update",
      "nodes.view",
    ];
    await prisma.permission.createMany({
      data: permissionKeys.map((key) => {
        const [module, action] = key.split(".") as [string, string];
        return {
          action,
          key,
          module,
          scopeType:
            key.startsWith("company-") || key.startsWith("gateway-node") ? "COMPANY" : "GSS",
        };
      }),
    });
    const permissions = await prisma.permission.findMany();
    const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission]));
    const gssPermissionIds = [
      "devices.view",
      "gateways.assign",
      "gateways.create",
      "gateways.delete",
      "gateways.update",
      "gateways.view",
      "nodes.assign",
      "nodes.create",
      "nodes.delete",
      "nodes.update",
      "nodes.view",
    ].map((key) => permissionByKey.get(key)!.id);
    const companyPermissionIds = ["company-devices.view", "gateway-node-connections.view"].map(
      (key) => permissionByKey.get(key)!.id,
    );

    const [superRole, deviceRole, noPermissionRole, companyRole] = await Promise.all([
      prisma.gssRole.create({ data: { isSuperAdmin: true, key: "super", name: "Super" } }),
      prisma.gssRole.create({
        data: {
          key: "device-manager",
          name: "Device Manager",
          permissions: {
            createMany: { data: gssPermissionIds.map((permissionId) => ({ permissionId })) },
          },
        },
      }),
      prisma.gssRole.create({ data: { key: "none", name: "None" } }),
      prisma.companyRole.create({
        data: {
          key: "scoped-company",
          name: "Scoped Company",
          permissions: {
            createMany: { data: companyPermissionIds.map((permissionId) => ({ permissionId })) },
          },
        },
      }),
    ]);
    const noPermissionCompanyRole = await prisma.companyRole.create({
      data: { key: "company-none", name: "Company None" },
    });
    const passwordHash = await hash("test-password", 12);
    await Promise.all([
      prisma.gssAdminUser.create({
        data: {
          email: "phase4-super@example.com",
          name: "Super",
          passwordHash,
          roleId: superRole.id,
        },
      }),
      prisma.gssAdminUser.create({
        data: {
          email: "phase4-device@example.com",
          name: "Device Manager",
          passwordHash,
          roleId: deviceRole.id,
        },
      }),
      prisma.gssAdminUser.create({
        data: {
          email: "phase4-none@example.com",
          name: "No Permission",
          passwordHash,
          roleId: noPermissionRole.id,
        },
      }),
    ]);

    const [companyA, companyB] = await Promise.all([
      prisma.company.create({ data: { name: "Phase 4 Company A" } }),
      prisma.company.create({ data: { name: "Phase 4 Company B" } }),
    ]);
    companyAId = companyA.id;
    companyBId = companyB.id;
    const [allowedArea, otherArea, foreignArea] = await Promise.all([
      prisma.constructionArea.create({ data: { companyId: companyA.id, name: "Allowed Area" } }),
      prisma.constructionArea.create({ data: { companyId: companyA.id, name: "Other Area" } }),
      prisma.constructionArea.create({ data: { companyId: companyB.id, name: "Foreign Area" } }),
    ]);
    allowedAreaId = allowedArea.id;
    sameCompanyOtherAreaId = otherArea.id;
    const [allowedBuilding, otherBuilding, foreignBuilding] = await Promise.all([
      prisma.constructionBuilding.create({
        data: { areaId: allowedArea.id, companyId: companyA.id, title: "Allowed Building" },
      }),
      prisma.constructionBuilding.create({
        data: { areaId: otherArea.id, companyId: companyA.id, title: "Other Building" },
      }),
      prisma.constructionBuilding.create({
        data: { areaId: foreignArea.id, companyId: companyB.id, title: "Foreign Building" },
      }),
    ]);
    allowedBuildingId = allowedBuilding.id;
    sameCompanyOtherBuildingId = otherBuilding.id;
    foreignBuildingId = foreignBuilding.id;

    const scopedUser = await prisma.companyUser.create({
      data: {
        companyId: companyA.id,
        email: "phase4-scoped@example.com",
        name: "Scoped",
        passwordHash,
        roleId: companyRole.id,
      },
    });
    await Promise.all([
      prisma.companyUserAreaAccess.create({
        data: { areaId: allowedArea.id, companyUserId: scopedUser.id },
      }),
      prisma.companyUserBuildingAccess.create({
        data: { buildingId: allowedBuilding.id, companyUserId: scopedUser.id },
      }),
      prisma.companyUser.create({
        data: {
          companyId: companyA.id,
          email: "phase4-company-none@example.com",
          name: "Company No Permission",
          passwordHash,
          roleId: noPermissionCompanyRole.id,
        },
      }),
      prisma.companyUser.create({
        data: {
          companyId: companyA.id,
          email: "phase4-deny@example.com",
          name: "Direct Deny",
          passwordHash,
          permissions: {
            create: {
              effect: "DENY",
              permissionId: permissionByKey.get("company-devices.view")!.id,
            },
          },
          roleId: companyRole.id,
        },
      }),
      prisma.companyUser.create({
        data: {
          companyId: companyA.id,
          email: "phase4-inactive@example.com",
          isActive: false,
          name: "Inactive",
          passwordHash,
          roleId: companyRole.id,
        },
      }),
    ]);

    const doorType = await prisma.nodeType.create({
      data: {
        displayName: "Door Node",
        imageAssetKey: "door-node.png",
        key: "door_node",
        numericCode: 0,
      },
    });
    doorNodeTypeId = doorType.id;
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

  it("allows an authorized GSS device manager to create and assign inventory", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const token = await login("/auth/gss/login", "phase4-device@example.com");

    const nodeTypes = await request(server)
      .get("/admin/devices/node-types")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(nodeTypes.body[0].key).toBe("door_node");

    const gateway = await request(server)
      .post("/admin/devices/gateways")
      .set("Authorization", `Bearer ${token}`)
      .send({ gatewayType: "NODES_GATEWAY", serialNumber: "GW-P4-001" })
      .expect(201);
    const node = await request(server)
      .post("/admin/devices/nodes")
      .set("Authorization", `Bearer ${token}`)
      .send({ nodeTypeId: doorNodeTypeId, number: "NODE-P4-001" })
      .expect(201);

    await request(server)
      .post(`/admin/devices/gateways/${gateway.body.id}/company-assignment`)
      .set("Authorization", `Bearer ${token}`)
      .send({ companyId: companyAId })
      .expect(201);
    const assignedGateway = await request(server)
      .post(`/admin/devices/gateways/${gateway.body.id}/building-assignment`)
      .set("Authorization", `Bearer ${token}`)
      .send({ buildingId: allowedBuildingId })
      .expect(201);
    expect(assignedGateway.body.buildingAssignments[0].buildingId).toBe(allowedBuildingId);

    await request(server)
      .post(`/admin/devices/nodes/${node.body.id}/company-assignment`)
      .set("Authorization", `Bearer ${token}`)
      .send({ companyId: companyAId })
      .expect(201);
    await request(server)
      .post(`/admin/devices/nodes/${node.body.id}/gateway-assignment`)
      .set("Authorization", `Bearer ${token}`)
      .send({ gatewayId: gateway.body.id })
      .expect(400);
    expect(
      await prisma.nodeGatewayAssignment.count({
        where: { gatewayId: gateway.body.id, nodeId: node.body.id, status: "ACTIVE" },
      }),
    ).toBe(0);
    expect(
      await prisma.auditLog.count({ where: { entityType: { in: ["Gateway", "Node"] } } }),
    ).toBeGreaterThanOrEqual(5);
  });

  it("preserves assignment history when gateways move and nodes are unassigned", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const token = await login("/auth/gss/login", "phase4-device@example.com");
    const gateway = await prisma.gateway.findUniqueOrThrow({
      where: { serialNumber: "GW-P4-001" },
    });
    const node = await prisma.node.findUniqueOrThrow({ where: { number: "NODE-P4-001" } });
    await prisma.nodeGatewayAssignment.create({ data: { gatewayId: gateway.id, nodeId: node.id } });

    await request(server)
      .post(`/admin/devices/gateways/${gateway.id}/building-assignment`)
      .set("Authorization", `Bearer ${token}`)
      .send({ buildingId: sameCompanyOtherBuildingId })
      .expect(201);
    await request(server)
      .delete(`/admin/devices/nodes/${node.id}/gateway-assignment`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(
      await prisma.gatewayBuildingAssignment.count({
        where: { gatewayId: gateway.id, status: "ACTIVE" },
      }),
    ).toBe(1);
    expect(
      await prisma.gatewayBuildingAssignment.count({
        where: { gatewayId: gateway.id, status: "ENDED" },
      }),
    ).toBe(1);
    expect(
      await prisma.nodeGatewayAssignment.count({ where: { nodeId: node.id, status: "ACTIVE" } }),
    ).toBe(0);
    expect(
      await prisma.nodeGatewayAssignment.count({ where: { nodeId: node.id, status: "ENDED" } }),
    ).toBe(1);
  });

  it("rejects missing permissions, direct deny, and inactive users", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const gssNoneToken = await login("/auth/gss/login", "phase4-none@example.com");
    await request(server)
      .get("/admin/devices/gateways")
      .set("Authorization", `Bearer ${gssNoneToken}`)
      .expect(403);

    const companyNoneToken = await login("/auth/company/login", "phase4-company-none@example.com");
    await request(server)
      .get("/company/devices")
      .set("Authorization", `Bearer ${companyNoneToken}`)
      .expect(403);

    const denyToken = await login("/auth/company/login", "phase4-deny@example.com");
    await request(server)
      .get("/company/devices")
      .set("Authorization", `Bearer ${denyToken}`)
      .expect(403);
    await request(server)
      .post("/auth/company/login")
      .send({ email: "phase4-inactive@example.com", password: "test-password" })
      .expect(401);
  });

  it("enforces company, area, and building scope for company device reads", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const token = await login("/auth/company/login", "phase4-scoped@example.com");

    await request(server)
      .get("/company/devices")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    await request(server)
      .get(`/company/areas/${allowedAreaId}/devices`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    await request(server)
      .get(`/company/buildings/${allowedBuildingId}/devices`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    await request(server)
      .get(`/company/areas/${sameCompanyOtherAreaId}/devices`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
    await request(server)
      .get(`/company/buildings/${sameCompanyOtherBuildingId}/devices`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
    await request(server)
      .get(`/company/buildings/${foreignBuildingId}/gateway-node-connections`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("rejects validation errors, cross-company assignments, and unassigned gateway-building links", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const token = await login("/auth/gss/login", "phase4-device@example.com");

    await request(server)
      .post("/admin/devices/gateways")
      .set("Authorization", `Bearer ${token}`)
      .send({ gatewayType: "bad", serialNumber: "GW-P4-BAD" })
      .expect(400);

    const unassignedGateway = await request(server)
      .post("/admin/devices/gateways")
      .set("Authorization", `Bearer ${token}`)
      .send({ gatewayType: "NODES_GATEWAY", serialNumber: "GW-P4-UNASSIGNED" })
      .expect(201);
    await request(server)
      .post(`/admin/devices/gateways/${unassignedGateway.body.id}/building-assignment`)
      .set("Authorization", `Bearer ${token}`)
      .send({ buildingId: allowedBuildingId })
      .expect(409);

    const foreignGateway = await request(server)
      .post("/admin/devices/gateways")
      .set("Authorization", `Bearer ${token}`)
      .send({ gatewayType: "NODES_GATEWAY", serialNumber: "GW-P4-FOREIGN" })
      .expect(201);
    await request(server)
      .post(`/admin/devices/gateways/${foreignGateway.body.id}/company-assignment`)
      .set("Authorization", `Bearer ${token}`)
      .send({ companyId: companyBId })
      .expect(201);
    await request(server)
      .post(`/admin/devices/gateways/${foreignGateway.body.id}/building-assignment`)
      .set("Authorization", `Bearer ${token}`)
      .send({ buildingId: allowedBuildingId })
      .expect(403);
  });

  it("allows GSS super admin bypass for Phase 4 protected endpoints", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const token = await login("/auth/gss/login", "phase4-super@example.com");

    await request(server)
      .post("/admin/devices/gateways")
      .set("Authorization", `Bearer ${token}`)
      .send({ gatewayType: "SECURITY_OFFICE_GATEWAY", serialNumber: "GW-P4-SUPER" })
      .expect(201);
  });

  it("deletes only pristine inventory and preserves every history reference", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const token = await login("/auth/gss/login", "phase4-device@example.com");

    const pristineGateway = await request(server)
      .post("/admin/devices/gateways")
      .set("Authorization", `Bearer ${token}`)
      .send({ gatewayType: "NODES_GATEWAY", serialNumber: "GW-P4-DELETE" })
      .expect(201);
    const pristineNode = await request(server)
      .post("/admin/devices/nodes")
      .set("Authorization", `Bearer ${token}`)
      .send({ nodeTypeId: doorNodeTypeId, number: "NODE-P4-DELETE" })
      .expect(201);
    const inventory = await request(server)
      .get("/admin/devices/gateways")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(
      inventory.body.find((item: { id: string }) => item.id === pristineGateway.body.id).deletion,
    ).toEqual({
      allowed: true,
      blocker: null,
    });
    await request(server)
      .delete(`/admin/devices/gateways/${pristineGateway.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    await request(server)
      .delete(`/admin/devices/nodes/${pristineNode.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(
      await prisma.auditLog.count({ where: { action: { in: ["gateway.delete", "node.delete"] } } }),
    ).toBeGreaterThanOrEqual(2);

    const currentlyAssignedGateway = await prisma.gateway.findUniqueOrThrow({
      where: { serialNumber: "GW-P4-001" },
    });
    const currentlyAssignedNode = await prisma.node.findUniqueOrThrow({
      where: { number: "NODE-P4-001" },
    });
    await request(server)
      .delete(`/admin/devices/gateways/${currentlyAssignedGateway.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(409);
    await request(server)
      .delete(`/admin/devices/nodes/${currentlyAssignedNode.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(409);

    const historicalGateway = await request(server)
      .post("/admin/devices/gateways")
      .set("Authorization", `Bearer ${token}`)
      .send({ gatewayType: "NODES_GATEWAY", serialNumber: "GW-P4-HISTORY" })
      .expect(201);
    const historicalNode = await request(server)
      .post("/admin/devices/nodes")
      .set("Authorization", `Bearer ${token}`)
      .send({ nodeTypeId: doorNodeTypeId, number: "NODE-P4-HISTORY" })
      .expect(201);
    await request(server)
      .post(`/admin/devices/gateways/${historicalGateway.body.id}/company-assignment`)
      .set("Authorization", `Bearer ${token}`)
      .send({ companyId: companyAId })
      .expect(201);
    await request(server)
      .delete(`/admin/devices/gateways/${historicalGateway.body.id}/company-assignment`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    await request(server)
      .post(`/admin/devices/nodes/${historicalNode.body.id}/company-assignment`)
      .set("Authorization", `Bearer ${token}`)
      .send({ companyId: companyAId })
      .expect(201);
    await request(server)
      .delete(`/admin/devices/nodes/${historicalNode.body.id}/company-assignment`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    await request(server)
      .delete(`/admin/devices/gateways/${historicalGateway.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe("DEVICE_HISTORY_EXISTS");
        expect(body.lifecycle).toBe("INACTIVE_OR_RETIRED");
      });
    await request(server)
      .delete(`/admin/devices/nodes/${historicalNode.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(409);
    expect(
      await prisma.gateway.findUnique({ where: { id: historicalGateway.body.id } }),
    ).not.toBeNull();
    expect(await prisma.node.findUnique({ where: { id: historicalNode.body.id } })).not.toBeNull();

    const referencedGateway = await request(server)
      .post("/admin/devices/gateways")
      .set("Authorization", `Bearer ${token}`)
      .send({ gatewayType: "NODES_GATEWAY", serialNumber: "GW-P4-REFERENCED" })
      .expect(201);
    const referencedNode = await request(server)
      .post("/admin/devices/nodes")
      .set("Authorization", `Bearer ${token}`)
      .send({ nodeTypeId: doorNodeTypeId, number: "NODE-P4-REFERENCED" })
      .expect(201);
    const command = await prisma.gatewayCommand.create({
      data: {
        commandNumber: 1,
        commandType: "WAKE_SECURITY",
        correlationKey: "GW-P4-REFERENCED:1",
        expiresAt: new Date(Date.now() + 60_000),
        gatewayId: referencedGateway.body.id,
        payload: { cmd: 1 },
        requesterType: "GSS_ADMIN",
        topic: "GSSIOT/test/GATE_SUB/GW-P4-REFERENCED",
      },
    });
    const provisioning = await prisma.nodeGatewayProvisioningRequest.create({
      data: {
        buildingId: allowedBuildingId,
        commandId: command.id,
        companyId: companyAId,
        gatewayId: referencedGateway.body.id,
        nodeTypeId: doorNodeTypeId,
        requestedByType: "GSS_ADMIN",
        items: { create: { nodeId: referencedNode.body.id } },
      },
    });
    expect(provisioning.id).toBeDefined();
    await request(server)
      .delete(`/admin/devices/gateways/${referencedGateway.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(409);
    await request(server)
      .delete(`/admin/devices/nodes/${referencedNode.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(409);
    expect(await prisma.gatewayCommand.count({ where: { id: command.id } })).toBe(1);
    expect(
      await prisma.nodeGatewayProvisioningItem.count({ where: { nodeId: referencedNode.body.id } }),
    ).toBe(1);
  });

  it("keeps update and delete permissions separate", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const noPermissionToken = await login("/auth/gss/login", "phase4-none@example.com");
    await request(server)
      .delete("/admin/devices/gateways/not-authorized")
      .set("Authorization", `Bearer ${noPermissionToken}`)
      .expect(403);
    await request(server)
      .patch("/admin/devices/gateways/not-authorized")
      .set("Authorization", `Bearer ${noPermissionToken}`)
      .send({ installedLocation: "No access" })
      .expect(403);
  });

  it("creates validated bulk node batches atomically and audits the result", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const token = await login("/auth/gss/login", "phase4-device@example.com");

    const created = await request(server)
      .post("/admin/devices/nodes/bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({ input: "900001-900003, 900003, 0900004", nodeTypeId: doorNodeTypeId })
      .expect(201);
    expect(created.body.createdCount).toBe(4);
    expect(created.body.numbers).toEqual(["900001", "900002", "900003", "900004"]);
    expect(await prisma.node.count({ where: { number: { in: created.body.numbers } } })).toBe(4);
    expect(
      await prisma.auditLog.count({ where: { action: "node.bulk_create" } }),
    ).toBeGreaterThanOrEqual(1);

    await request(server)
      .post("/admin/devices/nodes/bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({ input: "900004, 900005", nodeTypeId: doorNodeTypeId })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe("NODE_NUMBER_CONFLICT");
        expect(body.conflicts).toEqual(["900004"]);
      });
    expect(await prisma.node.findUnique({ where: { number: "900005" } })).toBeNull();

    await request(server)
      .post("/admin/devices/nodes/bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({ input: "900006, descending-900008", nodeTypeId: doorNodeTypeId })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe("INVALID_NODE_NUMBER_INPUT"));
    expect(await prisma.node.findUnique({ where: { number: "900006" } })).toBeNull();

    await request(server)
      .post("/admin/devices/nodes/bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({ input: "900007", nodeTypeId: "00000000-0000-0000-0000-000000000000" })
      .expect(404);

    const noPermissionToken = await login("/auth/gss/login", "phase4-none@example.com");
    await request(server)
      .post("/admin/devices/nodes/bulk")
      .set("Authorization", `Bearer ${noPermissionToken}`)
      .send({ input: "900008", nodeTypeId: doorNodeTypeId })
      .expect(403);
  });
});
