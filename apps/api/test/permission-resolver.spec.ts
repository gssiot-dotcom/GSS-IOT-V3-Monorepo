import { PermissionEffect } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { AUTH_CONTEXT } from "../src/common/auth.types";
import { PermissionResolverService } from "../src/modules/rbac/permission-resolver.service";
import type { PrismaService } from "../src/prisma/prisma.service";

describe("PermissionResolverService", () => {
  it("allows a super admin even when direct permissions deny the requested key", async () => {
    const prisma = {
      gssAdminUser: {
        findUnique: vi.fn().mockResolvedValue({
          permissions: [{ effect: PermissionEffect.DENY, permission: { key: "companies.view" } }],
          role: { isSuperAdmin: true, permissions: [] },
        }),
      },
    } as unknown as PrismaService;
    const service = new PermissionResolverService(prisma);

    await expect(
      service.hasPermission(AUTH_CONTEXT.gssAdmin, "admin-1", "companies.view"),
    ).resolves.toBe(true);
  });

  it("merges role and direct allow permissions while giving direct deny precedence", async () => {
    const prisma = {
      companyUser: {
        findUnique: vi.fn().mockResolvedValue({
          permissions: [
            { effect: PermissionEffect.DENY, permission: { key: "buildings.update" } },
            { effect: PermissionEffect.ALLOW, permission: { key: "reports.view" } },
          ],
          role: {
            permissions: [
              { permission: { key: "buildings.view" } },
              { permission: { key: "buildings.update" } },
            ],
          },
        }),
      },
    } as unknown as PrismaService;
    const service = new PermissionResolverService(prisma);

    await expect(
      service.hasPermission(AUTH_CONTEXT.companyUser, "company-user-1", "buildings.view"),
    ).resolves.toBe(true);
    await expect(
      service.hasPermission(AUTH_CONTEXT.companyUser, "company-user-1", "reports.view"),
    ).resolves.toBe(true);
    await expect(
      service.hasPermission(AUTH_CONTEXT.companyUser, "company-user-1", "buildings.update"),
    ).resolves.toBe(false);
  });
});
