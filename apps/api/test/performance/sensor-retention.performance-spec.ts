import { performance } from "node:perf_hooks";

import { AuditActorType, GatewayType, SensorReadingStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SensorReadingRetentionService } from "../../src/modules/monitoring/sensor-reading-retention.service";
import { PrismaService } from "../../src/prisma/prisma.service";

const TOTAL_UNREFERENCED = 100_000;
const INSERT_BATCH_SIZE = 5_000;

describe("100k SensorReading retention performance", () => {
  const prisma = new PrismaService();
  let scope: {
    areaId: string;
    buildingId: string;
    companyId: string;
    gatewayId: string;
    nodeId: string;
    nodeTypeId: string;
  };
  let referencedReadingId: string;
  let insertMs = 0;

  beforeAll(async () => {
    await prisma.$connect();
    await cleanup(prisma);
    const company = await prisma.company.create({ data: { name: "Retention Performance" } });
    const area = await prisma.constructionArea.create({
      data: { companyId: company.id, name: "Performance Site" },
    });
    const building = await prisma.constructionBuilding.create({
      data: { areaId: area.id, companyId: company.id, title: "Performance Building" },
    });
    const nodeType = await prisma.nodeType.create({
      data: {
        displayName: "Performance Door",
        imageAssetKey: "door.png",
        key: "perf_door",
        numericCode: 9901,
      },
    });
    const gateway = await prisma.gateway.create({
      data: { gatewayType: GatewayType.NODES_GATEWAY, serialNumber: "PERF-GW-001" },
    });
    const node = await prisma.node.create({
      data: { nodeTypeId: nodeType.id, number: "PERF-NODE-001" },
    });
    scope = {
      areaId: area.id,
      buildingId: building.id,
      companyId: company.id,
      gatewayId: gateway.id,
      nodeId: node.id,
      nodeTypeId: nodeType.id,
    };
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1_000);
    const start = performance.now();
    for (let offset = 0; offset < TOTAL_UNREFERENCED; offset += INSERT_BATCH_SIZE) {
      await prisma.sensorReading.createMany({
        data: Array.from({ length: INSERT_BATCH_SIZE }, (_, index) => ({
          ...scope,
          deduplicationKey: `perf-${offset + index}`,
          deduplicationSource: "performance-test",
          faultFiltered: false,
          receivedAt: new Date(old.getTime() + offset + index),
          status: SensorReadingStatus.WARNING,
          valueHash: `hash-${offset + index}`,
          values: { angle: offset + index },
        })),
      });
    }
    const referenced = await prisma.sensorReading.create({
      data: {
        ...scope,
        deduplicationKey: "perf-referenced",
        deduplicationSource: "performance-test",
        receivedAt: old,
        status: SensorReadingStatus.WARNING,
        valueHash: "hash-referenced",
        values: { angle: 1 },
      },
    });
    referencedReadingId = referenced.id;
    const position = await prisma.companyPosition.create({
      data: { companyId: company.id, key: "perf-position", name: "Performance Position" },
    });
    const rule = await prisma.alarmRule.create({
      data: {
        ...pickScope(scope),
        createdByType: AuditActorType.SYSTEM,
        severity: "WARNING",
        updatedByType: AuditActorType.SYSTEM,
      },
    });
    const policy = await prisma.alarmRecipientPolicy.create({
      data: {
        channelKey: "in_app",
        countIntervalSeconds: 1,
        createdByType: AuditActorType.SYSTEM,
        positionId: position.id,
        requiredOccurrenceCount: 1,
        ruleId: rule.id,
        targetKey: `position:${position.id}`,
        targetType: "POSITION",
        updatedByType: AuditActorType.SYSTEM,
      },
    });
    await prisma.alarmCounterState.create({
      data: {
        evaluationVersion: 1,
        firstCountedReadingId: referenced.id,
        lastCountedReadingId: referenced.id,
        nodeId: node.id,
        nodeTypeId: nodeType.id,
        policyId: policy.id,
        ruleId: rule.id,
        severity: "WARNING",
      },
    });
    insertMs = performance.now() - start;
  });

  afterAll(async () => {
    await cleanup(prisma);
    await prisma.$disconnect();
  });

  it("deletes 100k unreferenced rows in bounded batches while preserving referenced evidence", async () => {
    const service = new SensorReadingRetentionService(prisma);
    const dryRunStart = performance.now();
    await expect(service.dryRunCount()).resolves.toBe(TOTAL_UNREFERENCED);
    const dryRunMs = performance.now() - dryRunStart;

    const purgeStart = performance.now();
    let maxConcurrentQueryMs = 0;
    let lockWaitObserved = false;
    const observer = (async () => {
      while ((await prisma.sensorReading.count()) > 1) {
        const queryStart = performance.now();
        await prisma.$queryRaw`SELECT 1`;
        maxConcurrentQueryMs = Math.max(maxConcurrentQueryMs, performance.now() - queryStart);
        const waits = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
        `;
        lockWaitObserved ||= Number(waits[0]?.count ?? 0) > 0;
      }
    })();
    const result = await service.runCycle();
    await observer;
    const purgeMs = performance.now() - purgeStart;
    const throughputRowsPerSecond = Math.round((result.deleted / purgeMs) * 1_000);

    expect(result).toMatchObject({
      deleted: TOTAL_UNREFERENCED,
      dryRun: false,
      eligible: TOTAL_UNREFERENCED,
    });
    await expect(
      prisma.sensorReading.findUnique({ where: { id: referencedReadingId } }),
    ).resolves.not.toBeNull();
    await expect(prisma.sensorReading.count()).resolves.toBe(1);
    expect(maxConcurrentQueryMs).toBeLessThan(5_000);
    process.stdout.write(
      `SENSOR_RETENTION_PERFORMANCE ${JSON.stringify({
        batchSize: 1_000,
        dryRunMs: Math.round(dryRunMs),
        insertMs: Math.round(insertMs),
        lockWaitObserved,
        maxConcurrentQueryMs: Math.round(maxConcurrentQueryMs),
        purgeMs: Math.round(purgeMs),
        rows: TOTAL_UNREFERENCED + 1,
        throughputRowsPerSecond,
      })}\n`,
    );
  });
});

function pickScope(scope: {
  areaId: string;
  buildingId: string;
  companyId: string;
  nodeTypeId: string;
}) {
  return {
    areaId: scope.areaId,
    buildingId: scope.buildingId,
    companyId: scope.companyId,
    nodeTypeId: scope.nodeTypeId,
  };
}

async function cleanup(prisma: PrismaService): Promise<void> {
  await prisma.alarmCounterState.deleteMany();
  await prisma.alarmRecipientPolicy.deleteMany();
  await prisma.alarmRule.deleteMany();
  await prisma.sensorReading.deleteMany();
  await prisma.companyPosition.deleteMany();
  await prisma.node.deleteMany({ where: { number: { startsWith: "PERF-" } } });
  await prisma.gateway.deleteMany({ where: { serialNumber: { startsWith: "PERF-" } } });
  await prisma.nodeType.deleteMany({ where: { key: "perf_door" } });
  await prisma.constructionBuilding.deleteMany({ where: { title: "Performance Building" } });
  await prisma.constructionArea.deleteMany({ where: { name: "Performance Site" } });
  await prisma.company.deleteMany({ where: { name: "Retention Performance" } });
}
