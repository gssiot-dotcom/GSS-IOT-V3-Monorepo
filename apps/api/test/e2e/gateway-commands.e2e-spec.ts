import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { loadApiEnv } from "@gss-iot/config";
import { hash } from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../../src/app.module";
import { configureApiApp } from "../../src/bootstrap";
import { MqttResponseHandlerService } from "../../src/modules/gateway-commands/mqtt-response-handler.service";
import { PrismaService } from "../../src/prisma/prisma.service";

describe("Phase 5 gateway command outbox e2e", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let responseHandler: MqttResponseHandlerService;
  let companyId: string;
  let foreignCompanyId: string;
  let gatewayId: string;
  let buildingId: string;
  let otherBuildingId: string;
  let nodeId: string;
  let nodeTypeId: string;
  let angleNodeTypeId: string;
  let commandTopic: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApiApp(app, loadApiEnv());
    await app.init();
    prisma = app.get(PrismaService);
    responseHandler = app.get(MqttResponseHandlerService);

    await prisma.latestNodeState.deleteMany();
    await prisma.sensorReading.deleteMany();
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

    const permissionKeys = ["mqtt-commands.view", "mqtt-commands.manage"];
    await prisma.permission.createMany({
      data: permissionKeys.map((key) => {
        const [module, action] = key.split(".") as [string, string];
        return { action, key, module, scopeType: "GSS" };
      }),
    });
    const permissions = await prisma.permission.findMany();
    const byKey = new Map(permissions.map((permission) => [permission.key, permission]));
    const passwordHash = await hash("test-password", 12);
    const [superRole, managerRole, viewRole, noneRole] = await Promise.all([
      prisma.gssRole.create({ data: { isSuperAdmin: true, key: "super", name: "Super" } }),
      prisma.gssRole.create({
        data: {
          key: "command-manager",
          name: "Command Manager",
          permissions: {
            createMany: {
              data: permissionKeys.map((key) => ({ permissionId: byKey.get(key)!.id })),
            },
          },
        },
      }),
      prisma.gssRole.create({
        data: {
          key: "command-viewer",
          name: "Command Viewer",
          permissions: { create: { permissionId: byKey.get("mqtt-commands.view")!.id } },
        },
      }),
      prisma.gssRole.create({ data: { key: "none", name: "None" } }),
    ]);
    await Promise.all([
      prisma.gssAdminUser.create({
        data: { email: "p5-super@example.com", name: "Super", passwordHash, roleId: superRole.id },
      }),
      prisma.gssAdminUser.create({
        data: {
          email: "p5-manager@example.com",
          name: "Manager",
          passwordHash,
          roleId: managerRole.id,
        },
      }),
      prisma.gssAdminUser.create({
        data: { email: "p5-view@example.com", name: "View", passwordHash, roleId: viewRole.id },
      }),
      prisma.gssAdminUser.create({
        data: { email: "p5-none@example.com", name: "None", passwordHash, roleId: noneRole.id },
      }),
      prisma.gssAdminUser.create({
        data: {
          email: "p5-deny@example.com",
          name: "Deny",
          passwordHash,
          permissions: {
            create: { effect: "DENY", permissionId: byKey.get("mqtt-commands.view")!.id },
          },
          roleId: managerRole.id,
        },
      }),
      prisma.gssAdminUser.create({
        data: {
          email: "p5-inactive@example.com",
          isActive: false,
          name: "Inactive",
          passwordHash,
          roleId: managerRole.id,
        },
      }),
    ]);

    const company = await prisma.company.create({ data: { name: "Phase 5 Company" } });
    const foreignCompany = await prisma.company.create({ data: { name: "Phase 5 Foreign" } });
    companyId = company.id;
    foreignCompanyId = foreignCompany.id;
    const area = await prisma.constructionArea.create({
      data: { companyId: company.id, name: "Phase 5 Area" },
    });
    const otherArea = await prisma.constructionArea.create({
      data: { companyId: company.id, name: "Phase 5 Other Area" },
    });
    const building = await prisma.constructionBuilding.create({
      data: { areaId: area.id, companyId: company.id, title: "Phase 5 Building" },
    });
    const otherBuilding = await prisma.constructionBuilding.create({
      data: { areaId: otherArea.id, companyId: company.id, title: "Phase 5 Other Building" },
    });
    buildingId = building.id;
    otherBuildingId = otherBuilding.id;
    const nodeType = await prisma.nodeType.create({
      data: {
        displayName: "Door Node",
        imageAssetKey: "door-node.png",
        key: "door_node",
        numericCode: 0,
      },
    });
    nodeTypeId = nodeType.id;
    const angleNodeType = await prisma.nodeType.create({
      data: {
        displayName: "Angle Node",
        imageAssetKey: "angle-node.png",
        key: "angle_node",
        numericCode: 1,
      },
    });
    angleNodeTypeId = angleNodeType.id;
    const gateway = await prisma.gateway.create({
      data: { gatewayType: "NODES_GATEWAY", serialNumber: "GW-P5-001" },
    });
    gatewayId = gateway.id;
    commandTopic = `${process.env.MQTT_TOPIC_BASE}/GATE_SUB/GRM22JU22PGW-P5-001`;
    const node = await prisma.node.create({
      data: { nodeTypeId, number: "NODE-P5-001" },
    });
    nodeId = node.id;
    await Promise.all([
      prisma.companyDeviceAssignment.create({ data: { companyId: company.id, gatewayId } }),
      prisma.companyDeviceAssignment.create({ data: { companyId: company.id, nodeId } }),
      prisma.gatewayBuildingAssignment.create({ data: { buildingId: building.id, gatewayId } }),
    ]);
  });

  afterAll(async () => {
    await app?.close();
  });

  async function login(email: string): Promise<string> {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server)
      .post("/auth/gss/login")
      .send({ email, password: "test-password" })
      .expect(201);
    return response.body.accessToken as string;
  }

  async function waitForStatus(commandId: string, status: string): Promise<void> {
    let latest = "missing";
    for (let index = 0; index < 100; index += 1) {
      const command = await prisma.gatewayCommand.findUniqueOrThrow({ where: { id: commandId } });
      latest = command.status;
      if (command.status === status) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`Command did not reach ${status}; latest status was ${latest}.`);
  }

  async function createProvisioningFixture(name: string, status: "PENDING" | "SENT" = "SENT") {
    const serialNumber = `GW-P8-${name}`;
    const gateway = await prisma.gateway.create({
      data: { gatewayType: "NODES_GATEWAY", serialNumber },
    });
    const node = await prisma.node.create({
      data: { nodeTypeId, number: `NODE-P8-${name}` },
    });
    await Promise.all([
      prisma.companyDeviceAssignment.create({ data: { companyId, gatewayId: gateway.id } }),
      prisma.companyDeviceAssignment.create({ data: { companyId, nodeId: node.id } }),
      prisma.gatewayBuildingAssignment.create({ data: { buildingId, gatewayId: gateway.id } }),
    ]);
    const command = await prisma.gatewayCommand.create({
      data: {
        commandNumber: 2,
        commandType: "REGISTER_NODES",
        correlationKey: `${serialNumber}:2`,
        expiresAt: new Date(Date.now() + 60_000),
        gatewayId: gateway.id,
        payload: { cmd: 2, nodeType: 0, nodes: [node.number], numNodes: 1 },
        requesterType: "GSS_ADMIN",
        sentAt: status === "SENT" ? new Date() : undefined,
        status,
        topic: `${process.env.MQTT_TOPIC_BASE}/GATE_SUB/GRM22JU22P${serialNumber}`,
      },
    });
    await prisma.nodeGatewayProvisioningRequest.create({
      data: {
        buildingId,
        commandId: command.id,
        companyId,
        gatewayId: gateway.id,
        items: { create: { nodeId: node.id } },
        nodeTypeId,
        requestedByType: "GSS_ADMIN",
        status,
      },
    });
    return { command, gateway, node, serialNumber };
  }

  it("allows a command manager to create, publish, acknowledge, list, and inspect commands", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const token = await login("p5-manager@example.com");

    const created = await request(server)
      .post("/admin/gateway-commands/register-nodes")
      .set("Authorization", `Bearer ${token}`)
      .send({ buildingId, gatewayId, nodeIds: [nodeId], nodeTypeId })
      .expect(201);
    expect(created.body.commandNumber).toBe(2);
    await waitForStatus(created.body.id, "ACKNOWLEDGED");
    expect(
      await prisma.nodeGatewayAssignment.count({
        where: { gatewayId, nodeId, status: "ACTIVE" },
      }),
    ).toBe(1);

    await request(server)
      .get("/admin/gateway-commands")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const detail = await request(server)
      .get(`/admin/gateway-commands/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(detail.body.status).toBe("ACKNOWLEDGED");
    expect(
      await prisma.auditLog.count({ where: { entityType: "GatewayCommand" } }),
    ).toBeGreaterThanOrEqual(2);
  });

  it("enforces view, manage, direct deny, inactive, and validation failures", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const noneToken = await login("p5-none@example.com");
    await request(server)
      .get("/admin/gateway-commands")
      .set("Authorization", `Bearer ${noneToken}`)
      .expect(403);

    const viewToken = await login("p5-view@example.com");
    await request(server)
      .post("/admin/gateway-commands/wake-security")
      .set("Authorization", `Bearer ${viewToken}`)
      .send({ alarmActive: true, alertLevel: 1, gatewayId })
      .expect(403);

    const denyToken = await login("p5-deny@example.com");
    await request(server)
      .get("/admin/gateway-commands")
      .set("Authorization", `Bearer ${denyToken}`)
      .expect(403);
    await request(server)
      .post("/auth/gss/login")
      .send({ email: "p5-inactive@example.com", password: "test-password" })
      .expect(401);

    const managerToken = await login("p5-manager@example.com");
    await request(server)
      .post("/admin/gateway-commands/wake-security")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ alarmActive: true, alertLevel: 1, gatewayId: "00000000-0000-0000-0000-000000000000" })
      .expect(404);
    await request(server)
      .post("/admin/gateway-commands/register-nodes")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ buildingId, gatewayId, nodeIds: [], nodeTypeId })
      .expect(400);
  });

  it("supports retry, cancel, expiration, and super-admin bypass", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const token = await login("p5-manager@example.com");
    const failed = await prisma.gatewayCommand.create({
      data: {
        commandNumber: 3,
        commandType: "WAKE_SECURITY",
        correlationKey: "GW-P5-001:3",
        expiresAt: new Date(Date.now() + 60_000),
        failedAt: new Date(),
        failureReason: "simulated failure",
        gatewayId,
        payload: { alarmActive: true, alertLevel: 1, cmd: 3 },
        requesterType: "GSS_ADMIN",
        status: "FAILED",
        topic: commandTopic,
      },
    });
    await request(server)
      .post(`/admin/gateway-commands/${failed.id}/retry`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    await waitForStatus(failed.id, "ACKNOWLEDGED");

    const pending = await prisma.gatewayCommand.create({
      data: {
        commandNumber: 4,
        commandType: "SET_ALARM_LEVELS",
        correlationKey: "GW-P5-001:4",
        expiresAt: new Date(Date.now() + 60_000),
        gatewayId,
        payload: { alarmEnabled: true, cmd: 4, enabled: true, nodeType: 0 },
        requesterType: "GSS_ADMIN",
        status: "PENDING",
        topic: commandTopic,
      },
    });
    await request(server)
      .post(`/admin/gateway-commands/${pending.id}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201)
      .expect(({ body }) => expect(body.status).toBe("CANCELLED"));

    await prisma.gatewayCommand.create({
      data: {
        activeKey: "active",
        commandNumber: 5,
        commandType: "SET_FAULT_FILTER",
        correlationKey: "GW-P5-001:5",
        expiresAt: new Date(Date.now() - 1_000),
        gatewayId,
        payload: { cmd: 5, nodeType: 0, nodes: ["NODE-P5-001"], numNodes: 1 },
        requesterType: "GSS_ADMIN",
        status: "PENDING",
        topic: commandTopic,
      },
    });
    await request(server)
      .post("/admin/gateway-commands/process-expired")
      .set("Authorization", `Bearer ${token}`)
      .expect(201)
      .expect(({ body }) => expect(body.expired).toBeGreaterThanOrEqual(1));

    const superToken = await login("p5-super@example.com");
    await request(server)
      .get("/admin/gateway-commands")
      .set("Authorization", `Bearer ${superToken}`)
      .expect(200);
  });

  it("keeps pending/offline provisioning from creating assignments before ACK", async () => {
    const { command, gateway, node } = await createProvisioningFixture("PENDING", "PENDING");

    expect(command.status).toBe("PENDING");
    expect(
      await prisma.nodeGatewayAssignment.count({
        where: { gatewayId: gateway.id, nodeId: node.id, status: "ACTIVE" },
      }),
    ).toBe(0);
  });

  it("marks negative register-node responses failed without creating assignments", async () => {
    const { command, gateway, node, serialNumber } = await createProvisioningFixture("NEGATIVE");

    await responseHandler.handleRawResponse(
      `${process.env.MQTT_TOPIC_BASE}/GATE_RES/GRM22JU22P${serialNumber}`,
      JSON.stringify({ cmd: 2, resp: "fail" }),
    );

    const failed = await prisma.gatewayCommand.findUniqueOrThrow({ where: { id: command.id } });
    const requestState = await prisma.nodeGatewayProvisioningRequest.findUniqueOrThrow({
      where: { commandId: command.id },
    });
    expect(failed.status).toBe("FAILED");
    expect(failed.responsePayload).toMatchObject({ cmd: 2, resp: "fail" });
    expect(requestState.status).toBe("FAILED");
    expect(
      await prisma.nodeGatewayAssignment.count({
        where: { gatewayId: gateway.id, nodeId: node.id, status: "ACTIVE" },
      }),
    ).toBe(0);
  });

  it("handles expiry, cancellation, late ACK, and duplicate ACK without duplicate assignments", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const token = await login("p5-manager@example.com");
    const expired = await createProvisioningFixture("EXPIRED", "PENDING");
    await prisma.gatewayCommand.update({
      where: { id: expired.command.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    await request(server)
      .post("/admin/gateway-commands/process-expired")
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    expect(await prisma.nodeGatewayAssignment.count({ where: { nodeId: expired.node.id } })).toBe(
      0,
    );
    await responseHandler.handleRawResponse(
      `${process.env.MQTT_TOPIC_BASE}/GATE_RES/GRM22JU22P${expired.serialNumber}`,
      JSON.stringify({ cmd: 2, resp: "success" }),
    );
    expect(await prisma.nodeGatewayAssignment.count({ where: { nodeId: expired.node.id } })).toBe(
      0,
    );

    const cancelled = await createProvisioningFixture("CANCELLED", "PENDING");
    await request(server)
      .post(`/admin/gateway-commands/${cancelled.command.id}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    await responseHandler.handleRawResponse(
      `${process.env.MQTT_TOPIC_BASE}/GATE_RES/GRM22JU22P${cancelled.serialNumber}`,
      JSON.stringify({ cmd: 2, resp: "success" }),
    );
    expect(await prisma.nodeGatewayAssignment.count({ where: { nodeId: cancelled.node.id } })).toBe(
      0,
    );

    const duplicate = await createProvisioningFixture("DUPLICATE");
    const topic = `${process.env.MQTT_TOPIC_BASE}/GATE_RES/GRM22JU22P${duplicate.serialNumber}`;
    await responseHandler.handleRawResponse(topic, JSON.stringify({ cmd: 2, resp: "success" }));
    await responseHandler.handleRawResponse(topic, JSON.stringify({ cmd: 2, resp: "success" }));
    expect(await prisma.nodeGatewayAssignment.count({ where: { nodeId: duplicate.node.id } })).toBe(
      1,
    );
  });

  it("retries failed provisioning without duplicating assignments", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const token = await login("p5-manager@example.com");
    const fixture = await createProvisioningFixture("RETRY");
    await responseHandler.handleRawResponse(
      `${process.env.MQTT_TOPIC_BASE}/GATE_RES/GRM22JU22P${fixture.serialNumber}`,
      JSON.stringify({ cmd: 2, status: "failed" }),
    );

    await request(server)
      .post(`/admin/gateway-commands/${fixture.command.id}/retry`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    await waitForStatus(fixture.command.id, "ACKNOWLEDGED");
    expect(
      await prisma.nodeGatewayAssignment.count({
        where: { gatewayId: fixture.gateway.id, nodeId: fixture.node.id, status: "ACTIVE" },
      }),
    ).toBe(1);
  });

  it("rejects cross-company, wrong-building, mixed-type, and already-assigned provisioning", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const token = await login("p5-manager@example.com");
    const gateway = await prisma.gateway.create({
      data: { gatewayType: "NODES_GATEWAY", serialNumber: "GW-P8-VALIDATION" },
    });
    await Promise.all([
      prisma.companyDeviceAssignment.create({ data: { companyId, gatewayId: gateway.id } }),
      prisma.gatewayBuildingAssignment.create({ data: { buildingId, gatewayId: gateway.id } }),
    ]);
    const foreignNode = await prisma.node.create({
      data: { nodeTypeId, number: "NODE-P8-FOREIGN" },
    });
    const angleNode = await prisma.node.create({
      data: { nodeTypeId: angleNodeTypeId, number: "NODE-P8-ANGLE" },
    });
    const assignedNode = await prisma.node.create({
      data: { nodeTypeId, number: "NODE-P8-ASSIGNED" },
    });
    await Promise.all([
      prisma.companyDeviceAssignment.create({
        data: { companyId: foreignCompanyId, nodeId: foreignNode.id },
      }),
      prisma.companyDeviceAssignment.create({ data: { companyId, nodeId: angleNode.id } }),
      prisma.companyDeviceAssignment.create({ data: { companyId, nodeId: assignedNode.id } }),
      prisma.nodeGatewayAssignment.create({ data: { gatewayId, nodeId: assignedNode.id } }),
    ]);

    await request(server)
      .post("/admin/gateway-commands/register-nodes")
      .set("Authorization", `Bearer ${token}`)
      .send({ buildingId, gatewayId: gateway.id, nodeIds: [foreignNode.id], nodeTypeId })
      .expect(400);
    await request(server)
      .post("/admin/gateway-commands/register-nodes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        buildingId: otherBuildingId,
        gatewayId: gateway.id,
        nodeIds: [angleNode.id],
        nodeTypeId: angleNodeTypeId,
      })
      .expect(400);
    await request(server)
      .post("/admin/gateway-commands/register-nodes")
      .set("Authorization", `Bearer ${token}`)
      .send({ buildingId, gatewayId: gateway.id, nodeIds: [angleNode.id], nodeTypeId })
      .expect(400);
    await request(server)
      .post("/admin/gateway-commands/register-nodes")
      .set("Authorization", `Bearer ${token}`)
      .send({ buildingId, gatewayId: gateway.id, nodeIds: [assignedNode.id], nodeTypeId })
      .expect(409);
  });
});
