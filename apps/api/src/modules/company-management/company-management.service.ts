import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { hash } from "bcrypt";
import { AuditActorType, PermissionScopeType, PositionAssignmentStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { AUTH_CONTEXT, type AuthTokenPayload } from "../../common/auth.types";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { SafeAdminPolicyService } from "../rbac/safe-admin-policy.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  paginated,
  pageWindow,
  type PaginationQueryDto,
  type SearchPaginationQueryDto,
} from "../../common/dto/pagination.dto";
import { ensureDefaultCompanyRoles } from "./default-company-roles";
import type {
  CreateCompanyPositionDto,
  CreateCompanyRoleDto,
  CreateCompanyUserDto,
  ReplaceUserPositionAssignmentsDto,
  UpdateCompanyPositionDto,
  UpdateCompanyRoleDto,
  UpdateCompanyRolePermissionsDto,
  UpdateCompanyUserDto,
} from "./dto/company-management.dto";

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

const userSelect = {
  id: true,
  companyId: true,
  roleId: true,
  name: true,
  email: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  role: { select: { id: true, key: true, name: true, isCompanyOwnerRole: true } },
  areaAccess: {
    select: { accessLevel: true, area: { select: { id: true, name: true } }, areaId: true },
  },
  buildingAccess: {
    select: {
      accessLevel: true,
      building: { select: { areaId: true, id: true, title: true } },
      buildingId: true,
    },
  },
  permissions: {
    select: {
      effect: true,
      permission: { select: { action: true, id: true, key: true, module: true, scopeType: true } },
      permissionId: true,
    },
  },
  positionAssignments: {
    where: { status: PositionAssignmentStatus.ACTIVE },
    select: {
      area: { select: { id: true, name: true } },
      areaId: true,
      assignedAt: true,
      building: { select: { areaId: true, id: true, title: true } },
      buildingId: true,
      id: true,
      position: { select: { id: true, isActive: true, key: true, name: true } },
      positionId: true,
    },
  },
  _count: {
    select: {
      alarmNotifications: true,
      alarmRecipientPolicies: true,
      positionAssignments: true,
    },
  },
} satisfies Prisma.CompanyUserSelect;

const roleSelect = {
  id: true,
  companyId: true,
  key: true,
  name: true,
  isSystem: true,
  isCompanyOwnerRole: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  _count: { select: { users: true } },
  permissions: {
    select: {
      permission: { select: { action: true, id: true, key: true, module: true, scopeType: true } },
      permissionId: true,
    },
  },
} satisfies Prisma.CompanyRoleSelect;

const positionSelect = {
  id: true,
  companyId: true,
  key: true,
  name: true,
  isActive: true,
  deletedAt: true,
  deletedById: true,
  deletedByType: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { assignments: true, alarmRecipientPolicies: true } },
} satisfies Prisma.CompanyPositionSelect;

@Injectable()
export class CompanyManagementService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
    @Inject(SafeAdminPolicyService) private readonly safeAdmin: SafeAdminPolicyService,
  ) {}

  async listCompanyUsers(companyId: string, query: PaginationQueryDto) {
    const where = {
      companyId,
      deletedAt: null,
      company: { deletedAt: null },
    } satisfies Prisma.CompanyUserWhereInput;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.companyUser.findMany({
        where,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: userSelect,
        ...pageWindow(query),
      }),
      this.prisma.companyUser.count({ where }),
    ]);
    const enriched = await Promise.all(
      items.map(async (user) => ({
        ...user,
        deletion: await this.companyUserDeletionCapability(user),
      })),
    );
    return paginated(enriched, total, query);
  }

  async createCompanyUser(actor: AuthTokenPayload, companyId: string, dto: CreateCompanyUserDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertCompany(companyId, tx);
      await this.assertRole(companyId, dto.roleId, tx);
      await this.assertScopes(companyId, dto.areaAccess, dto.buildingAccess, tx);
      this.assertNoDuplicateAssignments(dto.areaAccess, dto.buildingAccess);
      await this.assertCompanyPermissionIds(
        dto.directPermissions?.map(({ permissionId }) => permissionId) ?? [],
        tx,
      );
      this.assertNoDuplicateDirectPermissions(dto.directPermissions ?? []);

      const user = await tx.companyUser.create({
        data: {
          areaAccess: dto.areaAccess ? { createMany: { data: dto.areaAccess } } : undefined,
          buildingAccess: dto.buildingAccess
            ? { createMany: { data: dto.buildingAccess } }
            : undefined,
          companyId,
          email: dto.email.toLowerCase(),
          name: dto.name,
          passwordHash: await hash(dto.password, 12),
          permissions: dto.directPermissions
            ? {
                createMany: {
                  data: dto.directPermissions.map(({ effect, permissionId }) => ({
                    effect,
                    permissionId,
                  })),
                },
              }
            : undefined,
          phone: dto.phone,
          roleId: dto.roleId,
        },
        select: userSelect,
      });
      await this.auditLog.record(
        actor,
        {
          action: "company-user.create",
          entityId: user.id,
          entityType: "CompanyUser",
          newValue: user,
        },
        tx,
      );
      return user;
    });
  }

  async updateCompanyUser(
    actor: AuthTokenPayload,
    companyId: string,
    userId: string,
    dto: UpdateCompanyUserDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const oldUser = await this.assertCompanyUser(companyId, userId, tx);
      const targetRole = dto.roleId
        ? await this.assertRole(companyId, dto.roleId, tx)
        : oldUser.role;
      const willLoseOwnerRole = oldUser.role.isCompanyOwnerRole && !targetRole.isCompanyOwnerRole;
      const willDeactivate = oldUser.isActive && dto.isActive === false;
      await this.safeAdmin.assertCompanyUserCanLoseOwnerRole(
        actor.sub,
        userId,
        willLoseOwnerRole || willDeactivate,
        tx,
      );

      if (dto.areaAccess || dto.buildingAccess) {
        await this.assertScopes(companyId, dto.areaAccess, dto.buildingAccess, tx);
        this.assertNoDuplicateAssignments(dto.areaAccess, dto.buildingAccess);
      }
      if (dto.directPermissions) {
        await this.assertCompanyPermissionIds(
          dto.directPermissions.map(({ permissionId }) => permissionId),
          tx,
        );
        this.assertNoDuplicateDirectPermissions(dto.directPermissions);
      }

      const user = await tx.companyUser.update({
        where: { id: userId },
        data: {
          areaAccess: dto.areaAccess
            ? { deleteMany: {}, createMany: { data: dto.areaAccess } }
            : undefined,
          buildingAccess: dto.buildingAccess
            ? { deleteMany: {}, createMany: { data: dto.buildingAccess } }
            : undefined,
          email: dto.email?.toLowerCase(),
          isActive: dto.isActive,
          name: dto.name,
          passwordHash: dto.password ? await hash(dto.password, 12) : undefined,
          permissions: dto.directPermissions
            ? {
                deleteMany: {},
                createMany: {
                  data: dto.directPermissions.map(({ effect, permissionId }) => ({
                    effect,
                    permissionId,
                  })),
                },
              }
            : undefined,
          phone: dto.phone,
          roleId: dto.roleId,
          tokenVersion:
            dto.isActive !== undefined && dto.isActive !== oldUser.isActive
              ? { increment: 1 }
              : undefined,
        },
        select: userSelect,
      });
      await this.auditLog.record(
        actor,
        {
          action: "company-user.update",
          entityId: user.id,
          entityType: "CompanyUser",
          newValue: user,
          oldValue: oldUser,
        },
        tx,
      );
      return user;
    });
  }

  async deactivateCompanyUser(actor: AuthTokenPayload, companyId: string, userId: string) {
    return this.archiveCompanyUser(actor, companyId, userId);
  }

  async archiveCompanyUser(
    actor: AuthTokenPayload,
    companyId: string,
    userId: string,
    reason?: string,
  ) {
    const archivedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "CompanyUser" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const user = await this.assertCompanyUser(companyId, userId, tx);
      await this.safeAdmin.assertCompanyUserCanLoseOwnerRole(
        actor.sub,
        userId,
        user.role.isCompanyOwnerRole,
        tx,
      );
      await tx.companyUserPositionAssignment.updateMany({
        data: { endedAt: archivedAt, status: PositionAssignmentStatus.ENDED },
        where: { companyUserId: userId, status: PositionAssignmentStatus.ACTIVE },
      });
      const policies = await tx.alarmRecipientPolicy.findMany({
        select: { id: true },
        where: { deletedAt: null, isActive: true, specificUserId: userId },
      });
      await Promise.all(
        policies.map(({ id }) =>
          tx.alarmRecipientPolicy.update({
            data: {
              activeKey: id,
              disabledAt: archivedAt,
              isActive: false,
              updatedById: actor.sub,
              updatedByType: this.actorType(actor),
            },
            where: { id },
          }),
        ),
      );
      if (policies.length > 0) {
        await tx.alarmCounterState.updateMany({
          data: { currentCount: 0, status: "RESET", version: { increment: 1 } },
          where: { policyId: { in: policies.map(({ id }) => id) } },
        });
      }
      const archived = await tx.companyUser.update({
        data: {
          deletedAt: archivedAt,
          deletedById: actor.sub,
          deletedByType: this.actorType(actor),
          deleteReason: reason,
          isActive: false,
          tokenVersion: { increment: 1 },
        },
        where: { id: userId },
      });
      await this.auditLog.record(
        actor,
        {
          action: "company-user.archive",
          entityId: userId,
          entityType: "CompanyUser",
          newValue: { deletedAt: archivedAt.toISOString(), reason },
          oldValue: user,
          scope: { companyId },
        },
        tx,
      );
      return { archived: true, id: archived.id };
    });
  }

  async updateCompanyUserStatus(
    actor: AuthTokenPayload,
    companyId: string,
    userId: string,
    isActive: boolean,
  ) {
    return this.updateCompanyUser(actor, companyId, userId, { isActive });
  }

  async permanentlyDeleteCompanyUser(actor: AuthTokenPayload, companyId: string, userId: string) {
    return this.archiveCompanyUser(actor, companyId, userId);
  }

  async listCompanyRoles(companyId: string, query: PaginationQueryDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertCompany(companyId, tx);
      const defaultRoles = await ensureDefaultCompanyRoles(companyId, tx);
      if (defaultRoles.missingTemplateKeys.length > 0) {
        throw new ConflictException(
          `Default company role templates are unavailable: ${defaultRoles.missingTemplateKeys.join(", ")}.`,
        );
      }
      const where = { companyId, deletedAt: null } satisfies Prisma.CompanyRoleWhereInput;
      const [items, total] = await Promise.all([
        tx.companyRole.findMany({
          where,
          orderBy: [{ name: "asc" }, { id: "asc" }],
          select: roleSelect,
          ...pageWindow(query),
        }),
        tx.companyRole.count({ where }),
      ]);
      return paginated(
        items.map((role) => ({ ...role, deletion: this.companyRoleDeletionCapability(role) })),
        total,
        query,
      );
    });
  }

  async createCompanyRole(actor: AuthTokenPayload, companyId: string, dto: CreateCompanyRoleDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertCompany(companyId, tx);
      await this.assertCompanyPermissionIds(dto.permissionIds, tx);
      this.assertUniqueIds(dto.permissionIds, "Duplicate role permissions are not allowed.");
      const key = this.normalizeCatalogKey(dto.key);
      const role = await tx.companyRole.create({
        data: {
          companyId,
          key,
          name: dto.name,
          permissions: {
            createMany: { data: dto.permissionIds.map((permissionId) => ({ permissionId })) },
          },
        },
        select: roleSelect,
      });
      await this.auditLog.record(
        actor,
        {
          action: "company-role.create",
          entityId: role.id,
          entityType: "CompanyRole",
          newValue: role,
        },
        tx,
      );
      return role;
    });
  }

  async updateCompanyRole(
    actor: AuthTokenPayload,
    companyId: string,
    roleId: string,
    dto: UpdateCompanyRoleDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const oldRole = await this.assertRole(companyId, roleId, tx);
      if (oldRole.isSystem || oldRole.isCompanyOwnerRole) {
        throw new ForbiddenException("System company roles cannot be edited.");
      }
      if (dto.permissionIds) {
        await this.assertCompanyPermissionIds(dto.permissionIds, tx);
        this.assertUniqueIds(dto.permissionIds, "Duplicate role permissions are not allowed.");
      }
      const role = await tx.companyRole.update({
        where: { id: roleId },
        data: {
          key: dto.key ? this.normalizeCatalogKey(dto.key) : undefined,
          name: dto.name,
          permissions: dto.permissionIds
            ? {
                deleteMany: {},
                createMany: { data: dto.permissionIds.map((permissionId) => ({ permissionId })) },
              }
            : undefined,
        },
        select: roleSelect,
      });
      await this.auditLog.record(
        actor,
        {
          action: "company-role.update",
          entityId: role.id,
          entityType: "CompanyRole",
          newValue: role,
          oldValue: oldRole,
        },
        tx,
      );
      return role;
    });
  }

  async updateCompanyRolePermissions(
    actor: AuthTokenPayload,
    companyId: string,
    roleId: string,
    dto: UpdateCompanyRolePermissionsDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const oldRole = await this.assertRole(companyId, roleId, tx);
      if (oldRole.isSystem || oldRole.isCompanyOwnerRole) {
        throw new ForbiddenException(
          "System company roles cannot be edited through this endpoint.",
        );
      }
      await this.assertCompanyPermissionIds(dto.permissionIds, tx);
      this.assertUniqueIds(dto.permissionIds, "Duplicate role permissions are not allowed.");
      const role = await tx.companyRole.update({
        where: { id: roleId },
        data: {
          permissions: {
            deleteMany: {},
            createMany: { data: dto.permissionIds.map((permissionId) => ({ permissionId })) },
          },
        },
        select: roleSelect,
      });
      await this.auditLog.record(
        actor,
        {
          action: "company-role.permissions.update",
          entityId: role.id,
          entityType: "CompanyRole",
          newValue: role,
          oldValue: oldRole,
        },
        tx,
      );
      return role;
    });
  }

  async deleteCompanyRole(actor: AuthTokenPayload, companyId: string, roleId: string) {
    return this.prisma.$transaction(async (tx) => {
      const oldRole = await this.assertRole(companyId, roleId, tx);
      this.assertDeletionAllowed(this.companyRoleDeletionCapability(oldRole), "reassign its users");
      const archivedAt = new Date();
      await tx.companyRole.update({
        data: {
          deletedAt: archivedAt,
          deletedById: actor.sub,
          deletedByType: this.actorType(actor),
        },
        where: { id: roleId },
      });
      await this.auditLog.record(
        actor,
        {
          action: "company-role.archive",
          entityId: roleId,
          entityType: "CompanyRole",
          oldValue: oldRole,
        },
        tx,
      );
    });
  }

  async listCompanyPermissions(query: SearchPaginationQueryDto) {
    const where = {
      scopeType: { in: [PermissionScopeType.COMPANY, PermissionScopeType.BOTH] },
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
        where,
        orderBy: [{ key: "asc" }, { id: "asc" }],
        select: {
          id: true,
          key: true,
          module: true,
          action: true,
          scopeType: true,
          description: true,
        },
        ...pageWindow(query),
      }),
      this.prisma.permission.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  async listCompanyPermissionOptions() {
    return this.prisma.permission.findMany({
      where: { scopeType: { in: [PermissionScopeType.COMPANY, PermissionScopeType.BOTH] } },
      orderBy: { key: "asc" },
      select: {
        id: true,
        key: true,
        module: true,
        action: true,
        scopeType: true,
        description: true,
      },
    });
  }

  async listCompanyPositions(companyId: string, query: PaginationQueryDto) {
    const where = { companyId, deletedAt: null } satisfies Prisma.CompanyPositionWhereInput;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.companyPosition.findMany({
        where,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: positionSelect,
        ...pageWindow(query),
      }),
      this.prisma.companyPosition.count({ where }),
    ]);
    const enriched = await Promise.all(
      items.map(async (position) => ({
        ...position,
        ...(await this.companyPositionDeletionCapability(position.id)),
      })),
    );
    return paginated(enriched, total, query);
  }

  async createCompanyPosition(
    actor: AuthTokenPayload,
    companyId: string,
    dto: CreateCompanyPositionDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertCompany(companyId, tx);
      const key = this.normalizeCatalogKey(dto.key);
      const position = await tx.companyPosition.create({
        data: { ...dto, companyId, key },
        select: positionSelect,
      });
      await this.auditLog.record(
        actor,
        {
          action: "company-position.create",
          entityId: position.id,
          entityType: "CompanyPosition",
          newValue: position,
        },
        tx,
      );
      return position;
    });
  }

  async updateCompanyPosition(
    actor: AuthTokenPayload,
    companyId: string,
    positionId: string,
    dto: UpdateCompanyPositionDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockPosition(positionId, tx);
      const oldPosition = await this.assertPosition(companyId, positionId, tx);
      const position = await tx.companyPosition.update({
        where: { id: positionId },
        data: {
          isActive: dto.isActive,
          key: dto.key ? this.normalizeCatalogKey(dto.key) : undefined,
          name: dto.name,
        },
        select: positionSelect,
      });
      await this.auditLog.record(
        actor,
        {
          action: "company-position.update",
          entityId: position.id,
          entityType: "CompanyPosition",
          newValue: position,
          oldValue: oldPosition,
        },
        tx,
      );
      return position;
    });
  }

  async deactivateCompanyPosition(actor: AuthTokenPayload, companyId: string, positionId: string) {
    return this.archiveCompanyPosition(actor, companyId, positionId);
  }

  async archiveCompanyPosition(
    actor: AuthTokenPayload,
    companyId: string,
    positionId: string,
    reason?: string,
  ) {
    const archivedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      await this.lockPosition(positionId, tx);
      const position = await this.assertPosition(companyId, positionId, tx);
      await tx.companyUserPositionAssignment.updateMany({
        data: { endedAt: archivedAt, status: PositionAssignmentStatus.ENDED },
        where: { positionId, status: PositionAssignmentStatus.ACTIVE },
      });
      const policies = await tx.alarmRecipientPolicy.findMany({
        select: { id: true },
        where: { deletedAt: null, isActive: true, positionId },
      });
      await Promise.all(
        policies.map(({ id }) =>
          tx.alarmRecipientPolicy.update({
            data: {
              activeKey: id,
              disabledAt: archivedAt,
              isActive: false,
              updatedById: actor.sub,
              updatedByType: this.actorType(actor),
            },
            where: { id },
          }),
        ),
      );
      if (policies.length > 0) {
        await tx.alarmCounterState.updateMany({
          data: { currentCount: 0, status: "RESET", version: { increment: 1 } },
          where: { policyId: { in: policies.map(({ id }) => id) } },
        });
      }
      const archived = await tx.companyPosition.update({
        data: {
          deletedAt: archivedAt,
          deletedById: actor.sub,
          deletedByType: this.actorType(actor),
          deleteReason: reason,
          isActive: false,
        },
        where: { id: positionId },
      });
      await this.auditLog.record(
        actor,
        {
          action: "company-position.archive",
          entityId: positionId,
          entityType: "CompanyPosition",
          newValue: { deletedAt: archivedAt.toISOString(), reason },
          oldValue: position,
          scope: { companyId },
        },
        tx,
      );
      return { archived: true, id: archived.id };
    });
  }

  async updateCompanyPositionStatus(
    actor: AuthTokenPayload,
    companyId: string,
    positionId: string,
    isActive: boolean,
  ) {
    return this.updateCompanyPosition(actor, companyId, positionId, { isActive });
  }

  async permanentlyDeleteCompanyPosition(
    actor: AuthTokenPayload,
    companyId: string,
    positionId: string,
  ) {
    return this.archiveCompanyPosition(actor, companyId, positionId);
  }

  async replaceUserPositionAssignments(
    actor: AuthTokenPayload,
    companyId: string,
    userId: string,
    dto: ReplaceUserPositionAssignmentsDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertCompanyUser(companyId, userId, tx);
      await tx.$queryRaw`SELECT "id" FROM "CompanyUserPositionAssignment" WHERE "companyUserId" = ${userId}::uuid AND "status" = 'ACTIVE'::"PositionAssignmentStatus" FOR UPDATE`;
      await this.assertPositionAssignments(companyId, dto, tx);
      const oldAssignments = await tx.companyUserPositionAssignment.findMany({
        where: { companyUserId: userId, status: PositionAssignmentStatus.ACTIVE },
      });
      await tx.companyUserPositionAssignment.updateMany({
        where: { companyUserId: userId, status: PositionAssignmentStatus.ACTIVE },
        data: { status: PositionAssignmentStatus.ENDED, endedAt: new Date() },
      });
      const assignments = await Promise.all(
        dto.assignments.map((assignment) =>
          tx.companyUserPositionAssignment.create({
            data: { ...assignment, companyUserId: userId },
          }),
        ),
      );
      await this.auditLog.record(
        actor,
        {
          action: "company-user.position-assignments.replace",
          entityId: userId,
          entityType: "CompanyUser",
          newValue: { assignments },
          oldValue: { assignments: oldAssignments },
        },
        tx,
      );
      return assignments;
    });
  }

  async getCompanyUserEffectiveAccess(companyId: string, userId: string) {
    const user = await this.assertCompanyUser(companyId, userId, this.prisma);
    const [rolePermissions, areaBuildings] = await Promise.all([
      this.prisma.companyRolePermission.findMany({
        where: { roleId: user.roleId },
        select: {
          permission: {
            select: { action: true, id: true, key: true, module: true, scopeType: true },
          },
        },
        orderBy: { permission: { key: "asc" } },
      }),
      this.prisma.constructionBuilding.findMany({
        where: {
          areaId: { in: user.areaAccess.map((access) => access.areaId) },
          companyId,
        },
        orderBy: { title: "asc" },
        select: { areaId: true, id: true, title: true },
      }),
    ]);
    const directAllow = user.permissions
      .filter(({ effect }) => effect === "ALLOW")
      .map(({ permission }) => permission);
    const directDeny = user.permissions
      .filter(({ effect }) => effect === "DENY")
      .map(({ permission }) => permission);
    const effectivePermissions = new Map(
      rolePermissions.map(({ permission }) => [permission.key, permission]),
    );
    for (const permission of directAllow) {
      effectivePermissions.set(permission.key, permission);
    }
    for (const permission of directDeny) {
      effectivePermissions.delete(permission.key);
    }
    const directBuildingIds = new Set(user.buildingAccess.map((access) => access.buildingId));
    return {
      assignedAreas: user.areaAccess,
      assignedBuildings: user.buildingAccess,
      directAllowPermissions: directAllow,
      directDenyPermissions: directDeny,
      effectivePermissions: [...effectivePermissions.values()].sort((a, b) =>
        a.key.localeCompare(b.key),
      ),
      inheritedBuildings: areaBuildings.filter((building) => !directBuildingIds.has(building.id)),
      positionAssignments: user.positionAssignments,
      rolePermissions: rolePermissions.map(({ permission }) => permission),
      user,
    };
  }

  async getCompanyIdForCompanyUser(companyUserId: string) {
    const user = await this.prisma.companyUser.findUnique({
      where: { id: companyUserId, deletedAt: null, company: { deletedAt: null } },
      select: { companyId: true },
    });
    if (!user) {
      throw new NotFoundException("The company user was not found.");
    }
    return user.companyId;
  }

  async assertCompanyManager(companyUserId: string) {
    const user = await this.prisma.companyUser.findUnique({
      where: { id: companyUserId, deletedAt: null, company: { deletedAt: null } },
      select: { companyId: true, role: { select: { isCompanyOwnerRole: true } } },
    });
    if (!user?.role.isCompanyOwnerRole) {
      throw new ForbiddenException("A company platform manager is required.");
    }
    return user.companyId;
  }

  private async assertCompany(companyId: string, executor: PrismaExecutor) {
    const company = await executor.company.findUnique({
      where: { id: companyId, deletedAt: null },
      select: { id: true },
    });
    if (!company) {
      throw new NotFoundException("The company was not found.");
    }
  }

  private actorType(actor: AuthTokenPayload) {
    return actor.context === AUTH_CONTEXT.gssAdmin
      ? AuditActorType.GSS_ADMIN
      : AuditActorType.COMPANY_USER;
  }

  private async assertCompanyUser(companyId: string, userId: string, executor: PrismaExecutor) {
    const user = await executor.companyUser.findFirst({
      where: { id: userId, companyId, deletedAt: null, company: { deletedAt: null } },
      select: userSelect,
    });
    if (!user) {
      throw new NotFoundException("The company user was not found.");
    }
    return user;
  }

  private async assertRole(companyId: string, roleId: string, executor: PrismaExecutor) {
    const role = await executor.companyRole.findFirst({
      where: { id: roleId, companyId, deletedAt: null },
      select: roleSelect,
    });
    if (!role) {
      throw new NotFoundException("The company role was not found.");
    }
    return role;
  }

  private async assertPosition(companyId: string, positionId: string, executor: PrismaExecutor) {
    const position = await executor.companyPosition.findFirst({
      where: { id: positionId, companyId, deletedAt: null },
      select: positionSelect,
    });
    if (!position) {
      throw new NotFoundException("The company position was not found.");
    }
    return position;
  }

  private async assertCompanyPermissionIds(permissionIds: string[], executor: PrismaExecutor) {
    const uniqueIds = [...new Set(permissionIds)];
    const permissions = await executor.permission.findMany({
      where: {
        id: { in: uniqueIds },
        scopeType: { in: [PermissionScopeType.COMPANY, PermissionScopeType.BOTH] },
      },
      select: { id: true },
    });
    if (permissions.length !== uniqueIds.length) {
      throw new ForbiddenException("Company roles and users cannot receive GSS-only permissions.");
    }
  }

  private normalizeCatalogKey(key: string) {
    const normalized = key.trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
    if (!/^[a-z][a-z0-9_]*$/.test(normalized)) {
      throw new BadRequestException(
        "Keys must start with a letter and contain only lowercase letters, numbers, and underscores.",
      );
    }
    return normalized;
  }

  private assertUniqueIds(ids: string[], message: string) {
    if (new Set(ids).size !== ids.length) {
      throw new ConflictException(message);
    }
  }

  private assertNoDuplicateDirectPermissions(
    directPermissions: CreateCompanyUserDto["directPermissions"],
  ) {
    this.assertUniqueIds(
      directPermissions?.map(({ permissionId }) => permissionId) ?? [],
      "Duplicate direct permissions are not allowed.",
    );
  }

  private assertNoDuplicateAssignments(
    areaAccess: CreateCompanyUserDto["areaAccess"],
    buildingAccess: CreateCompanyUserDto["buildingAccess"],
  ) {
    this.assertUniqueIds(
      areaAccess?.map(({ areaId }) => areaId) ?? [],
      "Duplicate area scope assignments are not allowed.",
    );
    this.assertUniqueIds(
      buildingAccess?.map(({ buildingId }) => buildingId) ?? [],
      "Duplicate building scope assignments are not allowed.",
    );
  }

  private async assertScopes(
    companyId: string,
    areaAccess: CreateCompanyUserDto["areaAccess"],
    buildingAccess: CreateCompanyUserDto["buildingAccess"],
    executor: PrismaExecutor,
  ) {
    const areaIds = areaAccess?.map(({ areaId }) => areaId) ?? [];
    const buildingIds = buildingAccess?.map(({ buildingId }) => buildingId) ?? [];
    const [areas, buildings] = await Promise.all([
      executor.constructionArea.count({ where: { id: { in: [...new Set(areaIds)] }, companyId } }),
      executor.constructionBuilding.count({
        where: { id: { in: [...new Set(buildingIds)] }, companyId },
      }),
    ]);
    if (areas !== new Set(areaIds).size || buildings !== new Set(buildingIds).size) {
      throw new ForbiddenException("Scope access must belong to the company.");
    }
  }

  private async assertPositionAssignments(
    companyId: string,
    dto: ReplaceUserPositionAssignmentsDto,
    executor: Prisma.TransactionClient,
  ) {
    const seen = new Set<string>();
    for (const assignment of dto.assignments) {
      const key = `${assignment.positionId}:${assignment.areaId ?? "company"}:${assignment.buildingId ?? "company"}`;
      if (seen.has(key)) {
        throw new ConflictException("Duplicate active position assignments are not allowed.");
      }
      seen.add(key);

      await this.lockPosition(assignment.positionId, executor);
      const position = await this.assertPosition(companyId, assignment.positionId, executor);
      if (!position.isActive) {
        throw new ForbiddenException("Inactive positions cannot receive active assignments.");
      }
      if (assignment.areaId) {
        const area = await executor.constructionArea.findFirst({
          where: { id: assignment.areaId, companyId },
          select: { id: true },
        });
        if (!area) {
          throw new ForbiddenException("Position area scope must belong to the company.");
        }
      }
      if (assignment.buildingId) {
        const building = await executor.constructionBuilding.findFirst({
          where: { id: assignment.buildingId, companyId },
          select: { areaId: true },
        });
        if (!building || (assignment.areaId && building.areaId !== assignment.areaId)) {
          throw new ForbiddenException(
            "Position building scope must belong to the selected area and company.",
          );
        }
      }
    }
  }

  private async companyUserDeletionCapability(
    user: Awaited<ReturnType<CompanyManagementService["assertCompanyUser"]>>,
    executor: PrismaExecutor = this.prisma,
  ) {
    void user;
    void executor;
    return { allowed: true, blocker: null, code: null, mode: "ARCHIVE" as const };
  }

  private companyRoleDeletionCapability(role: {
    isCompanyOwnerRole: boolean;
    isSystem: boolean;
    _count: { users: number };
  }) {
    if (role.isSystem || role.isCompanyOwnerRole) {
      return {
        allowed: false,
        blocker: "System and company-owner roles are protected.",
        code: "COMPANY_ROLE_PROTECTED",
        mode: "NOT_ALLOWED" as const,
      };
    }
    if (role._count.users > 0) {
      return {
        allowed: false,
        blocker: `The role is assigned to ${role._count.users} user(s).`,
        code: "COMPANY_ROLE_ASSIGNED_USERS",
        mode: "NOT_ALLOWED" as const,
      };
    }
    return { allowed: true, blocker: null, code: null, mode: "ARCHIVE" as const };
  }

  private async companyPositionDeletionCapability(
    positionId: string,
    executor: PrismaExecutor = this.prisma,
  ) {
    const [
      activeAssignments,
      historicalAssignments,
      activePolicies,
      inactivePolicies,
      policyAuditReferences,
    ] = await Promise.all([
      executor.companyUserPositionAssignment.count({
        where: { positionId, status: PositionAssignmentStatus.ACTIVE },
      }),
      executor.companyUserPositionAssignment.count({
        where: { positionId, status: PositionAssignmentStatus.ENDED },
      }),
      executor.alarmRecipientPolicy.count({ where: { positionId, isActive: true } }),
      executor.alarmRecipientPolicy.count({ where: { positionId, isActive: false } }),
      executor.auditLog.count({
        where: {
          entityType: "AlarmRecipientPolicy",
          OR: [
            { oldValue: { path: ["positionId"], equals: positionId } },
            { newValue: { path: ["positionId"], equals: positionId } },
          ],
        },
      }),
    ]);
    // A policy can be moved to another target. Its audit snapshots are therefore
    // the durable evidence that the position has recipient-policy history.
    const historicalPolicies = Math.max(inactivePolicies, policyAuditReferences);
    const dependencies = {
      activeAssignments,
      activePolicies,
      historicalAssignments,
      historicalPolicies,
    };
    const counts = { ...dependencies };
    return {
      dependencies,
      deletion: {
        allowed: true,
        blocker: null,
        code: null,
        counts,
        mode: "ARCHIVE" as const,
        recommendedActions: [],
      },
    };
  }

  private async lockPosition(positionId: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT "id" FROM "CompanyPosition" WHERE "id" = ${positionId}::uuid FOR UPDATE`;
  }

  private async lockPositionDependencies(positionId: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT "id" FROM "CompanyUserPositionAssignment" WHERE "positionId" = ${positionId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "AlarmRecipientPolicy" WHERE "positionId" = ${positionId}::uuid FOR UPDATE`;
  }

  private assertDeletionAllowed(
    capability: {
      allowed: boolean;
      blocker: string | null;
      code: string | null;
      counts?: Record<string, number>;
      recommendedActions?: string[];
    },
    recommendedAlternative: string,
  ) {
    if (!capability.allowed) {
      throw new ConflictException({
        blocker: capability.blocker,
        code: capability.code,
        counts: capability.counts,
        message: capability.blocker,
        recommendedAlternative,
        recommendedActions: capability.recommendedActions,
      });
    }
  }
}
