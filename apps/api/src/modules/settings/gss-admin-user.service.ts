import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { hash } from "bcrypt";

import type { AuthTokenPayload } from "../../common/auth.types";
import {
  paginated,
  pageWindow,
  type SearchPaginationQueryDto,
} from "../../common/dto/pagination.dto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { SafeAdminPolicyService } from "../rbac/safe-admin-policy.service";
import type { CreateGssAdminUserDto, UpdateGssAdminUserDto } from "./dto/gss-admin-user.dto";

const administratorSelect = {
  createdAt: true,
  email: true,
  id: true,
  isActive: true,
  lastLoginAt: true,
  name: true,
  phone: true,
  role: {
    select: { id: true, isSuperAdmin: true, isSystem: true, key: true, name: true },
  },
  updatedAt: true,
} satisfies Prisma.GssAdminUserSelect;

type Administrator = Prisma.GssAdminUserGetPayload<{ select: typeof administratorSelect }>;

@Injectable()
export class GssAdminUserService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
    @Inject(SafeAdminPolicyService) private readonly safeAdmin: SafeAdminPolicyService,
  ) {}

  async list(query: SearchPaginationQueryDto) {
    const search = query.search?.trim();
    const where = {
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { role: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    } satisfies Prisma.GssAdminUserWhereInput;
    const [items, total, activeSuperAdmins] = await this.prisma.$transaction([
      this.prisma.gssAdminUser.findMany({
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: administratorSelect,
        where,
        ...pageWindow(query),
      }),
      this.prisma.gssAdminUser.count({ where }),
      this.prisma.gssAdminUser.count({
        where: { isActive: true, role: { isSuperAdmin: true } },
      }),
    ]);
    return paginated(
      items.map((user) => ({
        ...user,
        deletion: this.deletionCapability(user, activeSuperAdmins),
      })),
      total,
      query,
    );
  }

  listRoleOptions() {
    return this.prisma.gssRole.findMany({
      orderBy: [{ isSuperAdmin: "desc" }, { name: "asc" }, { id: "asc" }],
      select: { id: true, isSuperAdmin: true, isSystem: true, key: true, name: true },
    });
  }

  async create(actor: AuthTokenPayload, dto: CreateGssAdminUserDto) {
    const passwordHash = await hash(dto.password, 12);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertRole(dto.roleId, tx);
        const user = await tx.gssAdminUser.create({
          data: {
            email: dto.email.trim().toLowerCase(),
            name: dto.name.trim(),
            passwordHash,
            phone: this.optionalText(dto.phone),
            roleId: dto.roleId,
          },
          select: administratorSelect,
        });
        await this.auditLog.record(
          actor,
          {
            action: "gss-admin-user.create",
            entityId: user.id,
            entityType: "GssAdminUser",
            newValue: this.auditValue(user),
          },
          tx,
        );
        return user;
      });
    } catch (error) {
      this.rethrowUniqueEmail(error);
      throw error;
    }
  }

  async update(actor: AuthTokenPayload, userId: string, dto: UpdateGssAdminUserDto) {
    const passwordHash = dto.password ? await hash(dto.password, 12) : undefined;
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockSafeAdminPolicy(tx);
        const oldUser = await tx.gssAdminUser.findUnique({
          select: administratorSelect,
          where: { id: userId },
        });
        if (!oldUser) throw new NotFoundException("The GSS Administrator was not found.");

        const targetRole = dto.roleId ? await this.assertRole(dto.roleId, tx) : oldUser.role;
        const willLoseSuperAdmin =
          oldUser.isActive &&
          oldUser.role.isSuperAdmin &&
          (dto.isActive === false || !targetRole.isSuperAdmin);
        if (willLoseSuperAdmin) {
          await this.safeAdmin.assertGssAdminCanLoseSuperAdmin(userId, tx);
        }
        const invalidatesSessions =
          Boolean(dto.password) ||
          (dto.isActive !== undefined && dto.isActive !== oldUser.isActive);
        const user = await tx.gssAdminUser.update({
          data: {
            email: dto.email?.trim().toLowerCase(),
            isActive: dto.isActive,
            name: dto.name?.trim(),
            passwordHash,
            phone: dto.phone === undefined ? undefined : this.optionalText(dto.phone),
            roleId: dto.roleId,
            tokenVersion: invalidatesSessions ? { increment: 1 } : undefined,
          },
          select: administratorSelect,
          where: { id: userId },
        });
        await this.auditLog.record(
          actor,
          {
            action: "gss-admin-user.update",
            entityId: user.id,
            entityType: "GssAdminUser",
            newValue: this.auditValue(user),
            oldValue: this.auditValue(oldUser),
          },
          tx,
        );
        return user;
      });
    } catch (error) {
      this.rethrowUniqueEmail(error);
      throw error;
    }
  }

  async delete(actor: AuthTokenPayload, userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockSafeAdminPolicy(tx);
      const user = await tx.gssAdminUser.findUnique({
        select: administratorSelect,
        where: { id: userId },
      });
      if (!user) throw new NotFoundException("The GSS Administrator was not found.");
      if (user.isActive && user.role.isSuperAdmin) {
        await this.safeAdmin.assertGssAdminCanLoseSuperAdmin(userId, tx);
      }
      await tx.gssAdminUser.delete({ where: { id: userId } });
      await this.auditLog.record(
        actor,
        {
          action: "gss-admin-user.delete",
          entityId: user.id,
          entityType: "GssAdminUser",
          oldValue: this.auditValue(user),
        },
        tx,
      );
    });
  }

  private assertRole(roleId: string, executor: Prisma.TransactionClient | PrismaService) {
    return executor.gssRole
      .findUnique({
        select: { id: true, isSuperAdmin: true, isSystem: true, key: true, name: true },
        where: { id: roleId },
      })
      .then((role) => {
        if (!role) throw new NotFoundException("The GSS role was not found.");
        return role;
      });
  }

  private auditValue(user: Administrator): Prisma.InputJsonObject {
    return {
      email: user.email,
      id: user.id,
      isActive: user.isActive,
      name: user.name,
      phone: user.phone,
      roleId: user.role.id,
      roleKey: user.role.key,
    };
  }

  private deletionCapability(user: Administrator, activeSuperAdmins: number) {
    if (user.isActive && user.role.isSuperAdmin && activeSuperAdmins <= 1) {
      return {
        allowed: false,
        blocker: "The last active GSS super admin cannot be deleted.",
        code: "LAST_ACTIVE_GSS_SUPER_ADMIN",
        mode: "NOT_ALLOWED" as const,
      };
    }
    return { allowed: true, blocker: null, code: null, mode: "HARD_DELETE" as const };
  }

  private lockSafeAdminPolicy(tx: Prisma.TransactionClient) {
    return tx.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('gss-active-super-admin'))::text AS "lock"`,
    );
  }

  private optionalText(value: string | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private rethrowUniqueEmail(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictException("A GSS Administrator with this email already exists.");
    }
  }
}
