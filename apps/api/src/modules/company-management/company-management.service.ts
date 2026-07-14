import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { hash } from "bcrypt";
import { PermissionScopeType, PositionAssignmentStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import type { AuthTokenPayload } from "../../common/auth.types";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { SafeAdminPolicyService } from "../rbac/safe-admin-policy.service";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  CreateCompanyPositionDto,
  CreateCompanyRoleDto,
  CreateCompanyUserDto,
  ReplaceUserPositionAssignmentsDto,
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
  role: { select: { id: true, key: true, name: true, isCompanyOwnerRole: true } },
  areaAccess: { select: { areaId: true, accessLevel: true } },
  buildingAccess: { select: { buildingId: true, accessLevel: true } },
  permissions: { select: { permissionId: true, effect: true } },
  positionAssignments: {
    where: { status: PositionAssignmentStatus.ACTIVE },
    select: { id: true, positionId: true, areaId: true, buildingId: true, assignedAt: true },
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
  permissions: { select: { permissionId: true } },
} satisfies Prisma.CompanyRoleSelect;

const positionSelect = {
  id: true,
  companyId: true,
  key: true,
  name: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CompanyPositionSelect;

@Injectable()
export class CompanyManagementService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
    @Inject(SafeAdminPolicyService) private readonly safeAdmin: SafeAdminPolicyService,
  ) {}

  async listCompanyUsers(companyId: string) {
    return this.prisma.companyUser.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      select: userSelect,
    });
  }

  async createCompanyUser(actor: AuthTokenPayload, companyId: string, dto: CreateCompanyUserDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertCompany(companyId, tx);
      await this.assertRole(companyId, dto.roleId, tx);
      await this.assertScopes(companyId, dto.areaAccess, dto.buildingAccess, tx);
      await this.assertCompanyPermissionIds(
        dto.directPermissions?.map(({ permissionId }) => permissionId) ?? [],
        tx,
      );

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
      }
      if (dto.directPermissions) {
        await this.assertCompanyPermissionIds(
          dto.directPermissions.map(({ permissionId }) => permissionId),
          tx,
        );
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
          tokenVersion: willDeactivate ? { increment: 1 } : undefined,
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
    return this.updateCompanyUser(actor, companyId, userId, { isActive: false });
  }

  async listCompanyRoles(companyId: string) {
    return this.prisma.companyRole.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      select: roleSelect,
    });
  }

  async createCompanyRole(actor: AuthTokenPayload, companyId: string, dto: CreateCompanyRoleDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertCompany(companyId, tx);
      await this.assertCompanyPermissionIds(dto.permissionIds, tx);
      const role = await tx.companyRole.create({
        data: {
          companyId,
          key: dto.key,
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

  async updateCompanyRolePermissions(
    actor: AuthTokenPayload,
    companyId: string,
    roleId: string,
    dto: UpdateCompanyRolePermissionsDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const oldRole = await this.assertRole(companyId, roleId, tx);
      if (oldRole.isCompanyOwnerRole) {
        throw new ForbiddenException(
          "The platform manager role cannot be edited through this endpoint.",
        );
      }
      await this.assertCompanyPermissionIds(dto.permissionIds, tx);
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

  async listCompanyPermissions() {
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

  async listCompanyPositions(companyId: string) {
    return this.prisma.companyPosition.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      select: positionSelect,
    });
  }

  async createCompanyPosition(
    actor: AuthTokenPayload,
    companyId: string,
    dto: CreateCompanyPositionDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertCompany(companyId, tx);
      const position = await tx.companyPosition.create({
        data: { ...dto, companyId },
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

  async deactivateCompanyPosition(actor: AuthTokenPayload, companyId: string, positionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const oldPosition = await this.assertPosition(companyId, positionId, tx);
      const position = await tx.companyPosition.update({
        where: { id: positionId },
        data: { isActive: false },
        select: positionSelect,
      });
      await this.auditLog.record(
        actor,
        {
          action: "company-position.deactivate",
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

  async replaceUserPositionAssignments(
    actor: AuthTokenPayload,
    companyId: string,
    userId: string,
    dto: ReplaceUserPositionAssignmentsDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertCompanyUser(companyId, userId, tx);
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

  async assertCompanyManager(companyUserId: string) {
    const user = await this.prisma.companyUser.findUnique({
      where: { id: companyUserId },
      select: { companyId: true, role: { select: { isCompanyOwnerRole: true } } },
    });
    if (!user?.role.isCompanyOwnerRole) {
      throw new ForbiddenException("A company platform manager is required.");
    }
    return user.companyId;
  }

  private async assertCompany(companyId: string, executor: PrismaExecutor) {
    const company = await executor.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) {
      throw new NotFoundException("The company was not found.");
    }
  }

  private async assertCompanyUser(companyId: string, userId: string, executor: PrismaExecutor) {
    const user = await executor.companyUser.findFirst({
      where: { id: userId, companyId },
      select: userSelect,
    });
    if (!user) {
      throw new NotFoundException("The company user was not found.");
    }
    return user;
  }

  private async assertRole(companyId: string, roleId: string, executor: PrismaExecutor) {
    const role = await executor.companyRole.findFirst({
      where: { id: roleId, companyId },
      select: roleSelect,
    });
    if (!role) {
      throw new NotFoundException("The company role was not found.");
    }
    return role;
  }

  private async assertPosition(companyId: string, positionId: string, executor: PrismaExecutor) {
    const position = await executor.companyPosition.findFirst({
      where: { id: positionId, companyId },
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
    executor: PrismaExecutor,
  ) {
    const seen = new Set<string>();
    for (const assignment of dto.assignments) {
      const key = `${assignment.positionId}:${assignment.areaId ?? "company"}:${assignment.buildingId ?? "company"}`;
      if (seen.has(key)) {
        throw new ConflictException("Duplicate active position assignments are not allowed.");
      }
      seen.add(key);

      await this.assertPosition(companyId, assignment.positionId, executor);
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
}
