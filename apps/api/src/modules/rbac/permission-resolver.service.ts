import { Inject, Injectable } from "@nestjs/common";
import { PermissionEffect } from "@prisma/client";

import { AUTH_CONTEXT, type AuthContext } from "../../common/auth.types";
import { PrismaService } from "../../prisma/prisma.service";

export interface PermissionResolution {
  isSuperAdmin: boolean;
  permissions: ReadonlySet<string>;
}

@Injectable()
export class PermissionResolverService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async hasPermission(context: AuthContext, userId: string, permission: string): Promise<boolean> {
    const resolution = await this.resolve(context, userId);
    return resolution.isSuperAdmin || resolution.permissions.has(permission);
  }

  async resolve(context: AuthContext, userId: string): Promise<PermissionResolution> {
    if (context === AUTH_CONTEXT.gssAdmin) {
      const user = await this.prisma.gssAdminUser.findUnique({
        where: { id: userId },
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
          permissions: { include: { permission: true } },
        },
      });

      if (!user) {
        return { isSuperAdmin: false, permissions: new Set() };
      }

      if (user.role.isSuperAdmin) {
        return { isSuperAdmin: true, permissions: new Set() };
      }

      return this.mergePermissions(user.role.permissions, user.permissions);
    }

    const user = await this.prisma.companyUser.findUnique({
      where: { id: userId },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        permissions: { include: { permission: true } },
      },
    });

    if (!user) {
      return { isSuperAdmin: false, permissions: new Set() };
    }

    return this.mergePermissions(user.role.permissions, user.permissions);
  }

  private mergePermissions(
    rolePermissions: Array<{ permission: { key: string } }>,
    userPermissions: Array<{ effect: PermissionEffect; permission: { key: string } }>,
  ): PermissionResolution {
    const permissions = new Set(rolePermissions.map(({ permission }) => permission.key));

    for (const { effect, permission } of userPermissions) {
      if (effect === PermissionEffect.DENY) {
        permissions.delete(permission.key);
      } else {
        permissions.add(permission.key);
      }
    }

    return { isSuperAdmin: false, permissions };
  }
}
