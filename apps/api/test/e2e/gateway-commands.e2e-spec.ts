import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { loadApiEnv } from "@gss-iot/config";
import { hash } from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../../src/app.module";
import { configureApiApp } from "../../src/bootstrap";
import { MqttResponseHandlerService } from "../../src/modules/gateway-commands/mqtt-response-handler.service";
import { GatewayCommandsService } from "../../src/modules/gateway-commands/gateway-commands.service";
import { PrismaService } from "../../src/prisma/prisma.service";

describe("Phase 5 gateway command outbox e2e", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let responseHandler: MqttResponseHandlerService;
  let commandsService: GatewayCommandsService;
  let companyId: string;
  let foreignCompanyId: string;
  let gatewayId: string;
  let secondGatewayId: string;
  let buildingId: string;
  let otherBuildingId: string;
  let nodeId: string;
  let nodeTypeId: string;
  let angleNodeTypeId: string;
  let commandTopic: string;
  let provisioningNodeNumber = 200;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApiApp(app, loadApiEnv());
    await app.init();
    prisma = app.get(PrismaService);
    responseHandler = app.get(MqttResponseHandlerService);
    commandsService = app.get(GatewayCommandsService);

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
    await prisma.buildingPlanImage.deleteMany();
    await prisma.constructionBuilding.deleteMany();
    await prisma.constructionArea.deleteMany();
    await prisma.company.deleteMany();
    await prisma.gssAdminUserPermission.deleteMany();
    await prisma.gssRolePermission.deleteMany();
    await prisma.gssAdminUser.deleteMany();
    await prisma.gssRole.deleteMany();
    await prisma.permission.deleteMany();

    const permissionKeys = [
      "mqtt-commands.view",
      "mqtt-commands.manage",
      "alarm-levels.view",
      "alarm-levels.manage",
    ];
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
    const secondGateway = await prisma.gateway.create({
      data: { gatewayType: "NODES_GATEWAY", serialNumber: "GW-P5-002" },
    });
    gatewayId = gateway.id;
    secondGatewayId = secondGateway.id;
    commandTopic = `${process.env.MQTT_TOPIC_BASE}/GATE_SUB/GRM22JU22PGW-P5-001`;
    const node = await prisma.node.create({
      data: { nodeTypeId, number: "100" },
    });
    nodeId = node.id;
    await Promise.all([
      prisma.companyDeviceAssignment.create({ data: { companyId: company.id, gatewayId } }),
      prisma.companyDeviceAssignment.create({
        data: { companyId: company.id, gatewayId: secondGatewayId },
      }),
      prisma.companyDeviceAssignment.create({ data: { companyId: company.id, nodeId } }),
      prisma.gatewayBuildingAssignment.create({ data: { buildingId: building.id, gatewayId } }),
      prisma.gatewayBuildingAssignment.create({
        data: { buildingId: building.id, gatewayId: secondGatewayId },
      }),
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
      data: { nodeTypeId, number: String(provisioningNodeNumber++) },
    });
    await Promise.all([
      prisma.companyDeviceAssignment.create({ data: { companyId, gatewayId: gateway.id } }),
      prisma.companyDeviceAssignment.create({ data: { companyId, nodeId: node.id } }),
      prisma.gatewayBuildingAssignment.create({ data: { buildingId, gatewayId: gateway.id } }),
    ]);
    const created = await prisma.gatewayCommand.create({
      data: {
        commandNumber: 2,
        commandType: "REGISTER_NODES",
        correlationKey: `${serialNumber}:2`,
        expiresAt: new Date(Date.now() + 60_000),
        gatewayId: gateway.id,
        payload: { cmd: 2, nodeType: 0, numNodes: 1, nodes: [Number(node.number)] },
        requesterType: "GSS_ADMIN",
        sentAt: status === "SENT" ? new Date() : undefined,
        status,
        topic: `${process.env.MQTT_TOPIC_BASE}/GATE_SUB/GRM22JU22P${serialNumber}`,
      },
    });
    const command = await prisma.gatewayCommand.update({
      where: { id: created.id },
      data: {
        payload: {
          cmd: 2,
          nodeType: 0,
          numNodes: 1,
          nodes: [Number(node.number)],
          requestId: created.id,
        },
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

  function registerSuccessPayload(fixture: Awaited<ReturnType<typeof createProvisioningFixture>>) {
    return {
      cmd: 2,
      nodeType: 0,
      numNodes: 1,
      nodes: [Number(fixture.node.number)],
      requestId: fixture.command.id,
      resp: "success",
    };
  }

  it("allows a command manager to create, publish, acknowledge, list, and inspect commands", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const token = await login("p5-manager@example.com");

    const emptyList = await request(server)
      .get("/admin/gateway-commands")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(emptyList.body).toEqual({ items: [], page: 1, pageSize: 50, total: 0 });

    const created = await request(server)
      .post("/admin/gateway-commands/register-nodes")
      .set("Authorization", `Bearer ${token}`)
      .send({ buildingId, gatewayId, mode: "REPLACE", nodeIds: [nodeId], nodeTypeId })
      .expect(201);
    expect(created.body.commandNumber).toBe(2);
    expect(created.body.payload).toEqual({
      cmd: 2,
      nodeType: 0,
      numNodes: 1,
      nodes: [100],
      requestId: created.body.id,
    });
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

    const wakeSecurity = await request(server)
      .post("/admin/gateway-commands/wake-security")
      .set("Authorization", `Bearer ${token}`)
      .send({ alarmActive: true, alertLevel: 1, gatewayId })
      .expect(201);
    expect(wakeSecurity.body.payload).toMatchObject({
      cmd: 3,
      requestId: wakeSecurity.body.id,
    });
    await waitForStatus(wakeSecurity.body.id, "ACKNOWLEDGED");

    const alarmLevels = await request(server)
      .post("/admin/gateway-commands/alarm-levels")
      .set("Authorization", `Bearer ${token}`)
      .send({ alarmEnabled: true, enabled: true, gatewayId, nodeTypeId })
      .expect(201);
    expect(alarmLevels.body.payload).toMatchObject({
      cmd: 4,
      requestId: alarmLevels.body.id,
    });
    await waitForStatus(alarmLevels.body.id, "ACKNOWLEDGED");

    const faultFilter = await request(server)
      .post("/admin/gateway-commands/fault-filter")
      .set("Authorization", `Bearer ${token}`)
      .send({ gatewayId, nodeIds: [nodeId], nodeTypeId })
      .expect(201);
    expect(faultFilter.body.commandNumber).toBe(5);
    expect(faultFilter.body.payload).toEqual({
      cmd: 5,
      nodeType: 0,
      numNodes: 1,
      nodes: [100],
      requestId: faultFilter.body.id,
    });
    await waitForStatus(faultFilter.body.id, "ACKNOWLEDGED");
  });

  it("applies Phase 9 alarm levels and fault filters only after exact successful ACK", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const token = await login("p5-manager@example.com");
    const activeNodeAssignment = await prisma.nodeGatewayAssignment.findFirst({
      where: { gatewayId, nodeId, status: "ACTIVE" },
    });
    if (!activeNodeAssignment) {
      await prisma.nodeGatewayAssignment.create({ data: { gatewayId, nodeId } });
    }

    await request(server)
      .patch(`/admin/buildings/${buildingId}/alarm-levels/node-types/${angleNodeTypeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ cautionThreshold: 0, dangerThreshold: 4, enabled: true, warningThreshold: 2 })
      .expect(400);

    const alarmResponse = await request(server)
      .patch(`/admin/buildings/${buildingId}/alarm-levels/node-types/${angleNodeTypeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ cautionThreshold: 1, dangerThreshold: 4, enabled: true, warningThreshold: 2 })
      .expect(200);
    const application = alarmResponse.body.gatewayApplications.find(
      (item: { gatewayId: string }) => item.gatewayId === gatewayId,
    );
    expect(
      alarmResponse.body.gatewayApplications.filter(
        (item: { nodeTypeId: string }) => item.nodeTypeId === angleNodeTypeId,
      ),
    ).toHaveLength(2);
    expect(application.desiredEnabled).toBe(true);
    expect(application.desiredCommandId).toBeTruthy();
    const alarmCommand = await prisma.gatewayCommand.findUniqueOrThrow({
      where: { id: application.desiredCommandId },
    });
    expect(alarmCommand.payload).toMatchObject({
      alarmLevel1: 1,
      alarmLevel2: 2,
      alarmLevel3: 4,
      cmd: 4,
      requestId: alarmCommand.id,
    });
    await waitForStatus(alarmCommand.id, "ACKNOWLEDGED");
    expect(
      await prisma.gatewayAlarmLevelApplication.findFirst({
        where: { desiredCommandId: alarmCommand.id },
      }),
    ).toMatchObject({
      appliedCommandId: alarmCommand.id,
      appliedEnabled: true,
      appliedRequestId: alarmCommand.id,
      desiredStatus: "ACKNOWLEDGED",
    });

    const disabledResponse = await request(server)
      .patch(`/admin/buildings/${buildingId}/alarm-levels/gateways/${gatewayId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ enabled: false, nodeType: "angle_node" })
      .expect(200);
    const disabledApplication = disabledResponse.body.gatewayApplications.find(
      (item: { gatewayId: string; nodeTypeId: string }) =>
        item.gatewayId === gatewayId && item.nodeTypeId === angleNodeTypeId,
    );
    const untouchedApplication = disabledResponse.body.gatewayApplications.find(
      (item: { gatewayId: string; nodeTypeId: string }) =>
        item.gatewayId === secondGatewayId && item.nodeTypeId === angleNodeTypeId,
    );
    expect(disabledApplication).toMatchObject({
      appliedEnabled: true,
      desiredEnabled: false,
    });
    expect(untouchedApplication).toMatchObject({ desiredEnabled: true });
    const disableCommand = await prisma.gatewayCommand.findUniqueOrThrow({
      where: { id: disabledApplication.desiredCommandId },
    });
    expect(disableCommand.payload).toEqual({
      alarmEnabled: false,
      cmd: 4,
      enabled: false,
      nodeType: 1,
      requestId: disableCommand.id,
    });
    expect(
      await prisma.buildingAlarmLevelConfiguration.findUniqueOrThrow({
        where: { buildingId_nodeTypeId: { buildingId, nodeTypeId: angleNodeTypeId } },
      }),
    ).toMatchObject({
      cautionThreshold: 1,
      dangerThreshold: 4,
      warningThreshold: 2,
    });
    await waitForStatus(disableCommand.id, "ACKNOWLEDGED");
    expect(
      await prisma.gatewayAlarmLevelApplication.findFirst({
        where: { desiredCommandId: disableCommand.id },
      }),
    ).toMatchObject({
      appliedCommandId: disableCommand.id,
      appliedEnabled: false,
      desiredEnabled: false,
      desiredStatus: "ACKNOWLEDGED",
    });

    const reenabledResponse = await request(server)
      .patch(`/admin/buildings/${buildingId}/alarm-levels/gateways/${gatewayId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ enabled: true, nodeType: "angle_node" })
      .expect(200);
    const reenabledApplication = reenabledResponse.body.gatewayApplications.find(
      (item: { gatewayId: string; nodeTypeId: string }) =>
        item.gatewayId === gatewayId && item.nodeTypeId === angleNodeTypeId,
    );
    const reenableCommand = await prisma.gatewayCommand.findUniqueOrThrow({
      where: { id: reenabledApplication.desiredCommandId },
    });
    expect(reenableCommand.payload).toMatchObject({
      alarmEnabled: true,
      alarmLevel1: 1,
      alarmLevel2: 2,
      alarmLevel3: 4,
      cmd: 4,
      enabled: true,
      nodeType: 1,
      requestId: reenableCommand.id,
    });
    await waitForStatus(reenableCommand.id, "ACKNOWLEDGED");
    expect(
      await prisma.gatewayAlarmLevelApplication.findFirst({
        where: { desiredCommandId: reenableCommand.id },
      }),
    ).toMatchObject({ appliedEnabled: true, desiredEnabled: true });

    const doorSaveResponse = await request(server)
      .patch(`/admin/buildings/${buildingId}/alarm-levels/node-types/${nodeTypeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ enabled: true })
      .expect(200);
    const doorSaveApplication = doorSaveResponse.body.gatewayApplications.find(
      (item: { gatewayId: string; nodeTypeId: string }) =>
        item.gatewayId === gatewayId && item.nodeTypeId === nodeTypeId,
    );
    await waitForStatus(doorSaveApplication.desiredCommandId, "ACKNOWLEDGED");
    const doorDisableResponse = await request(server)
      .patch(`/admin/buildings/${buildingId}/alarm-levels/gateways/${gatewayId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ enabled: false, nodeType: "door_node" })
      .expect(200);
    const doorApplication = doorDisableResponse.body.gatewayApplications.find(
      (item: { gatewayId: string; nodeTypeId: string }) =>
        item.gatewayId === gatewayId && item.nodeTypeId === nodeTypeId,
    );
    const doorDisableCommand = await prisma.gatewayCommand.findUniqueOrThrow({
      where: { id: doorApplication.desiredCommandId },
    });
    expect(doorDisableCommand.payload).toEqual({
      alarmEnabled: false,
      cmd: 4,
      enabled: true,
      nodeType: 0,
      requestId: doorDisableCommand.id,
    });
    await waitForStatus(doorDisableCommand.id, "ACKNOWLEDGED");

    await request(server)
      .patch(`/admin/buildings/${buildingId}/alarm-levels/gateways/${gatewayId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ enabled: false, nodeType: "not_a_node" })
      .expect(400);

    const filterResponse = await request(server)
      .patch(`/admin/buildings/${buildingId}/alarm-levels/fault-filters`)
      .set("Authorization", `Bearer ${token}`)
      .send({ gatewayId, nodeIds: [nodeId], nodeTypeId })
      .expect(200);
    const desired = filterResponse.body.gateways
      .flatMap(
        (group: { nodeTypes: Array<{ nodes: Array<{ desiredCommandId: string | null }> }> }) =>
          group.nodeTypes.flatMap(
            (nodeType: { nodes: Array<{ desiredCommandId: string | null }> }) => nodeType.nodes,
          ),
      )
      .find((item: { desiredCommandId: string | null }) => item.desiredCommandId);
    expect(desired.desiredCommandId).toBeTruthy();
    const filterCommand = await prisma.gatewayCommand.findUniqueOrThrow({
      where: { id: desired.desiredCommandId },
    });
    expect(filterCommand.payload).toEqual({
      cmd: 5,
      nodeType: 0,
      numNodes: 1,
      nodes: [100],
      requestId: filterCommand.id,
    });
    await waitForStatus(filterCommand.id, "ACKNOWLEDGED");
    expect(
      await prisma.gatewayFaultFilterAppliedState.findUnique({
        where: {
          gatewayId_nodeTypeId_nodeId: {
            gatewayId,
            nodeId,
            nodeTypeId,
          },
        },
      }),
    ).toMatchObject({
      applied: true,
      appliedCommandId: filterCommand.id,
      appliedRequestId: filterCommand.id,
      status: "ACKNOWLEDGED",
    });

    const auditBefore = await prisma.auditLog.count({
      where: { action: "fault-filter.apply", entityId: filterCommand.id },
    });
    await responseHandler.handleRawResponse(
      `${process.env.MQTT_TOPIC_BASE}/GATE_RES/GRM22JU22PGW-P5-001`,
      JSON.stringify({
        cmd: 5,
        nodeType: 0,
        nodes: [100],
        numNodes: 1,
        requestId: filterCommand.id,
        resp: "success",
      }),
    );
    expect(
      await prisma.auditLog.count({
        where: { action: "fault-filter.apply", entityId: filterCommand.id },
      }),
    ).toBe(auditBefore);
  });

  it("returns partial per-gateway alarm-level fan-out status", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const token = await login("p5-manager@example.com");
    const blockedGateway = await prisma.gateway.create({
      data: { gatewayType: "NODES_GATEWAY", serialNumber: "GW-P5-PARTIAL" },
    });
    await Promise.all([
      prisma.companyDeviceAssignment.create({
        data: { companyId, gatewayId: blockedGateway.id },
      }),
      prisma.gatewayBuildingAssignment.create({
        data: { buildingId, gatewayId: blockedGateway.id },
      }),
    ]);
    const blocker = await prisma.gatewayCommand.create({
      data: {
        commandNumber: 4,
        commandType: "SET_ALARM_LEVELS",
        correlationKey: "GW-P5-PARTIAL:4",
        expiresAt: new Date(Date.now() + 60_000),
        gatewayId: blockedGateway.id,
        payload: { alarmEnabled: true, cmd: 4, enabled: true, nodeType: 1 },
        requesterType: "GSS_ADMIN",
        sentAt: new Date(),
        status: "SENT",
        topic: `${process.env.MQTT_TOPIC_BASE}/GATE_SUB/GRM22JU22PGW-P5-PARTIAL`,
      },
    });

    const response = await request(server)
      .patch(`/admin/buildings/${buildingId}/alarm-levels/node-types/${angleNodeTypeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ cautionThreshold: 1.5, dangerThreshold: 5, enabled: true, warningThreshold: 3 })
      .expect(200);
    const blockedApplication = response.body.gatewayApplications.find(
      (item: { gatewayId: string; nodeTypeId: string }) =>
        item.gatewayId === blockedGateway.id && item.nodeTypeId === angleNodeTypeId,
    );
    const appliedApplication = response.body.gatewayApplications.find(
      (item: { gatewayId: string; nodeTypeId: string }) =>
        item.gatewayId === gatewayId && item.nodeTypeId === angleNodeTypeId,
    );
    expect(blockedApplication).toMatchObject({
      desiredCommandId: null,
      desiredEnabled: true,
      desiredStatus: "FAILED",
    });
    expect(blockedApplication.failureReason).toBeTruthy();
    expect(appliedApplication.desiredCommandId).toBeTruthy();
    expect(appliedApplication.desiredStatus).not.toBe("FAILED");

    await prisma.gatewayCommand.update({
      data: { activeKey: blocker.id, cancelledAt: new Date(), status: "CANCELLED" },
      where: { id: blocker.id },
    });
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
      .get("/admin/gateway-commands/mqtt-status")
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
      .send({ buildingId, gatewayId, mode: "REPLACE", nodeIds: [], nodeTypeId })
      .expect(400);
  });

  it("returns sanitized protected MQTT status for GSS command viewers", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const viewToken = await login("p5-view@example.com");

    const status = await request(server)
      .get("/admin/gateway-commands/mqtt-status")
      .set("Authorization", `Bearer ${viewToken}`)
      .expect(200);

    expect(status.body).toMatchObject({
      brokerHost: expect.any(String),
      clientId: expect.any(String),
      connected: false,
      enabled: false,
      subscribedTopicFilters: expect.any(Array),
    });
    expect(status.body).not.toHaveProperty("username");
    expect(status.body).not.toHaveProperty("password");
    expect(JSON.stringify(status.body)).not.toContain(process.env.MQTT_PASSWORD ?? "secret");
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
    const retried = await prisma.gatewayCommand.findUniqueOrThrow({ where: { id: failed.id } });
    expect(retried.payload).toMatchObject({ cmd: 3, requestId: failed.id });

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
        payload: { cmd: 5, nodeType: 0, numNodes: 1, nodes: [100] },
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

  it("correlates exact requestId success and failure without gateway/cmd fallback", async () => {
    const exact = await createProvisioningFixture("REQUEST-ID-SUCCESS");
    await responseHandler.handleRawResponse(
      `${process.env.MQTT_TOPIC_BASE}/GATE_RES/GRM22JU22P${exact.serialNumber}`,
      JSON.stringify(registerSuccessPayload(exact)),
    );
    expect(
      await prisma.gatewayCommand.findUniqueOrThrow({ where: { id: exact.command.id } }),
    ).toMatchObject({ status: "ACKNOWLEDGED" });
    expect(await prisma.nodeGatewayAssignment.count({ where: { nodeId: exact.node.id } })).toBe(1);

    const failed = await createProvisioningFixture("REQUEST-ID-FAILURE");
    await responseHandler.handleRawResponse(
      `${process.env.MQTT_TOPIC_BASE}/GATE_RES/GRM22JU22P${failed.serialNumber}`,
      JSON.stringify({ cmd: 2, requestId: failed.command.id, resp: "fail" }),
    );
    expect(
      await prisma.gatewayCommand.findUniqueOrThrow({ where: { id: failed.command.id } }),
    ).toMatchObject({ failureReason: "resp reported failure.", status: "FAILED" });
    expect(await prisma.nodeGatewayAssignment.count({ where: { nodeId: failed.node.id } })).toBe(0);

    const unknown = await createProvisioningFixture("REQUEST-ID-UNKNOWN");
    await responseHandler.handleRawResponse(
      `${process.env.MQTT_TOPIC_BASE}/GATE_RES/GRM22JU22P${unknown.serialNumber}`,
      JSON.stringify({
        ...registerSuccessPayload(unknown),
        requestId: "00000000-0000-4000-8000-000000000001",
      }),
    );
    expect(
      await prisma.gatewayCommand.findUniqueOrThrow({ where: { id: unknown.command.id } }),
    ).toMatchObject({ status: "SENT" });

    const malformed = await createProvisioningFixture("REQUEST-ID-MALFORMED");
    await responseHandler.handleRawResponse(
      `${process.env.MQTT_TOPIC_BASE}/GATE_RES/GRM22JU22P${malformed.serialNumber}`,
      JSON.stringify({ ...registerSuccessPayload(malformed), requestId: "not-a-uuid" }),
    );
    expect(
      await prisma.gatewayCommand.findUniqueOrThrow({ where: { id: malformed.command.id } }),
    ).toMatchObject({ status: "SENT" });

    const wrongGateway = await createProvisioningFixture("REQUEST-ID-WRONG-GATEWAY");
    await responseHandler.handleRawResponse(
      `${process.env.MQTT_TOPIC_BASE}/GATE_RES/GRM22JU22POTHER-GATEWAY`,
      JSON.stringify(registerSuccessPayload(wrongGateway)),
    );
    expect(
      await prisma.gatewayCommand.findUniqueOrThrow({ where: { id: wrongGateway.command.id } }),
    ).toMatchObject({ status: "SENT" });

    const wrongCmd = await createProvisioningFixture("REQUEST-ID-WRONG-CMD");
    await responseHandler.handleRawResponse(
      `${process.env.MQTT_TOPIC_BASE}/GATE_RES/GRM22JU22P${wrongCmd.serialNumber}`,
      JSON.stringify({ cmd: 3, requestId: wrongCmd.command.id, resp: "success" }),
    );
    expect(
      await prisma.gatewayCommand.findUniqueOrThrow({ where: { id: wrongCmd.command.id } }),
    ).toMatchObject({ status: "SENT" });
  });

  it("supports unambiguous legacy cmd correlation and rejects ambiguous legacy responses", async () => {
    const legacy = await createProvisioningFixture("LEGACY-CMD");
    const legacyPayload = registerSuccessPayload(legacy);
    delete (legacyPayload as Partial<typeof legacyPayload>).requestId;
    await responseHandler.handleRawResponse(
      `${process.env.MQTT_TOPIC_BASE}/GATE_RES/GRM22JU22P${legacy.serialNumber}`,
      JSON.stringify(legacyPayload),
    );
    expect(
      await prisma.gatewayCommand.findUniqueOrThrow({ where: { id: legacy.command.id } }),
    ).toMatchObject({ status: "ACKNOWLEDGED" });

    const left = await createProvisioningFixture("LEFT-SHARED");
    const right = await createProvisioningFixture("RIGHT-SHARED");
    await responseHandler.handleRawResponse(
      `${process.env.MQTT_TOPIC_BASE}/GATE_RES/GRM22JU22PSHARED`,
      JSON.stringify({
        cmd: 2,
        nodeType: 0,
        nodes: [Number(left.node.number)],
        numNodes: 1,
        resp: "success",
      }),
    );
    const ambiguousCommands = await prisma.gatewayCommand.findMany({
      where: { id: { in: [left.command.id, right.command.id] } },
      select: { status: true },
    });
    expect(ambiguousCommands.map((command) => command.status).sort()).toEqual(["SENT", "SENT"]);
    expect(
      await prisma.nodeGatewayAssignment.count({
        where: { nodeId: { in: [left.node.id, right.node.id] } },
      }),
    ).toBe(0);
  });

  it("handles fast requestId ACK before SENT without regressing or duplicating side effects", async () => {
    const fixture = await createProvisioningFixture("FAST-ACK", "PENDING");
    await commandsService.startPublishAttempt(fixture.command.id);
    await responseHandler.handleRawResponse(
      `${process.env.MQTT_TOPIC_BASE}/GATE_RES/GRM22JU22P${fixture.serialNumber}`,
      JSON.stringify(registerSuccessPayload(fixture)),
    );
    expect(
      await prisma.gatewayCommand.findUniqueOrThrow({ where: { id: fixture.command.id } }),
    ).toMatchObject({ status: "ACKNOWLEDGED" });

    await commandsService.markSent(fixture.command.id);
    expect(
      await prisma.gatewayCommand.findUniqueOrThrow({ where: { id: fixture.command.id } }),
    ).toMatchObject({ status: "ACKNOWLEDGED" });
    expect(await prisma.nodeGatewayAssignment.count({ where: { nodeId: fixture.node.id } })).toBe(
      1,
    );
  });

  it("fails mismatched cmd=2 requestId success responses without applying assignments", async () => {
    const fixture = await createProvisioningFixture("REQUEST-ID-MISMATCH");
    await responseHandler.handleRawResponse(
      `${process.env.MQTT_TOPIC_BASE}/GATE_RES/GRM22JU22P${fixture.serialNumber}`,
      JSON.stringify({ ...registerSuccessPayload(fixture), nodes: [999] }),
    );
    expect(
      await prisma.gatewayCommand.findUniqueOrThrow({ where: { id: fixture.command.id } }),
    ).toMatchObject({ failureReason: "response_nodes_mismatch", status: "FAILED" });
    expect(await prisma.nodeGatewayAssignment.count({ where: { nodeId: fixture.node.id } })).toBe(
      0,
    );
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
      JSON.stringify(registerSuccessPayload(expired)),
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
      JSON.stringify(registerSuccessPayload(cancelled)),
    );
    expect(await prisma.nodeGatewayAssignment.count({ where: { nodeId: cancelled.node.id } })).toBe(
      0,
    );

    const duplicate = await createProvisioningFixture("DUPLICATE");
    const topic = `${process.env.MQTT_TOPIC_BASE}/GATE_RES/GRM22JU22P${duplicate.serialNumber}`;
    await responseHandler.handleRawResponse(
      topic,
      JSON.stringify(registerSuccessPayload(duplicate)),
    );
    await responseHandler.handleRawResponse(
      topic,
      JSON.stringify(registerSuccessPayload(duplicate)),
    );
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
      .send({
        buildingId,
        gatewayId: gateway.id,
        mode: "REPLACE",
        nodeIds: [foreignNode.id],
        nodeTypeId,
      })
      .expect(400);
    await request(server)
      .post("/admin/gateway-commands/register-nodes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        buildingId: otherBuildingId,
        gatewayId: gateway.id,
        mode: "REPLACE",
        nodeIds: [angleNode.id],
        nodeTypeId: angleNodeTypeId,
      })
      .expect(400);
    await request(server)
      .post("/admin/gateway-commands/register-nodes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        buildingId,
        gatewayId: gateway.id,
        mode: "REPLACE",
        nodeIds: [angleNode.id],
        nodeTypeId,
      })
      .expect(400);
    await request(server)
      .post("/admin/gateway-commands/register-nodes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        buildingId,
        gatewayId: gateway.id,
        mode: "REPLACE",
        nodeIds: [assignedNode.id],
        nodeTypeId,
      })
      .expect(409);
  });

  it("rejects invalid numeric wire node numbers before command persistence", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const token = await login("p5-manager@example.com");
    const gateway = await prisma.gateway.create({
      data: { gatewayType: "NODES_GATEWAY", serialNumber: "GW-P8-NUMERIC-VALIDATION" },
    });
    const [nonNumericNode, paddedNode, normalizedDuplicateNode] = await Promise.all([
      prisma.node.create({ data: { nodeTypeId, number: "NODE-P8-NONNUM" } }),
      prisma.node.create({ data: { nodeTypeId, number: "0101" } }),
      prisma.node.create({ data: { nodeTypeId, number: "101" } }),
    ]);
    await Promise.all([
      prisma.companyDeviceAssignment.create({ data: { companyId, gatewayId: gateway.id } }),
      prisma.gatewayBuildingAssignment.create({ data: { buildingId, gatewayId: gateway.id } }),
      prisma.companyDeviceAssignment.create({ data: { companyId, nodeId: nonNumericNode.id } }),
      prisma.companyDeviceAssignment.create({ data: { companyId, nodeId: paddedNode.id } }),
      prisma.companyDeviceAssignment.create({
        data: { companyId, nodeId: normalizedDuplicateNode.id },
      }),
    ]);

    const beforeCount = await prisma.gatewayCommand.count();
    await request(server)
      .post("/admin/gateway-commands/register-nodes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        buildingId,
        gatewayId: gateway.id,
        mode: "REPLACE",
        nodeIds: [nonNumericNode.id],
        nodeTypeId,
      })
      .expect(400);
    expect(await prisma.gatewayCommand.count()).toBe(beforeCount);

    await request(server)
      .post("/admin/gateway-commands/register-nodes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        buildingId,
        gatewayId: gateway.id,
        mode: "REPLACE",
        nodeIds: [paddedNode.id, normalizedDuplicateNode.id],
        nodeTypeId,
      })
      .expect(400);
    expect(await prisma.gatewayCommand.count()).toBe(beforeCount);
  });

  it("applies APPEND unions and REPLACE removals without touching another node type", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const token = await login("p5-manager@example.com");
    const appendGateway = await prisma.gateway.create({
      data: { gatewayType: "NODES_GATEWAY", serialNumber: "GW-P9-APPEND-REPLACE" },
    });
    await prisma.companyDeviceAssignment.create({
      data: { companyId, gatewayId: appendGateway.id },
    });
    await prisma.gatewayBuildingAssignment.create({
      data: { buildingId, gatewayId: appendGateway.id },
    });
    const existingNodes = [];
    for (const number of ["9200", "9201", "9202"]) {
      const node = await prisma.node.create({ data: { nodeTypeId, number } });
      existingNodes.push(node);
      await prisma.companyDeviceAssignment.create({ data: { companyId, nodeId: node.id } });
      await prisma.nodeGatewayAssignment.create({
        data: { gatewayId: appendGateway.id, nodeId: node.id },
      });
    }
    const [newNodeA, newNodeB, otherTypeNode] = await Promise.all([
      prisma.node.create({ data: { nodeTypeId, number: "9203" } }),
      prisma.node.create({ data: { nodeTypeId, number: "9204" } }),
      prisma.node.create({ data: { nodeTypeId: angleNodeTypeId, number: "9205" } }),
    ]);
    await prisma.companyDeviceAssignment.createMany({
      data: [newNodeA, newNodeB, otherTypeNode].map((node) => ({ companyId, nodeId: node.id })),
    });
    await prisma.nodeGatewayAssignment.create({
      data: { gatewayId: appendGateway.id, nodeId: otherTypeNode.id },
    });

    const append = await request(server)
      .post("/admin/gateway-commands/register-nodes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        buildingId,
        gatewayId: appendGateway.id,
        mode: "APPEND",
        nodeIds: [newNodeA.id, newNodeB.id],
        nodeTypeId,
      })
      .expect(201);
    expect(append.body.payload.nodes).toEqual([9200, 9201, 9202, 9203, 9204]);
    expect(append.body.provisioningRequest.mode).toBe("APPEND");
    expect(
      append.body.provisioningRequest.items.filter((item: { selected: boolean }) => item.selected),
    ).toHaveLength(2);
    await waitForStatus(append.body.id, "ACKNOWLEDGED");
    expect(
      await prisma.nodeGatewayAssignment.count({
        where: { gatewayId: appendGateway.id, node: { nodeTypeId }, status: "ACTIVE" },
      }),
    ).toBe(5);

    const replace = await request(server)
      .post("/admin/gateway-commands/register-nodes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        buildingId,
        gatewayId: appendGateway.id,
        mode: "REPLACE",
        nodeIds: [newNodeA.id, newNodeB.id],
        nodeTypeId,
      })
      .expect(201);
    expect(replace.body.payload.nodes).toEqual([9203, 9204]);
    expect(replace.body.provisioningRequest.mode).toBe("REPLACE");
    await waitForStatus(replace.body.id, "ACKNOWLEDGED");
    expect(
      await prisma.nodeGatewayAssignment.count({
        where: { gatewayId: appendGateway.id, node: { nodeTypeId }, status: "ACTIVE" },
      }),
    ).toBe(2);
    expect(
      await prisma.nodeGatewayAssignment.count({
        where: {
          gatewayId: appendGateway.id,
          node: { nodeTypeId: angleNodeTypeId },
          status: "ACTIVE",
        },
      }),
    ).toBe(1);
    expect(
      await prisma.nodeGatewayProvisioningEndedAssignment.count({
        where: { requestId: replace.body.provisioningRequest.id },
      }),
    ).toBe(3);
    expect(
      await prisma.nodeGatewayAssignment.count({
        where: {
          gatewayId: appendGateway.id,
          nodeId: { in: existingNodes.map((node) => node.id) },
          status: "ENDED",
        },
      }),
    ).toBe(3);
  });

  it("rejects a concurrent nonterminal provisioning command for the same gateway and type", async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const token = await login("p5-manager@example.com");
    const activeGateway = await prisma.gateway.findUniqueOrThrow({ where: { id: gatewayId } });
    const pendingCommand = await prisma.gatewayCommand.create({
      data: {
        commandNumber: 900,
        commandType: "REGISTER_NODES",
        correlationKey: `${activeGateway.serialNumber}:900`,
        expiresAt: new Date(Date.now() + 60_000),
        gatewayId: activeGateway.id,
        payload: { cmd: 2, nodeType: 0, nodes: [100], numNodes: 1 },
        requesterId: null,
        requesterType: "SYSTEM",
        topic: "GSSIOT/test/GATE_SUB/GRM22JU22P" + activeGateway.serialNumber,
      },
    });
    const pendingRequest = await prisma.nodeGatewayProvisioningRequest.create({
      data: {
        buildingId,
        commandId: pendingCommand.id,
        companyId,
        gatewayId: activeGateway.id,
        mode: "APPEND",
        nodeTypeId,
        requestedByType: "SYSTEM",
        items: { create: { nodeId } },
      },
    });
    expect(pendingRequest.id).toBeDefined();
    await request(server)
      .post("/admin/gateway-commands/register-nodes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        buildingId,
        gatewayId: activeGateway.id,
        mode: "APPEND",
        nodeIds: [nodeId],
        nodeTypeId,
      })
      .expect(409);
  });
});
