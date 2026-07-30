import { ArchiveEntityType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { ArchiveDomainPurgeService } from "../src/modules/archive/archive-domain-purge.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { PrivateAssetStorageService } from "../src/modules/private-assets/private-asset-storage.service";
import type { ReportStorageService } from "../src/modules/reports/report-storage.service";

describe("ArchiveDomainPurgeService company-management adapters", () => {
  it("purges an archived user while detaching immutable notification and policy evidence", async () => {
    const tx = {
      alarmNotification: { updateMany: vi.fn().mockResolvedValue({ count: 3 }) },
      alarmRecipientPolicy: {
        count: vi.fn().mockResolvedValue(0),
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      companyUser: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue({ id: "user-1" }),
      },
    };
    const service = createService(tx);

    await expect(service.purge(ArchiveEntityType.COMPANY_USER, "user-1")).resolves.toEqual({
      detachedNotifications: 3,
      detachedPolicies: 2,
      users: 1,
    });
    expect(tx.alarmNotification.updateMany).toHaveBeenCalledWith({
      data: { recipientUserId: null },
      where: { recipientUserId: "user-1" },
    });
  });

  it("fails closed when an archived position still targets an active policy", async () => {
    const tx = {
      alarmRecipientPolicy: { count: vi.fn().mockResolvedValue(1) },
      companyPosition: { findFirst: vi.fn().mockResolvedValue({ id: "position-1" }) },
    };
    const service = createService(tx);

    await expect(
      service.purge(ArchiveEntityType.COMPANY_POSITION, "position-1"),
    ).rejects.toMatchObject({
      response: { code: "PURGE_ACTIVE_DEPENDENCY" },
    });
  });

  it("purges only archived, unassigned custom roles", async () => {
    const tx = {
      companyRole: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: "role-1", isCompanyOwnerRole: false, isSystem: false }),
      },
      companyRolePermission: { deleteMany: vi.fn().mockResolvedValue({ count: 4 }) },
      companyUser: { count: vi.fn().mockResolvedValue(0) },
    };
    const service = createService(tx);

    await expect(service.purge(ArchiveEntityType.COMPANY_ROLE, "role-1")).resolves.toEqual({
      rolePermissions: 4,
      roles: 1,
    });
  });

  it.each([
    [ArchiveEntityType.COMPANY_USER, "companyUser"],
    [ArchiveEntityType.COMPANY_POSITION, "companyPosition"],
    [ArchiveEntityType.COMPANY_ROLE, "companyRole"],
  ])(
    "completes a resumed %s purge when the root was deleted before the crash",
    async (rootType, delegate) => {
      const prisma = {
        [delegate]: { findUnique: vi.fn().mockResolvedValue(null) },
      } as unknown as PrismaService;
      const service = new ArchiveDomainPurgeService(
        prisma,
        {} as PrivateAssetStorageService,
        {} as ReportStorageService,
      );

      await expect(
        service.purge(rootType, "deleted-root", undefined, {
          resume: true,
          resumeCounts: { roots: 1 },
        }),
      ).resolves.toEqual({ roots: 1 });
    },
  );

  it("rejects a direct physical purge of an active root", async () => {
    const prisma = {
      alarmNotification: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new ArchiveDomainPurgeService(
      prisma,
      {} as PrivateAssetStorageService,
      {} as ReportStorageService,
    );

    await expect(
      service.purge(ArchiveEntityType.ALARM_NOTIFICATION, "active-notification"),
    ).rejects.toMatchObject({ response: { code: "PURGE_ROOT_NOT_ARCHIVED" } });
  });
});

function createService(tx: Record<string, unknown>) {
  const prisma = {
    ...tx,
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  } as unknown as PrismaService;
  return new ArchiveDomainPurgeService(
    prisma,
    {} as PrivateAssetStorageService,
    {} as ReportStorageService,
  );
}
