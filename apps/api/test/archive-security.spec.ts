import { ArchiveEntityType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { AUTH_CONTEXT } from "../src/common/auth.types";
import { ArchiveJobsService } from "../src/modules/archive/archive-jobs.service";
import type { ArchiveQueryService } from "../src/modules/archive/archive-query.service";
import type { AuditLogService } from "../src/modules/audit-logs/audit-log.service";
import type { PermissionResolverService } from "../src/modules/rbac/permission-resolver.service";
import type { PrismaService } from "../src/prisma/prisma.service";

const actor = { context: AUTH_CONTEXT.gssAdmin, sub: "admin-1", tokenVersion: 0 } as const;
const request = {
  confirmation: "Archived rule",
  idempotencyKey: "f3030865-3d43-4bfa-9d31-91c8f52aa81e",
  previewHash: "a".repeat(64),
  rootId: "f3030865-3d43-4bfa-9d31-91c8f52aa81f",
  rootType: ArchiveEntityType.ALARM_RULE,
};

describe("ArchiveJobsService security", () => {
  it.each([
    [[false, true], "archive.purge"],
    [[true, false], "domain permission"],
  ])("requires purge and domain permission: %s", async (answers) => {
    const hasPermission = vi
      .fn()
      .mockResolvedValueOnce(answers[0])
      .mockResolvedValueOnce(answers[1]);
    const service = createService(hasPermission);
    await expect(service.enqueue(actor, request)).rejects.toMatchObject({ status: 403 });
  });

  it("returns the same job for an idempotent duplicate request", async () => {
    const existing = {
      id: "job-1",
      idempotencyKey: request.idempotencyKey,
      targetKey: `${request.rootType}:${request.rootId}`,
    };
    const prisma = {
      deletionJob: { findUnique: vi.fn().mockResolvedValue(existing) },
    } as unknown as PrismaService;
    const permissions = {
      hasPermission: vi.fn().mockResolvedValue(true),
    } as unknown as PermissionResolverService;
    const service = new ArchiveJobsService(
      prisma,
      {} as ArchiveQueryService,
      permissions,
      {} as AuditLogService,
    );
    await expect(service.enqueue(actor, request)).resolves.toBe(existing);
  });
});

function createService(hasPermission: ReturnType<typeof vi.fn>) {
  return new ArchiveJobsService(
    {} as PrismaService,
    {} as ArchiveQueryService,
    { hasPermission } as unknown as PermissionResolverService,
    {} as AuditLogService,
  );
}
