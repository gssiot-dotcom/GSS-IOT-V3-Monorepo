import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { SafeAdminPolicyService } from "../src/modules/rbac/safe-admin-policy.service";
import type { PrismaService } from "../src/prisma/prisma.service";

describe("SafeAdminPolicyService", () => {
  it("blocks deactivation of the last active GSS super admin", async () => {
    const prisma = {
      gssAdminUser: {
        count: vi.fn().mockResolvedValue(1),
        findUnique: vi.fn().mockResolvedValue({ isActive: true, role: { isSuperAdmin: true } }),
      },
    } as unknown as PrismaService;
    const service = new SafeAdminPolicyService(prisma);

    await expect(service.assertGssAdminCanBeDeactivated("admin-1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("blocks a sole company platform manager from removing their own owner role", async () => {
    const prisma = {
      companyUser: {
        count: vi.fn().mockResolvedValue(1),
        findUnique: vi.fn().mockResolvedValue({
          companyId: "company-1",
          isActive: true,
          role: { isCompanyOwnerRole: true },
        }),
      },
    } as unknown as PrismaService;
    const service = new SafeAdminPolicyService(prisma);

    await expect(
      service.assertCompanyUserCanLoseOwnerRole("user-1", "user-1"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
