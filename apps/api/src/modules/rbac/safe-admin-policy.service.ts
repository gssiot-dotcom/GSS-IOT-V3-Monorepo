import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

@Injectable()
export class SafeAdminPolicyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assertGssAdminCanBeDeactivated(
    userId: string,
    executor: PrismaExecutor = this.prisma,
  ): Promise<void> {
    const user = await executor.gssAdminUser.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user?.isActive || !user.role.isSuperAdmin) {
      return;
    }

    const activeSuperAdmins = await executor.gssAdminUser.count({
      where: { isActive: true, role: { isSuperAdmin: true } },
    });

    if (activeSuperAdmins <= 1) {
      throw new ForbiddenException("The last active GSS super admin cannot be deactivated.");
    }
  }

  async assertCompanyUserCanLoseOwnerRole(
    actorUserId: string,
    targetUserId: string,
    willLoseOwnerRole = true,
    executor: PrismaExecutor = this.prisma,
  ): Promise<void> {
    if (actorUserId !== targetUserId || !willLoseOwnerRole) {
      return;
    }

    const user = await executor.companyUser.findUnique({
      where: { id: targetUserId },
      include: { role: true },
    });

    if (!user?.isActive || !user.role.isCompanyOwnerRole) {
      return;
    }

    const activeOwners = await executor.companyUser.count({
      where: { companyId: user.companyId, isActive: true, role: { isCompanyOwnerRole: true } },
    });

    if (activeOwners <= 1) {
      throw new ForbiddenException(
        "The last active company platform manager cannot remove their own owner role.",
      );
    }
  }
}
