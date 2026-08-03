import {
  AssignmentStatus,
  CompanyStatus,
  DeviceLifecycleStatus,
  SensorReadingStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { MonitoringRealtimeService } from "../src/modules/monitoring/monitoring-realtime.service";
import {
  NODE_OFFLINE_TIMEOUT_MS,
  NodeOfflineEvaluatorService,
  nodeOfflineCutoff,
} from "../src/modules/monitoring/node-offline-evaluator.service";
import type { PrismaService } from "../src/prisma/prisma.service";

const now = new Date("2026-08-03T12:00:00.000Z");

describe("NodeOfflineEvaluatorService", () => {
  it("uses an exact five-minute received-time boundary", () => {
    const cutoff = nodeOfflineCutoff(now);
    expect(NODE_OFFLINE_TIMEOUT_MS).toBe(300_000);
    expect(cutoff.toISOString()).toBe("2026-08-03T11:55:00.000Z");
    expect(new Date("2026-08-03T11:55:00.001Z") > cutoff).toBe(true);
    expect(new Date("2026-08-03T11:55:00.000Z") <= cutoff).toBe(true);
  });

  it.each([
    SensorReadingStatus.SAFE,
    SensorReadingStatus.CAUTION,
    SensorReadingStatus.WARNING,
    SensorReadingStatus.DANGER,
    SensorReadingStatus.UNCONFIGURED,
  ])("transitions stale %s state while preserving its evidence and values", async (status) => {
    const candidate = offlineCandidate(status);
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const { realtime, service } = evaluator([candidate], updateMany);

    await expect(service.runCycle(now)).resolves.toMatchObject({ transitioned: 1 });

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: SensorReadingStatus.OFFLINE, updatedAt: now },
        where: expect.objectContaining({
          id: candidate.id,
          lastSeenAt: { lte: nodeOfflineCutoff(now) },
          status: { not: SensorReadingStatus.OFFLINE },
        }),
      }),
    );
    expect(realtime.emitNodeState).toHaveBeenCalledWith(
      expect.objectContaining({
        classificationEvidence: candidate.classificationEvidence,
        faultFiltered: true,
        lastSeenAt: candidate.lastSeenAt.toISOString(),
        status: "offline",
        values: candidate.values,
      }),
    );
  });

  it("does not emit when a new reading wins the conditional update race", async () => {
    const { realtime, service } = evaluator(
      [offlineCandidate(SensorReadingStatus.SAFE)],
      vi.fn().mockResolvedValue({ count: 0 }),
    );

    await expect(service.runCycle(now)).resolves.toMatchObject({ transitioned: 0 });
    expect(realtime.emitNodeState).not.toHaveBeenCalled();
  });

  it("does no work when stale rows are already offline or operationally ineligible", async () => {
    const updateMany = vi.fn();
    const { realtime, service } = evaluator([], updateMany);

    await expect(service.runCycle(now)).resolves.toMatchObject({ candidates: 0, transitioned: 0 });
    expect(updateMany).not.toHaveBeenCalled();
    expect(realtime.emitNodeState).not.toHaveBeenCalled();
  });

  it("emits once across repeated cycles", async () => {
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const { realtime, service } = evaluator(
      [offlineCandidate(SensorReadingStatus.WARNING)],
      updateMany,
    );

    await service.runCycle(now);
    await service.runCycle(now);

    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(realtime.emitNodeState).toHaveBeenCalledTimes(1);
  });

  it("lets only one of two service instances win a concurrent transition", async () => {
    const candidate = offlineCandidate(SensorReadingStatus.WARNING);
    let transitioned = false;
    const updateMany = vi.fn().mockImplementation(async () => {
      if (transitioned) return { count: 0 };
      transitioned = true;
      return { count: 1 };
    });
    const findMany = vi.fn().mockResolvedValue([candidate]);
    const prisma = { latestNodeState: { findMany, updateMany } } as unknown as PrismaService;
    const realtime = { emitNodeState: vi.fn() } as unknown as MonitoringRealtimeService;
    const first = new NodeOfflineEvaluatorService(prisma, realtime);
    const second = new NodeOfflineEvaluatorService(prisma, realtime);

    const results = await Promise.all([first.runCycle(now), second.runCycle(now)]);

    expect(results.map((result) => result.transitioned).sort()).toEqual([0, 1]);
    expect(realtime.emitNodeState).toHaveBeenCalledTimes(1);
  });

  it("finds a pre-existing stale state from a fresh service instance", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const { realtime, service } = evaluator(
      [offlineCandidate(SensorReadingStatus.CAUTION)],
      updateMany,
    );

    await expect(service.runCycle(now)).resolves.toMatchObject({ transitioned: 1 });
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(realtime.emitNodeState).toHaveBeenCalledTimes(1);
  });

  it("uses bounded candidates and repeats operational eligibility in the winning update", async () => {
    const candidate = offlineCandidate(SensorReadingStatus.DANGER);
    const findMany = vi.fn().mockResolvedValue([candidate]);
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const realtime = { emitNodeState: vi.fn() } as unknown as MonitoringRealtimeService;
    const prisma = { latestNodeState: { findMany, updateMany } } as unknown as PrismaService;
    const service = new NodeOfflineEvaluatorService(prisma, realtime);

    await service.runCycle(now);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 250,
        where: expect.objectContaining({
          gateway: expect.objectContaining({
            buildingAssignments: {
              some: expect.objectContaining({ status: AssignmentStatus.ACTIVE }),
            },
            companyAssignments: {
              some: expect.objectContaining({ status: AssignmentStatus.ACTIVE }),
            },
            status: DeviceLifecycleStatus.ACTIVE,
          }),
          lastSeenAt: { lte: nodeOfflineCutoff(now) },
          node: expect.objectContaining({
            companyAssignments: {
              some: expect.objectContaining({ status: AssignmentStatus.ACTIVE }),
            },
            gatewayAssignments: { some: { status: AssignmentStatus.ACTIVE } },
            status: DeviceLifecycleStatus.ACTIVE,
          }),
          status: { not: SensorReadingStatus.OFFLINE },
        }),
      }),
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          area: expect.objectContaining({
            deletedAt: null,
            id: candidate.areaId,
            status: CompanyStatus.ACTIVE,
          }),
          building: expect.objectContaining({
            companyId: candidate.companyId,
            deletedAt: null,
            id: candidate.buildingId,
          }),
          company: expect.objectContaining({
            deletedAt: null,
            id: candidate.companyId,
            status: CompanyStatus.ACTIVE,
          }),
          gateway: expect.objectContaining({ id: candidate.gatewayId }),
          node: expect.objectContaining({ id: candidate.nodeId }),
        }),
      }),
    );
  });
});

function evaluator(candidates: unknown[], updateMany: ReturnType<typeof vi.fn>) {
  const prisma = {
    latestNodeState: { findMany: vi.fn().mockResolvedValue(candidates), updateMany },
  } as unknown as PrismaService;
  const realtime = { emitNodeState: vi.fn() } as unknown as MonitoringRealtimeService;
  return { realtime, service: new NodeOfflineEvaluatorService(prisma, realtime) };
}

function offlineCandidate(status: SensorReadingStatus) {
  return {
    areaId: "area-1",
    building: { id: "building-1", title: "Tower A" },
    buildingId: "building-1",
    classificationEvidence: { classification: status.toLowerCase() },
    companyId: "company-1",
    faultFiltered: true,
    gateway: { id: "gateway-1", serialNumber: "GW-001" },
    gatewayId: "gateway-1",
    id: `state-${status}`,
    lastSeenAt: new Date("2026-08-03T11:54:59.000Z"),
    node: { id: "node-1", installedLocation: "Floor 2", number: "100" },
    nodeId: "node-1",
    nodeType: {
      displayName: "Angle Node",
      id: "node-type-1",
      imageAssetKey: "angle-node.png",
      key: "angle_node",
      numericCode: 1,
    },
    nodeTypeId: "node-type-1",
    status,
    updatedAt: new Date("2026-08-03T11:54:59.000Z"),
    values: { angleX: 2.5, angleY: -1.25 },
  };
}
