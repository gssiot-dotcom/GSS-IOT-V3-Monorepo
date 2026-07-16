import type { AddressInfo } from "node:net";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { loadApiEnv } from "@gss-iot/config";
import { hash } from "bcrypt";
import { io as connectSocket } from "socket.io-client";
import type { Socket } from "socket.io-client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../../src/app.module";
import { configureApiApp } from "../../src/bootstrap";
import { MonitoringService } from "../../src/modules/monitoring/monitoring.service";
import { PrismaService } from "../../src/prisma/prisma.service";

describe("Phase 6 monitoring and realtime e2e", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let monitoring: MonitoringService;
  let serverUrl: string;
  let allowedBuildingId: string;
  let otherBuildingId: string;
  let foreignBuildingId: string;
  let doorNodeId: string;
  let angleNodeId: string;
  let gangformNodeId: string;
  let scopedToken: string;
  let viewOnlyToken: string;
  let noScopeToken: string;
  let foreignToken: string;
  let gssToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApiApp(app, loadApiEnv());
    await app.init();
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    serverUrl = `http://127.0.0.1:${address.port}`;
    prisma = app.get(PrismaService);
    monitoring = app.get(MonitoringService);

    await prisma.latestNodeState.deleteMany();
    await prisma.sensorReading.deleteMany();
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

    const permissionKeys = ["monitoring.view", "monitoring.realtime", "mqtt-commands.view"];
    await prisma.permission.createMany({
      data: permissionKeys.map((key) => {
        const [module, action] = key.split(".") as [string, string];
        return { action, key, module, scopeType: "BOTH" };
      }),
    });
    const permissions = await prisma.permission.findMany();
    const byKey = new Map(permissions.map((permission) => [permission.key, permission]));
    const passwordHash = await hash("test-password", 12);

    const [gssRole, realtimeRole, viewOnlyRole] = await Promise.all([
      prisma.gssRole.create({
        data: {
          key: "monitoring-admin",
          name: "Monitoring Admin",
          permissions: {
            createMany: {
              data: ["monitoring.view", "monitoring.realtime"].map((key) => ({
                permissionId: byKey.get(key)!.id,
              })),
            },
          },
        },
      }),
      prisma.companyRole.create({
        data: {
          key: "monitoring-realtime",
          name: "Monitoring Realtime",
          permissions: {
            createMany: {
              data: ["monitoring.view", "monitoring.realtime"].map((key) => ({
                permissionId: byKey.get(key)!.id,
              })),
            },
          },
        },
      }),
      prisma.companyRole.create({
        data: {
          key: "monitoring-view",
          name: "Monitoring View",
          permissions: { create: { permissionId: byKey.get("monitoring.view")!.id } },
        },
      }),
    ]);

    await prisma.gssAdminUser.create({
      data: {
        email: "p6-gss@example.com",
        name: "GSS Monitoring",
        passwordHash,
        roleId: gssRole.id,
      },
    });

    const [companyA, companyB] = await Promise.all([
      prisma.company.create({ data: { name: "Phase 6 Company A" } }),
      prisma.company.create({ data: { name: "Phase 6 Company B" } }),
    ]);
    const [areaA, areaAOther, areaB] = await Promise.all([
      prisma.constructionArea.create({ data: { companyId: companyA.id, name: "Allowed Site" } }),
      prisma.constructionArea.create({ data: { companyId: companyA.id, name: "Other Site" } }),
      prisma.constructionArea.create({ data: { companyId: companyB.id, name: "Foreign Site" } }),
    ]);
    const [allowedBuilding, otherBuilding, foreignBuilding] = await Promise.all([
      prisma.constructionBuilding.create({
        data: { areaId: areaA.id, companyId: companyA.id, title: "Allowed Building" },
      }),
      prisma.constructionBuilding.create({
        data: { areaId: areaAOther.id, companyId: companyA.id, title: "Other Building" },
      }),
      prisma.constructionBuilding.create({
        data: { areaId: areaB.id, companyId: companyB.id, title: "Foreign Building" },
      }),
    ]);
    allowedBuildingId = allowedBuilding.id;
    otherBuildingId = otherBuilding.id;
    foreignBuildingId = foreignBuilding.id;

    const [doorType, angleType, gangformType] = await Promise.all([
      prisma.nodeType.create({
        data: {
          displayName: "Door Node",
          imageAssetKey: "door-node.png",
          key: "door_node",
          numericCode: 0,
        },
      }),
      prisma.nodeType.create({
        data: {
          displayName: "Angle Node",
          imageAssetKey: "angle-node.png",
          key: "angle_node",
          numericCode: 1,
        },
      }),
      prisma.nodeType.create({
        data: {
          displayName: "Gangform Node",
          imageAssetKey: "gangform.png",
          key: "gangform_node",
          numericCode: 2,
        },
      }),
    ]);
    const [gateway, otherGateway, foreignGateway] = await Promise.all([
      prisma.gateway.create({ data: { gatewayType: "NODES_GATEWAY", serialNumber: "GW-P6-0001" } }),
      prisma.gateway.create({ data: { gatewayType: "NODES_GATEWAY", serialNumber: "GW-P6-0002" } }),
      prisma.gateway.create({ data: { gatewayType: "NODES_GATEWAY", serialNumber: "GW-P6-9999" } }),
    ]);
    const [doorNode, angleNode, gangformNode, otherNode, foreignNode] = await Promise.all([
      prisma.node.create({ data: { nodeTypeId: doorType.id, number: "D-P6-001" } }),
      prisma.node.create({ data: { nodeTypeId: angleType.id, number: "A-P6-001" } }),
      prisma.node.create({ data: { nodeTypeId: gangformType.id, number: "G-P6-001" } }),
      prisma.node.create({ data: { nodeTypeId: doorType.id, number: "D-P6-OTHER" } }),
      prisma.node.create({ data: { nodeTypeId: doorType.id, number: "D-P6-FOREIGN" } }),
    ]);
    doorNodeId = doorNode.id;
    angleNodeId = angleNode.id;
    gangformNodeId = gangformNode.id;

    await Promise.all([
      prisma.companyDeviceAssignment.create({
        data: { companyId: companyA.id, gatewayId: gateway.id },
      }),
      prisma.companyDeviceAssignment.create({
        data: { companyId: companyA.id, gatewayId: otherGateway.id },
      }),
      prisma.companyDeviceAssignment.create({
        data: { companyId: companyB.id, gatewayId: foreignGateway.id },
      }),
      prisma.companyDeviceAssignment.create({
        data: { companyId: companyA.id, nodeId: doorNode.id },
      }),
      prisma.companyDeviceAssignment.create({
        data: { companyId: companyA.id, nodeId: angleNode.id },
      }),
      prisma.companyDeviceAssignment.create({
        data: { companyId: companyA.id, nodeId: gangformNode.id },
      }),
      prisma.companyDeviceAssignment.create({
        data: { companyId: companyA.id, nodeId: otherNode.id },
      }),
      prisma.companyDeviceAssignment.create({
        data: { companyId: companyB.id, nodeId: foreignNode.id },
      }),
      prisma.gatewayBuildingAssignment.create({
        data: { buildingId: allowedBuilding.id, gatewayId: gateway.id },
      }),
      prisma.gatewayBuildingAssignment.create({
        data: { buildingId: otherBuilding.id, gatewayId: otherGateway.id },
      }),
      prisma.gatewayBuildingAssignment.create({
        data: { buildingId: foreignBuilding.id, gatewayId: foreignGateway.id },
      }),
      prisma.nodeGatewayAssignment.create({ data: { gatewayId: gateway.id, nodeId: doorNode.id } }),
      prisma.nodeGatewayAssignment.create({
        data: { gatewayId: gateway.id, nodeId: angleNode.id },
      }),
      prisma.nodeGatewayAssignment.create({
        data: { gatewayId: gateway.id, nodeId: gangformNode.id },
      }),
      prisma.nodeGatewayAssignment.create({
        data: { gatewayId: otherGateway.id, nodeId: otherNode.id },
      }),
      prisma.nodeGatewayAssignment.create({
        data: { gatewayId: foreignGateway.id, nodeId: foreignNode.id },
      }),
    ]);

    const [scopedUser, viewOnlyUser, foreignUser] = await Promise.all([
      prisma.companyUser.create({
        data: {
          companyId: companyA.id,
          email: "p6-scoped@example.com",
          name: "Scoped",
          passwordHash,
          roleId: realtimeRole.id,
        },
      }),
      prisma.companyUser.create({
        data: {
          companyId: companyA.id,
          email: "p6-view-only@example.com",
          name: "View Only",
          passwordHash,
          roleId: viewOnlyRole.id,
        },
      }),
      prisma.companyUser.create({
        data: {
          companyId: companyB.id,
          email: "p6-foreign@example.com",
          name: "Foreign",
          passwordHash,
          roleId: realtimeRole.id,
        },
      }),
    ]);
    await prisma.companyUser.create({
      data: {
        companyId: companyA.id,
        email: "p6-no-scope@example.com",
        name: "No Scope",
        passwordHash,
        roleId: realtimeRole.id,
      },
    });
    await Promise.all([
      prisma.companyUserBuildingAccess.create({
        data: { buildingId: allowedBuilding.id, companyUserId: scopedUser.id },
      }),
      prisma.companyUserBuildingAccess.create({
        data: { buildingId: allowedBuilding.id, companyUserId: viewOnlyUser.id },
      }),
      prisma.companyUserBuildingAccess.create({
        data: { buildingId: foreignBuilding.id, companyUserId: foreignUser.id },
      }),
    ]);

    scopedToken = await login("/auth/company/login", "p6-scoped@example.com");
    viewOnlyToken = await login("/auth/company/login", "p6-view-only@example.com");
    noScopeToken = await login("/auth/company/login", "p6-no-scope@example.com");
    foreignToken = await login("/auth/company/login", "p6-foreign@example.com");
    gssToken = await login("/auth/gss/login", "p6-gss@example.com");
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

  async function waitForCount(model: "latestNodeState" | "sensorReading", count: number) {
    for (let index = 0; index < 100; index += 1) {
      const actual =
        model === "sensorReading"
          ? await prisma.sensorReading.count()
          : await prisma.latestNodeState.count();
      if (actual >= count) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`${model} did not reach ${count}.`);
  }

  it("persists valid readings for all three node types and upserts latest state", async () => {
    const base = process.env.MQTT_TOPIC_BASE ?? "GSSIOT/test";
    monitoring.simulateSensorMessage(`${base}/GATE_PUB/GRM22JU22PGW-P6-0001`, {
      betChk: 92,
      doorChk: 1,
      doorNum: "D-P6-001",
      msgId: "door-1",
    });
    monitoring.simulateSensorMessage(`${base}/GATE_ANG/GW-P6-0001`, {
      angle_x: 1.5,
      angle_y: 0.1,
      doorNum: "A-P6-001",
      msgId: "angle-1",
    });
    monitoring.simulateSensorMessage(`${base}/GATE_FORM/GW-P6-0001`, {
      angle_x: 2.5,
      angle_y: 0.2,
      doorNum: "G-P6-001",
      msgId: "gangform-1",
      nodeType: "vertical",
    });

    await waitForCount("sensorReading", 3);
    await waitForCount("latestNodeState", 3);
    expect(
      await prisma.latestNodeState.findUnique({ where: { nodeId: doorNodeId } }),
    ).toMatchObject({
      buildingId: allowedBuildingId,
      status: "DANGER",
    });
  });

  it("deduplicates readings with the same gateway message id", async () => {
    const base = process.env.MQTT_TOPIC_BASE ?? "GSSIOT/test";
    const before = await prisma.sensorReading.count();
    const payload = { betChk: 77, doorChk: 0, doorNum: "D-P6-001", msgId: "door-duplicate" };
    monitoring.simulateSensorMessage(`${base}/GATE_PUB/GW-P6-0001`, payload);
    monitoring.simulateSensorMessage(`${base}/GATE_PUB/GW-P6-0001`, payload);
    await waitForCount("sensorReading", before + 1);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await prisma.sensorReading.count()).toBe(before + 1);
  });

  it("enforces scope and returns building/node-type filtered monitoring data with paginated history", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    await request(server)
      .get(`/company/buildings/${allowedBuildingId}/monitoring`)
      .set("Authorization", `Bearer ${scopedToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(
          body.nodeTypes.find(
            (item: { nodeType: { key: string } }) => item.nodeType.key === "door_node",
          ).count,
        ).toBe(1);
      });

    await request(server)
      .get(`/company/buildings/${allowedBuildingId}/monitoring/door_node`)
      .set("Authorization", `Bearer ${scopedToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.states).toHaveLength(1);
        expect(body.states[0].node.id).toBe(doorNodeId);
      });

    await request(server)
      .get(`/company/buildings/${allowedBuildingId}/monitoring/angle_node`)
      .set("Authorization", `Bearer ${scopedToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.states).toHaveLength(1);
        expect(body.states[0].node.id).toBe(angleNodeId);
      });

    await request(server)
      .get(`/company/buildings/${allowedBuildingId}/monitoring/gangform_node`)
      .set("Authorization", `Bearer ${scopedToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.states[0].node.id).toBe(gangformNodeId);
      });

    await request(server)
      .get(
        `/company/buildings/${allowedBuildingId}/monitoring/door_node/nodes/${doorNodeId}/history?page=1&pageSize=1`,
      )
      .set("Authorization", `Bearer ${scopedToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toHaveLength(1);
        expect(body.pageSize).toBe(1);
        expect(body.total).toBeGreaterThanOrEqual(2);
      });

    await request(server)
      .get(`/company/buildings/${otherBuildingId}/monitoring/door_node`)
      .set("Authorization", `Bearer ${scopedToken}`)
      .expect(403);
    await request(server)
      .get(`/company/buildings/${allowedBuildingId}/monitoring/door_node`)
      .set("Authorization", `Bearer ${noScopeToken}`)
      .expect(403);
    await request(server)
      .get(`/company/buildings/${allowedBuildingId}/monitoring/door_node`)
      .set("Authorization", `Bearer ${foreignToken}`)
      .expect(403);
    await request(server)
      .get(`/admin/monitoring/buildings/${allowedBuildingId}/node-types/door_node`)
      .set("Authorization", `Bearer ${gssToken}`)
      .expect(200);
    expect(foreignBuildingId).toBeDefined();
  });

  it("authorizes Socket.IO joins and emits updates only to the correct room", async () => {
    const authorized = await connect(scopedToken);
    const viewOnly = await connect(viewOnlyToken);
    const wrongRoom = await connect(scopedToken);
    const base = process.env.MQTT_TOPIC_BASE ?? "GSSIOT/test";

    const joinAck = await emitAck(authorized, "monitoring:join", {
      buildingId: allowedBuildingId,
      nodeType: "door_node",
    });
    expect(joinAck.ok).toBe(true);
    const deniedAck = await emitAck(viewOnly, "monitoring:join", {
      buildingId: allowedBuildingId,
      nodeType: "door_node",
    });
    expect(deniedAck.ok).toBe(false);
    const wrongJoinAck = await emitAck(wrongRoom, "monitoring:join", {
      buildingId: allowedBuildingId,
      nodeType: "angle_node",
    });
    expect(wrongJoinAck.ok).toBe(true);

    const eventPromise = onceEvent(authorized, "monitoring:node-state");
    let leaked = false;
    wrongRoom.once("monitoring:node-state", () => {
      leaked = true;
    });

    monitoring.simulateSensorMessage(`${base}/GATE_PUB/GW-P6-0001`, {
      betChk: 88,
      doorChk: 0,
      doorNum: "D-P6-001",
      msgId: "door-realtime",
    });
    const event = await eventPromise;
    expect(event.state.nodeId).toBe(doorNodeId);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(leaked).toBe(false);

    authorized.disconnect();
    viewOnly.disconnect();
    wrongRoom.disconnect();
  });

  async function connect(token: string): Promise<Socket> {
    const socket = connectSocket(serverUrl, {
      auth: { token },
      forceNew: true,
      transports: ["websocket"],
    });
    await onceConnect(socket);
    return socket;
  }

  function onceConnect(socket: Socket): Promise<void> {
    return new Promise((resolve, reject) => {
      socket.once("connect", () => resolve());
      socket.once("connect_error", reject);
    });
  }

  function emitAck(
    socket: Socket,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<{ ok: boolean }> {
    return new Promise((resolve) => {
      socket.emit(event, payload, (ack: { ok: boolean }) => resolve(ack));
    });
  }

  function onceEvent(socket: Socket, event: string): Promise<{ state: { nodeId: string } }> {
    return new Promise((resolve) => {
      socket.once(event, (payload: { state: { nodeId: string } }) => resolve(payload));
    });
  }
});
