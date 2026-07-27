import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PermissionScopeType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import type { AuthTokenPayload } from "../../common/auth.types";
import {
  paginated,
  pageWindow,
  type PaginationQueryDto,
  type SearchPaginationQueryDto,
} from "../../common/dto/pagination.dto";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateGssRoleDto, UpdateGssRoleDto } from "./dto/gss-role.dto";

const permissionSelect = {
  action: true,
  description: true,
  id: true,
  key: true,
  module: true,
  scopeType: true,
} satisfies Prisma.PermissionSelect;

const roleSelect = {
  id: true,
  isSuperAdmin: true,
  isSystem: true,
  key: true,
  name: true,
  permissions: { select: { permission: { select: permissionSelect }, permissionId: true } },
  _count: { select: { users: true } },
} satisfies Prisma.GssRoleSelect;

@Injectable()
export class GssRoleService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
  ) {}

  async listRoles(query: PaginationQueryDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.gssRole.findMany({
        orderBy: [{ isSystem: "desc" }, { name: "asc" }, { id: "asc" }],
        select: roleSelect,
        ...pageWindow(query),
      }),
      this.prisma.gssRole.count(),
    ]);
    return paginated(
      items.map((role) => ({ ...role, deletion: this.deletionCapability(role) })),
      total,
      query,
    );
  }

  listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ module: "asc" }, { key: "asc" }],
      select: permissionSelect,
      where: { scopeType: { in: [PermissionScopeType.GSS, PermissionScopeType.BOTH] } },
    });
  }

  async listPermissionCatalog(query: SearchPaginationQueryDto) {
    const where = {
      scopeType: { in: [PermissionScopeType.GSS, PermissionScopeType.BOTH] },
      ...(query.search?.trim()
        ? {
            OR: [
              { key: { contains: query.search.trim(), mode: "insensitive" } },
              { module: { contains: query.search.trim(), mode: "insensitive" } },
              { description: { contains: query.search.trim(), mode: "insensitive" } },
            ],
          }
        : {}),
    } satisfies Prisma.PermissionWhereInput;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.permission.findMany({
        orderBy: [{ module: "asc" }, { key: "asc" }, { id: "asc" }],
        select: permissionSelect,
        where,
        ...pageWindow(query),
      }),
      this.prisma.permission.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  async createRole(actor: AuthTokenPayload, dto: CreateGssRoleDto) {
    const permissionIds = await this.validatePermissionIds(dto.permissionIds ?? []);
    const key = dto.key.trim().toLowerCase();
    const name = dto.name.trim();

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.gssRole.findUnique({ where: { key }, select: { id: true } });
      if (existing) throw new ConflictException("A GSS role with this key already exists.");

      const role = await tx.gssRole.create({
        data: {
          key,
          name,
          permissions: permissionIds.length
            ? { create: permissionIds.map((permissionId) => ({ permissionId })) }
            : undefined,
        },
        select: roleSelect,
      });
      await this.auditLog.record(
        actor,
        {
          action: "gss-role.create",
          entityId: role.id,
          entityType: "GssRole",
          newValue: this.auditValue(role),
        },
        tx,
      );
      return role;
    });
  }

  async updateRole(actor: AuthTokenPayload, roleId: string, dto: UpdateGssRoleDto) {
    const permissionIds =
      dto.permissionIds === undefined
        ? undefined
        : await this.validatePermissionIds(dto.permissionIds);

    return this.prisma.$transaction(async (tx) => {
      const oldRole = await tx.gssRole.findUnique({ where: { id: roleId }, select: roleSelect });
      if (!oldRole) throw new NotFoundException("The GSS role was not found.");
      this.assertMutable(oldRole);

      const key = dto.key?.trim().toLowerCase();
      if (key && key !== oldRole.key) {
        const existing = await tx.gssRole.findUnique({ where: { key }, select: { id: true } });
        if (existing) throw new ConflictException("A GSS role with this key already exists.");
      }

      const role = await tx.gssRole.update({
        where: { id: roleId },
        data: {
          key,
          name: dto.name?.trim(),
          ...(permissionIds === undefined
            ? {}
            : {
                permissions: {
                  deleteMany: {},
                  create: permissionIds.map((permissionId) => ({ permissionId })),
                },
              }),
        },
        select: roleSelect,
      });
      await this.auditLog.record(
        actor,
        {
          action: "gss-role.update",
          entityId: role.id,
          entityType: "GssRole",
          newValue: this.auditValue(role),
          oldValue: this.auditValue(oldRole),
        },
        tx,
      );
      return role;
    });
  }

  async deleteRole(actor: AuthTokenPayload, roleId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const role = await tx.gssRole.findUnique({ where: { id: roleId }, select: roleSelect });
      if (!role) throw new NotFoundException("The GSS role was not found.");
      const deletion = this.deletionCapability(role);
      if (!deletion.allowed) {
        throw new ConflictException({
          blocker: deletion.blocker,
          code: deletion.code,
          message: deletion.blocker,
          recommendedAlternative: "Reassign users or retain the protected role.",
        });
      }
      await tx.gssRole.delete({ where: { id: roleId } });
      await this.auditLog.record(
        actor,
        {
          action: "gss-role.delete",
          entityId: role.id,
          entityType: "GssRole",
          oldValue: this.auditValue(role),
        },
        tx,
      );
    });
  }

  private async validatePermissionIds(permissionIds: string[]) {
    const uniqueIds = [...new Set(permissionIds)];
    if (!uniqueIds.length) return uniqueIds;
    const permissions = await this.prisma.permission.findMany({
      select: { id: true, scopeType: true },
      where: { id: { in: uniqueIds } },
    });
    if (
      permissions.length !== uniqueIds.length ||
      permissions.some(
        ({ scopeType }) =>
          scopeType !== PermissionScopeType.GSS && scopeType !== PermissionScopeType.BOTH,
      )
    ) {
      throw new BadRequestException("GSS roles may only receive GSS-scoped permissions.");
    }
    return uniqueIds;
  }

  private assertMutable(role: { isSuperAdmin: boolean; isSystem: boolean }) {
    if (role.isSystem || role.isSuperAdmin) {
      throw new ConflictException("System and super-admin roles are protected and read-only.");
    }
  }

  private deletionCapability(role: {
    isSuperAdmin: boolean;
    isSystem: boolean;
    _count: { users: number };
  }) {
    if (role.isSystem || role.isSuperAdmin) {
      return {
        allowed: false,
        blocker: "System and super-admin roles are protected.",
        code: "GSS_ROLE_PROTECTED",
        mode: "NOT_ALLOWED" as const,
      };
    }
    if (role._count.users > 0) {
      return {
        allowed: false,
        blocker: `The role is assigned to ${role._count.users} user(s).`,
        code: "GSS_ROLE_ASSIGNED_USERS",
        mode: "NOT_ALLOWED" as const,
      };
    }
    return { allowed: true, blocker: null, code: null, mode: "HARD_DELETE" as const };
  }

  private auditValue(role: {
    id: string;
    isSuperAdmin: boolean;
    isSystem: boolean;
    key: string;
    name: string;
    permissions: Array<{ permissionId: string }>;
  }): Prisma.InputJsonObject {
    return {
      id: role.id,
      isSuperAdmin: role.isSuperAdmin,
      isSystem: role.isSystem,
      key: role.key,
      name: role.name,
      permissionIds: role.permissions.map(({ permissionId }) => permissionId),
    };
  }
}
