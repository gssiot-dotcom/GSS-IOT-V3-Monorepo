import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { loadApiEnv } from "@gss-iot/config";
import { GatewayCommandStatus, SensorReadingStatus } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AppModule } from "../../src/app.module";
import { configureApiApp } from "../../src/bootstrap";
import { MonitoringService } from "../../src/modules/monitoring/monitoring.service";
import { SecurityOfficeAlarmService } from "../../src/modules/security-office-alarm/security-office-alarm.service";
import { PrismaService } from "../../src/prisma/prisma.service";

describe("security-office gateway alarm linkage e2e", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let monitoring: MonitoringService;
  let securityOffice: SecurityOfficeAlarmService;
  let siteAreaId: string;
  let siteBuildingId: string;
  let doorNodeTypeId: string;
  let siteGatewayId: string;
  let officeGatewayId: string;
  let otherAreaOfficeGatewayId: string;
  let doorNodeId: string;
  let messageSequence = 0;
  const base = process.env.MQTT_TOPIC_BASE ?? "GSSIOT/test";

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app, loadApiEnv());
    await app.init();
    prisma = app.get(PrismaService);
    monitoring = app.get(MonitoringService);
    securityOffice = app.get(SecurityOfficeAlarmService);
    await seedFixture();
  });

  afterAll(async () => {
    await securityOffice?.whenIdle();
    await app?.close();
  });

  beforeEach(async () => {
    await securityOffice.whenIdle();
    await prisma.gatewayAlarmLevelApplication.deleteMany();
    await prisma.latestNodeState.deleteMany();
    await prisma.gatewayCommand.deleteMany();
  });

  it("rings the office gateway of the same site once and clears it when the site is safe", async () => {
    await sendDoor(1);
    const [activation] = await waitForOfficeCommands(1);
    expect(activation!.payload).toEqual({
      alarmActive: true,
      alertLevel: 3,
      cmd: 3,
      requestId: activation!.id,
    });
    expect(activation!.requesterType).toBe("SYSTEM");
    expect(activation!.requesterId).toBeNull();
    expect(activation!.topic).toBe(`${base}/GATE_SUB/GRM22JU22PGW-SO-OFFICE`);
    await waitForStatus(activation!.id, GatewayCommandStatus.ACKNOWLEDGED);

    // Repeated unsafe readings must not re-ring: the guard may have silenced the device.
    await sendDoor(1);
    await sendDoor(1);
    await settle();
    expect(await officeCommands()).toHaveLength(1);

    await sendDoor(0);
    const commands = await waitForOfficeCommands(2);
    expect(commands[1]!.payload).toEqual({
      alarmActive: false,
      alertLevel: 0,
      cmd: 3,
      requestId: commands[1]!.id,
    });

    await sendDoor(0);
    await settle();
    expect(await officeCommands()).toHaveLength(2);

    expect(
      await prisma.gatewayCommand.count({ where: { gatewayId: otherAreaOfficeGatewayId } }),
    ).toBe(0);
    expect(await prisma.gatewayCommand.count({ where: { gatewayId: siteGatewayId } })).toBe(0);
    expect(
      await prisma.auditLog.count({
        where: { action: "gateway-command.create", entityId: activation!.id },
      }),
    ).toBe(1);
  });

  it("does not ring when the site gateway alarm for the node type is disabled", async () => {
    const configuration = await prisma.buildingAlarmLevelConfiguration.findUniqueOrThrow({
      where: {
        buildingId_nodeTypeId: { buildingId: siteBuildingId, nodeTypeId: doorNodeTypeId },
      },
    });
    await prisma.gatewayAlarmLevelApplication.create({
      data: {
        buildingId: siteBuildingId,
        configurationId: configuration.id,
        configurationVersion: configuration.version,
        desiredEnabled: false,
        gatewayId: siteGatewayId,
        nodeTypeId: doorNodeTypeId,
        updatedByType: "SYSTEM",
      },
    });

    await sendDoor(1);
    await settle();
    expect(await officeCommands()).toHaveLength(0);
  });

  it("keeps ringing while the alarming node is offline instead of treating silence as safe", async () => {
    await sendDoor(1);
    await waitForOfficeCommands(1);

    await prisma.latestNodeState.update({
      data: { status: SensorReadingStatus.OFFLINE },
      where: { nodeId: doorNodeId },
    });
    const result = await securityOffice.syncArea(siteAreaId);
    expect(result.desired).toEqual({ alarmActive: true, alertLevel: 3 });
    expect(result.gateways).toEqual([
      { commandId: null, decision: "already-commanded", gatewayId: officeGatewayId },
    ]);
    expect(await officeCommands()).toHaveLength(1);
  });

  it("supersedes an unacknowledged command when the site state changes", async () => {
    await sendDoor(1);
    const [activation] = await waitForOfficeCommands(1);
    await waitForStatus(activation!.id, GatewayCommandStatus.ACKNOWLEDGED);
    // Simulate a gateway that never acknowledged the activation.
    await prisma.gatewayCommand.update({
      data: { acknowledgedAt: null, activeKey: "active", status: GatewayCommandStatus.SENT },
      where: { id: activation!.id },
    });

    await sendDoor(0);
    const commands = await waitForOfficeCommands(2);
    const superseded = await prisma.gatewayCommand.findUniqueOrThrow({
      where: { id: activation!.id },
    });
    expect(superseded.status).toBe(GatewayCommandStatus.CANCELLED);
    expect(superseded.activeKey).toBe(superseded.id);
    expect(superseded.failureReason).toBe("Superseded by a newer security-office alarm state.");
    expect(commands[1]!.payload).toMatchObject({ alarmActive: false, alertLevel: 0 });
  });

  it("reconciles configuration changes through the periodic sweep", async () => {
    await sendDoor(1);
    await waitForOfficeCommands(1);

    await prisma.latestNodeState.update({
      data: { faultFiltered: true },
      where: { nodeId: doorNodeId },
    });
    expect(await securityOffice.sweep()).toBe(2);
    const commands = await officeCommands();
    expect(commands).toHaveLength(2);
    expect(commands[1]!.payload).toMatchObject({ alarmActive: false, alertLevel: 0 });
    expect(
      await prisma.gatewayCommand.count({ where: { gatewayId: otherAreaOfficeGatewayId } }),
    ).toBe(0);
  });

  async function seedFixture() {
    const company = await prisma.company.create({ data: { name: "Security Office Company" } });
    const siteArea = await prisma.constructionArea.create({
      data: { companyId: company.id, name: "Security Office Site" },
    });
    siteAreaId = siteArea.id;
    const otherArea = await prisma.constructionArea.create({
      data: { companyId: company.id, name: "Unrelated Site" },
    });
    const [siteBuilding, officeBuilding, otherBuilding] = await Promise.all([
      prisma.constructionBuilding.create({
        data: { areaId: siteArea.id, companyId: company.id, title: "Tower 101" },
      }),
      prisma.constructionBuilding.create({
        data: { areaId: siteArea.id, companyId: company.id, title: "Guard House" },
      }),
      prisma.constructionBuilding.create({
        data: { areaId: otherArea.id, companyId: company.id, title: "Other Tower" },
      }),
    ]);
    siteBuildingId = siteBuilding.id;
    const doorNodeType = await prisma.nodeType.create({
      data: {
        displayName: "Door Node",
        imageAssetKey: "door-node.png",
        key: "door_node",
        numericCode: 0,
      },
    });
    doorNodeTypeId = doorNodeType.id;
    const [siteGateway, officeGateway, otherOfficeGateway] = await Promise.all([
      prisma.gateway.create({
        data: { gatewayType: "NODES_GATEWAY", serialNumber: "GW-SO-SITE" },
      }),
      prisma.gateway.create({
        data: { gatewayType: "SECURITY_OFFICE_GATEWAY", serialNumber: "GW-SO-OFFICE" },
      }),
      prisma.gateway.create({
        data: { gatewayType: "SECURITY_OFFICE_GATEWAY", serialNumber: "GW-SO-OTHER" },
      }),
    ]);
    siteGatewayId = siteGateway.id;
    officeGatewayId = officeGateway.id;
    otherAreaOfficeGatewayId = otherOfficeGateway.id;
    const doorNode = await prisma.node.create({
      data: { nodeTypeId: doorNodeTypeId, number: "D-SO-001" },
    });
    doorNodeId = doorNode.id;

    await Promise.all([
      ...[siteGateway, officeGateway, otherOfficeGateway].map((gateway) =>
        prisma.companyDeviceAssignment.create({
          data: { companyId: company.id, gatewayId: gateway.id },
        }),
      ),
      prisma.companyDeviceAssignment.create({
        data: { companyId: company.id, nodeId: doorNodeId },
      }),
      prisma.gatewayBuildingAssignment.create({
        data: { buildingId: siteBuilding.id, gatewayId: siteGateway.id },
      }),
      prisma.gatewayBuildingAssignment.create({
        data: { buildingId: officeBuilding.id, gatewayId: officeGateway.id },
      }),
      prisma.gatewayBuildingAssignment.create({
        data: { buildingId: otherBuilding.id, gatewayId: otherOfficeGateway.id },
      }),
      prisma.nodeGatewayAssignment.create({
        data: { gatewayId: siteGateway.id, nodeId: doorNodeId },
      }),
      prisma.buildingAlarmLevelConfiguration.create({
        data: {
          buildingId: siteBuilding.id,
          companyId: company.id,
          enabled: true,
          nodeTypeId: doorNodeTypeId,
          updatedByType: "SYSTEM",
          version: 1,
        },
      }),
    ]);
  }

  async function sendDoor(doorChk: 0 | 1) {
    const before = await prisma.sensorReading.count();
    messageSequence += 1;
    monitoring.simulateSensorMessage(`${base}/GATE_PUB/GRM22JU22PGW-SO-SITE`, {
      betChk: 90,
      doorChk,
      doorNum: "D-SO-001",
      msgId: `security-office-${messageSequence}`,
    });
    await waitUntil(async () => (await prisma.sensorReading.count()) > before);
  }

  async function settle() {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await securityOffice.whenIdle();
  }

  function officeCommands() {
    return prisma.gatewayCommand.findMany({
      orderBy: { createdAt: "asc" },
      where: { commandType: "WAKE_SECURITY", gatewayId: officeGatewayId },
    });
  }

  async function waitForOfficeCommands(count: number) {
    await waitUntil(async () => (await officeCommands()).length >= count);
    await securityOffice.whenIdle();
    const commands = await officeCommands();
    expect(commands).toHaveLength(count);
    return commands;
  }

  async function waitForStatus(commandId: string, status: GatewayCommandStatus) {
    await waitUntil(
      async () =>
        (await prisma.gatewayCommand.findUniqueOrThrow({ where: { id: commandId } })).status ===
        status,
    );
  }

  async function waitUntil(predicate: () => Promise<boolean>) {
    for (let index = 0; index < 150; index += 1) {
      if (await predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("Condition was not reached in time.");
  }
});
