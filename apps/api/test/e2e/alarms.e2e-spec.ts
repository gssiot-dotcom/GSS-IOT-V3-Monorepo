import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { loadApiEnv } from "@gss-iot/config";
import { AlarmChannel, AlarmSeverity, AlarmTargetType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { hash } from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../../src/app.module";
import { configureApiApp } from "../../src/bootstrap";
import { AlarmNotificationDispatchService } from "../../src/modules/alarms/alarm-notification-dispatch.service";
import { MonitoringService } from "../../src/modules/monitoring/monitoring.service";
import { PrismaService } from "../../src/prisma/prisma.service";

describe("Phase 11/12 alarm occurrence and notification e2e", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let monitoring: MonitoringService;
  let notificationDispatch: AlarmNotificationDispatchService;
  let companyId: string;
  let areaId: string;
  let buildingId: string;
  let nodeTypeId: string;
  let gatewayId: string;
  let nodeId: string;
  let positionId: string;
  let gssToken: string;
  let companyToken: string;
  const base = process.env.MQTT_TOPIC_BASE ?? "GSSIOT/test";

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApiApp(app, loadApiEnv());
    await app.init();
    prisma = app.get(PrismaService);
    monitoring = app.get(MonitoringService);
    notificationDispatch = app.get(AlarmNotificationDispatchService);

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
    await prisma.companyUserPositionAssignment.deleteMany();
    await prisma.companyPosition.deleteMany();
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

    await seedFixture();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("counts danger readings by receivedAt interval and creates one event plus trigger", async () => {
    const { policyId } = await createRuleAndPolicy(3, 180);

    await sendDanger("12-00", "2026-07-19T12:00:00.000Z", 4.5);
    await expectCounter(policyId, 1, 1, "2026-07-19T12:03:00.000Z");

    await sendDanger("12-01", "2026-07-19T12:01:00.000Z", 4.6);
    await expectCounter(policyId, 1, 1, "2026-07-19T12:03:00.000Z");

    await sendDanger("12-03", "2026-07-19T12:03:00.000Z", 4.7);
    await expectCounter(policyId, 2, 1, "2026-07-19T12:06:00.000Z");

    await sendDanger("12-05", "2026-07-19T12:05:00.000Z", 4.8);
    await expectCounter(policyId, 2, 1, "2026-07-19T12:06:00.000Z");

    await sendDanger("12-08", "2026-07-19T12:08:00.000Z", 5);
    await expectCounter(policyId, 0, 2, "2026-07-19T12:11:00.000Z");
    expect(await prisma.alarmEvent.count()).toBe(1);
    expect(await prisma.alarmPolicyTrigger.count()).toBe(1);

    await sendDanger("12-09", "2026-07-19T12:09:00.000Z", 5.1);
    await expectCounter(policyId, 0, 2, "2026-07-19T12:11:00.000Z");

    await sendDanger("12-11", "2026-07-19T12:11:00.000Z", 5.2);
    await expectCounter(policyId, 1, 2, "2026-07-19T12:14:00.000Z");
    expect(await prisma.sensorReading.count()).toBe(7);
    expect(await prisma.gatewayCommand.count()).toBe(0);
  });

  it("deduplicates a repeated MQTT reading before counter increment", async () => {
    await resetAlarmData();
    const { policyId } = await createRuleAndPolicy(1, 0);
    const receivedAt = new Date("2026-07-19T13:00:00.000Z");
    const payload = { angle_x: 5, angle_y: 0, doorNum: "A-P11-001", msgId: "dup-danger" };
    monitoring.simulateSensorMessage(`${base}/GATE_ANG/GW-P11-0001`, payload, { receivedAt });
    monitoring.simulateSensorMessage(`${base}/GATE_ANG/GW-P11-0001`, payload, { receivedAt });
    await waitFor(() => prisma.sensorReading.count(), 1);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await prisma.alarmPolicyTrigger.count()).toBe(1);
    expect(
      await prisma.alarmCounterState.findUniqueOrThrow({
        where: { policyId_nodeId: { nodeId, policyId } },
      }),
    ).toMatchObject({ currentCount: 0, cycleNo: 2 });
  });

  it("resets pending count on safe, fault-filtered and desired-disabled readings", async () => {
    await resetAlarmData();
    const { policyId } = await createRuleAndPolicy(2, 0);

    await sendDanger("reset-1", "2026-07-19T14:00:00.000Z", 4.5);
    await expectCounter(policyId, 1, 1, "2026-07-19T14:00:00.000Z");
    monitoring.simulateSensorMessage(
      `${base}/GATE_ANG/GW-P11-0001`,
      { angle_x: 0.1, angle_y: 0, doorNum: "A-P11-001", msgId: "safe-reset" },
      { receivedAt: new Date("2026-07-19T14:01:00.000Z") },
    );
    await waitFor(() => prisma.sensorReading.count(), 2);
    await expectCounter(policyId, 0, 1, null);

    await sendDanger("reset-2", "2026-07-19T14:02:00.000Z", 4.5);
    await prisma.gatewayFaultFilterAppliedState.create({
      data: {
        applied: true,
        gatewayId,
        nodeId,
        nodeTypeId,
        status: "ACKNOWLEDGED",
      },
    });
    await sendDanger("fault-reset", "2026-07-19T14:03:00.000Z", 4.6);
    await expectCounter(policyId, 0, 1, null);

    await prisma.gatewayFaultFilterAppliedState.deleteMany();
    await sendDanger("reset-3", "2026-07-19T14:04:00.000Z", 4.5);
    await prisma.gatewayAlarmLevelApplication.create({
      data: {
        buildingId,
        configurationId: await configurationId(),
        configurationVersion: 1,
        desiredEnabled: false,
        gatewayId,
        nodeTypeId,
        updatedByType: "SYSTEM",
      },
    });
    await sendDanger("desired-disabled-reset", "2026-07-19T14:05:00.000Z", 4.7);
    await expectCounter(policyId, 0, 1, null);
  });

  it("guards rule APIs with permission and company building scope", async () => {
    await resetAlarmData();
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    await request(server)
      .post("/admin/alarm-rules")
      .set("Authorization", `Bearer ${gssToken}`)
      .send({ buildingId, nodeTypeId, severity: AlarmSeverity.DANGER })
      .expect(201);

    await request(server)
      .get(`/company/alarm-rules?buildingId=${buildingId}`)
      .set("Authorization", `Bearer ${companyToken}`)
      .expect(200)
      .expect(({ body }) => expect(body.items).toHaveLength(1));
  });

  it("dispatches in-app notifications to scoped position recipients and supports inbox read", async () => {
    await resetAlarmData();
    await createRuleAndPolicy(1, 0);
    await sendDanger("notify-1", "2026-07-19T15:00:00.000Z", 4.5);
    await waitFor(() => prisma.alarmNotification.count(), 1);
    await waitForNotificationStatus("SENT");

    const notification = await prisma.alarmNotification.findFirstOrThrow({
      include: { deliveryLogs: true },
    });
    expect(notification.status).toBe("SENT");
    expect(notification.deliveryLogs).toHaveLength(1);
    expect(notification.deliveryLogs[0]?.providerKey).toBe("in_app");

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    for (const [prefix, token] of [
      ["/company", companyToken],
      ["/admin", gssToken],
    ] as const) {
      await request(server)
        .get(`${prefix}/alarms?page=1&pageSize=50`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      await request(server)
        .get(`${prefix}/notifications?page=1&pageSize=50`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      await request(server)
        .get(`${prefix}/notifications/unread-count`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      await request(server)
        .get(`${prefix}/notifications?pageSize=5`)
        .set("Authorization", `Bearer ${token}`)
        .expect(400);
    }
    await request(server)
      .get("/company/notifications/unread-count")
      .set("Authorization", `Bearer ${companyToken}`)
      .expect(200)
      .expect(({ body }) => expect(body.unreadCount).toBe(1));

    await request(server)
      .patch(`/company/notifications/${notification.id}/read`)
      .set("Authorization", `Bearer ${companyToken}`)
      .expect(200);
    expect(
      (await prisma.alarmNotification.findUniqueOrThrow({ where: { id: notification.id } })).readAt,
    ).toBeTruthy();
  });

  it("acknowledges alarms, rejects unsafe manual resolve and auto-resolves on safe state", async () => {
    await resetAlarmData();
    await createRuleAndPolicy(1, 0);
    await sendDanger("ack-1", "2026-07-19T16:00:00.000Z", 4.5);
    await waitFor(() => prisma.alarmEvent.count(), 1);
    const event = await prisma.alarmEvent.findFirstOrThrow();
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    await request(server)
      .patch(`/company/alarms/${event.id}/acknowledge`)
      .set("Authorization", `Bearer ${companyToken}`)
      .send({ note: "seen" })
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe("ACKNOWLEDGED"));

    await request(server)
      .patch(`/company/alarms/${event.id}/resolve`)
      .set("Authorization", `Bearer ${companyToken}`)
      .send({ note: "close" })
      .expect(409);

    monitoring.simulateSensorMessage(
      `${base}/GATE_ANG/GW-P11-0001`,
      { angle_x: 0.1, angle_y: 0, doorNum: "A-P11-001", msgId: "safe-after-ack" },
      { receivedAt: new Date("2026-07-19T16:01:00.000Z") },
    );
    await waitFor(() => prisma.sensorReading.count(), 2);
    await waitForResolved(event.id);
    expect((await prisma.alarmEvent.findUniqueOrThrow({ where: { id: event.id } })).status).toBe(
      "RESOLVED",
    );
  });

  it("keeps provider retries on one notification and terminally fails the test provider", async () => {
    await resetAlarmData();
    await createRuleAndPolicy(1, 0, AlarmChannel.EMAIL, { testProvider: "retryable_failure" });
    await sendDanger("provider-1", "2026-07-19T17:00:00.000Z", 4.5);
    await waitFor(() => prisma.alarmNotification.count(), 1);
    await waitForNotificationStatus("PENDING", 1);
    const notification = await prisma.alarmNotification.findFirstOrThrow();
    expect(notification.status).toBe("PENDING");

    for (let index = 0; index < 3; index += 1) {
      await prisma.alarmNotification.update({
        data: { nextAttemptAt: new Date() },
        where: { id: notification.id },
      });
      await notificationDispatch.deliverNotification(notification.id);
    }

    const failed = await prisma.alarmNotification.findUniqueOrThrow({
      include: { deliveryLogs: true },
      where: { id: notification.id },
    });
    expect(failed.status).toBe("FAILED");
    expect(failed.deliveryLogs).toHaveLength(3);
    expect(await prisma.alarmNotification.count()).toBe(1);
  });

  async function seedFixture() {
    const permissionKeys = [
      "alarm-rules.view",
      "alarm-rules.manage",
      "alarms.view",
      "alarms.acknowledge",
      "alarms.resolve",
      "monitoring.view",
      "monitoring.realtime",
      "notifications.view",
      "notifications.manage",
    ];
    await prisma.permission.createMany({
      data: permissionKeys.map((key) => {
        const [module, action] = key.split(".") as [string, string];
        return { action, key, module, scopeType: "BOTH" };
      }),
    });
    const byKey = new Map((await prisma.permission.findMany()).map((item) => [item.key, item]));
    const passwordHash = await hash("test-password", 12);
    const gssRole = await prisma.gssRole.create({
      data: {
        key: "p11-gss",
        name: "Phase 11 GSS",
        permissions: {
          createMany: { data: permissionKeys.map((key) => ({ permissionId: byKey.get(key)!.id })) },
        },
      },
    });
    const companyRole = await prisma.companyRole.create({
      data: {
        isCompanyOwnerRole: true,
        key: "p11-company",
        name: "Phase 11 Company",
        permissions: {
          createMany: { data: permissionKeys.map((key) => ({ permissionId: byKey.get(key)!.id })) },
        },
      },
    });
    await prisma.gssAdminUser.create({
      data: { email: "p11-gss@example.com", name: "P11 GSS", passwordHash, roleId: gssRole.id },
    });
    const company = await prisma.company.create({ data: { name: "Phase 11 Company" } });
    companyId = company.id;
    const area = await prisma.constructionArea.create({
      data: { companyId, name: "Phase 11 Area" },
    });
    areaId = area.id;
    const building = await prisma.constructionBuilding.create({
      data: { areaId, companyId, title: "Phase 11 Building" },
    });
    buildingId = building.id;
    const nodeType = await prisma.nodeType.create({
      data: {
        displayName: "Angle Node",
        imageAssetKey: "angle-node.png",
        key: "angle_node",
        numericCode: 1,
      },
    });
    nodeTypeId = nodeType.id;
    const gateway = await prisma.gateway.create({
      data: { gatewayType: "NODES_GATEWAY", serialNumber: "GW-P11-0001" },
    });
    gatewayId = gateway.id;
    const node = await prisma.node.create({ data: { nodeTypeId, number: "A-P11-001" } });
    nodeId = node.id;
    await Promise.all([
      prisma.companyDeviceAssignment.create({ data: { companyId, gatewayId } }),
      prisma.companyDeviceAssignment.create({ data: { companyId, nodeId } }),
      prisma.gatewayBuildingAssignment.create({ data: { buildingId, gatewayId } }),
      prisma.nodeGatewayAssignment.create({ data: { gatewayId, nodeId } }),
    ]);
    await prisma.buildingAlarmLevelConfiguration.create({
      data: {
        buildingId,
        cautionThreshold: 1,
        companyId,
        dangerThreshold: 4,
        enabled: true,
        nodeTypeId,
        updatedByType: "SYSTEM",
        version: 1,
        warningThreshold: 2,
      },
    });
    const companyUser = await prisma.companyUser.create({
      data: {
        companyId,
        email: "p11-company@example.com",
        name: "P11 Company",
        passwordHash,
        roleId: companyRole.id,
      },
    });
    await prisma.companyUserBuildingAccess.create({
      data: { buildingId, companyUserId: companyUser.id },
    });
    const position = await prisma.companyPosition.create({
      data: { companyId, key: "site_director", name: "Site Director" },
    });
    positionId = position.id;
    await prisma.companyUserPositionAssignment.create({
      data: { buildingId, companyUserId: companyUser.id, positionId },
    });
    gssToken = await login("/auth/gss/login", "p11-gss@example.com");
    companyToken = await login("/auth/company/login", "p11-company@example.com");
  }

  async function createRuleAndPolicy(
    requiredOccurrenceCount: number,
    countIntervalSeconds: number,
    channel: AlarmChannel = AlarmChannel.IN_APP,
    channelMetadata: Record<string, unknown> = {},
  ) {
    const rule = await prisma.alarmRule.create({
      data: {
        areaId,
        buildingId,
        companyId,
        createdByType: "SYSTEM",
        nodeTypeId,
        severity: AlarmSeverity.DANGER,
        updatedByType: "SYSTEM",
      },
    });
    const policy = await prisma.alarmRecipientPolicy.create({
      data: {
        channel,
        channelKey: channel.toLowerCase(),
        channelMetadata: channelMetadata as Prisma.InputJsonValue,
        countIntervalSeconds,
        createdByType: "SYSTEM",
        positionId,
        requiredOccurrenceCount,
        ruleId: rule.id,
        targetKey: `position:${positionId}`,
        targetType: AlarmTargetType.POSITION,
        updatedByType: "SYSTEM",
      },
    });
    return { policyId: policy.id, ruleId: rule.id };
  }

  async function sendDanger(messageId: string, receivedAt: string, value: number) {
    const before = await prisma.sensorReading.count();
    monitoring.simulateSensorMessage(
      `${base}/GATE_ANG/GW-P11-0001`,
      { angle_x: value, angle_y: 0, doorNum: "A-P11-001", msgId: messageId },
      { receivedAt: new Date(receivedAt) },
    );
    await waitFor(() => prisma.sensorReading.count(), before + 1);
  }

  async function expectCounter(
    policyId: string,
    currentCount: number,
    cycleNo: number,
    nextCountAt: string | null,
  ) {
    const state = await prisma.alarmCounterState.findUniqueOrThrow({
      where: { policyId_nodeId: { nodeId, policyId } },
    });
    expect(state.currentCount).toBe(currentCount);
    expect(state.cycleNo).toBe(cycleNo);
    expect(state.nextCountAt?.toISOString() ?? null).toBe(nextCountAt);
  }

  async function resetAlarmData() {
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
    await prisma.gatewayAlarmLevelApplication.deleteMany();
  }

  async function configurationId() {
    return (
      await prisma.buildingAlarmLevelConfiguration.findUniqueOrThrow({
        where: { buildingId_nodeTypeId: { buildingId, nodeTypeId } },
      })
    ).id;
  }

  async function login(path: string, email: string): Promise<string> {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server)
      .post(path)
      .send({ email, password: "test-password" })
      .expect(201);
    return response.body.accessToken as string;
  }

  async function waitFor(query: () => Promise<number>, expected: number) {
    for (let index = 0; index < 100; index += 1) {
      if ((await query()) >= expected) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`Count did not reach ${expected}.`);
  }

  async function waitForResolved(eventId: string) {
    for (let index = 0; index < 100; index += 1) {
      const event = await prisma.alarmEvent.findUniqueOrThrow({ where: { id: eventId } });
      if (event.status === "RESOLVED") return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("Alarm event did not resolve.");
  }

  async function waitForNotificationStatus(status: string, minimumAttempts = 0) {
    for (let index = 0; index < 100; index += 1) {
      const notification = await prisma.alarmNotification.findFirst();
      if (notification?.status === status && notification.attemptCount >= minimumAttempts) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`Alarm notification did not reach ${status}.`);
  }
});
