import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { hash } from "bcrypt";
import {
  AlarmCounterStatus,
  AuditActorType,
  GatewayCommandStatus,
  type Prisma,
} from "@prisma/client";

import { AUTH_CONTEXT, type AuthTokenPayload } from "../../common/auth.types";
import { type PaginationQueryDto, pageWindow, paginated } from "../../common/dto/pagination.dto";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { ensureDefaultCompanyRoles } from "../company-management/default-company-roles";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  CreateAreaDto,
  CreateBuildingDto,
  CreateCompanyDto,
  UpdateAreaDto,
  UpdateBuildingDto,
  UpdateCompanyDto,
} from "./dto/organization.dto";

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

const companySelect = {
  id: true,
  name: true,
  code: true,
  address: true,
  phone: true,
  email: true,
  logoKey: true,
  status: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CompanySelect;

const areaSelect = {
  id: true,
  companyId: true,
  name: true,
  address: true,
  description: true,
  status: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ConstructionAreaSelect;

const buildingSelect = {
  id: true,
  companyId: true,
  areaId: true,
  title: true,
  number: true,
  address: true,
  buildingType: true,
  startDate: true,
  status: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ConstructionBuildingSelect;

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
  ) {}

  async listCompanies(query: PaginationQueryDto) {
    const [companies, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        ...pageWindow(query),
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: companySelect,
        where: { deletedAt: null },
      }),
      this.prisma.company.count({ where: { deletedAt: null } }),
    ]);
    const items = await Promise.all(
      companies.map(async (company) => ({
        ...toPublicCompany(company),
        deletion: await this.getCompanyDeletionCapability(company.id),
      })),
    );
    return paginated(items, total, query);
  }

  async getCompany(companyId: string) {
    const company = await this.getCompanyOrThrow(companyId);
    return {
      ...toPublicCompany(company),
      deletion: await this.getCompanyDeletionCapability(companyId),
    };
  }

  async createCompany(actor: AuthTokenPayload, dto: CreateCompanyDto) {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          address: dto.address,
          code: dto.code,
          email: dto.email?.toLowerCase(),
          name: dto.name,
          phone: dto.phone,
        },
        select: companySelect,
      });

      const defaultRoles = await ensureDefaultCompanyRoles(company.id, tx);
      if (defaultRoles.missingTemplateKeys.length > 0) {
        throw new ConflictException(
          `Default company role templates are unavailable: ${defaultRoles.missingTemplateKeys.join(", ")}.`,
        );
      }
      const platformManagerRoleId = defaultRoles.roleIdsByKey.get("platform_manager");
      if (!platformManagerRoleId) {
        throw new ConflictException("The platform manager role template is unavailable.");
      }

      const platformManager = await tx.companyUser.create({
        data: {
          companyId: company.id,
          email: dto.platformManager.email.toLowerCase(),
          name: dto.platformManager.name,
          passwordHash: await hash(dto.platformManager.password, 12),
          phone: dto.platformManager.phone,
          roleId: platformManagerRoleId,
        },
        select: { email: true, id: true, name: true, roleId: true },
      });

      await this.auditLog.record(
        actor,
        {
          action: "company.create",
          entityId: company.id,
          entityType: "Company",
          newValue: { company: toPublicCompany(company), platformManager },
        },
        tx,
      );

      return { company: toPublicCompany(company), platformManager };
    });
  }

  async updateCompany(actor: AuthTokenPayload, companyId: string, dto: UpdateCompanyDto) {
    return this.prisma.$transaction(async (tx) => {
      const oldCompany = await this.getCompanyOrThrow(companyId, tx);
      const company = await tx.company.update({
        where: { id: companyId },
        data: {
          ...dto,
          email: dto.email?.toLowerCase(),
        },
        select: companySelect,
      });
      await this.auditLog.record(
        actor,
        {
          action: "company.update",
          entityId: companyId,
          entityType: "Company",
          newValue: toPublicCompany(company),
          oldValue: toPublicCompany(oldCompany),
        },
        tx,
      );
      return toPublicCompany(company);
    });
  }

  async archiveCompany(actor: AuthTokenPayload, companyId: string, reason?: string) {
    const archivedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Company" WHERE "id" = ${companyId}::uuid FOR UPDATE`;
      const company = await this.getCompanyOrThrow(companyId, tx);
      const buildingIds = (
        await tx.constructionBuilding.findMany({
          select: { id: true },
          where: { companyId, deletedAt: null },
        })
      ).map(({ id }) => id);
      await this.teardownArchivedScope(
        { buildingIds, companyId, reason, rootType: "Company" },
        actor,
        archivedAt,
        tx,
      );
      const archived = await tx.company.update({
        data: {
          deletedAt: archivedAt,
          deletedById: actor.sub,
          deletedByType: this.actorType(actor),
          deleteReason: reason,
          status: "INACTIVE",
        },
        select: companySelect,
        where: { id: companyId },
      });
      await tx.companyUser.updateMany({
        data: { isActive: false, tokenVersion: { increment: 1 } },
        where: { companyId, deletedAt: null },
      });
      await this.auditLog.record(
        actor,
        {
          action: "company.archive",
          entityId: companyId,
          entityType: "Company",
          newValue: { deletedAt: archivedAt.toISOString(), reason },
          oldValue: toPublicCompany(company),
          scope: { companyId },
        },
        tx,
      );
      return { archived: true, id: archived.id };
    });
  }

  async deactivateCompany(actor: AuthTokenPayload, companyId: string, reason?: string) {
    return this.archiveCompany(actor, companyId, reason);
  }

  async setCompanyStatus(
    actor: AuthTokenPayload,
    companyId: string,
    status: "ACTIVE" | "INACTIVE",
  ) {
    return this.updateCompany(actor, companyId, { status });
  }

  async deleteCompanyPermanently(actor: AuthTokenPayload, companyId: string): Promise<void> {
    await this.archiveCompany(actor, companyId);
  }

  async listAdminAreas(companyId: string, query: PaginationQueryDto) {
    await this.getCompanyOrThrow(companyId);
    const where = { companyId, deletedAt: null };
    const [areas, total] = await this.prisma.$transaction([
      this.prisma.constructionArea.findMany({
        ...pageWindow(query),
        where,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: areaSelect,
      }),
      this.prisma.constructionArea.count({ where }),
    ]);
    const items = await Promise.all(
      areas.map(async (area) => ({
        ...area,
        deletion: await this.getAreaDeletionCapability(area.id),
      })),
    );
    return paginated(items, total, query);
  }

  async createArea(actor: AuthTokenPayload, companyId: string, dto: CreateAreaDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.getCompanyOrThrow(companyId, tx);
      const area = await tx.constructionArea.create({
        data: { ...dto, companyId },
        select: areaSelect,
      });
      await this.auditLog.record(
        actor,
        {
          action: "construction-area.create",
          entityId: area.id,
          entityType: "ConstructionArea",
          newValue: area,
        },
        tx,
      );
      return area;
    });
  }

  async updateArea(actor: AuthTokenPayload, areaId: string, dto: UpdateAreaDto) {
    return this.prisma.$transaction(async (tx) => {
      const oldArea = await this.getAreaOrThrow(areaId, tx);
      const area = await tx.constructionArea.update({
        where: { id: areaId },
        data: dto,
        select: areaSelect,
      });
      await this.auditLog.record(
        actor,
        {
          action: "construction-area.update",
          entityId: area.id,
          entityType: "ConstructionArea",
          newValue: area,
          oldValue: oldArea,
        },
        tx,
      );
      return area;
    });
  }

  async archiveArea(actor: AuthTokenPayload, areaId: string, reason?: string) {
    const archivedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ConstructionArea" WHERE "id" = ${areaId}::uuid FOR UPDATE`;
      const area = await this.getAreaOrThrow(areaId, tx);
      const buildingIds = (
        await tx.constructionBuilding.findMany({
          select: { id: true },
          where: { areaId, deletedAt: null },
        })
      ).map(({ id }) => id);
      await this.teardownArchivedScope(
        { areaId, buildingIds, companyId: area.companyId, reason, rootType: "ConstructionArea" },
        actor,
        archivedAt,
        tx,
      );
      const archived = await tx.constructionArea.update({
        data: {
          deletedAt: archivedAt,
          deletedById: actor.sub,
          deletedByType: this.actorType(actor),
          deleteReason: reason,
          status: "INACTIVE",
        },
        where: { id: areaId },
      });
      await this.auditLog.record(
        actor,
        {
          action: "construction-area.archive",
          entityId: areaId,
          entityType: "ConstructionArea",
          newValue: { deletedAt: archivedAt.toISOString(), reason },
          oldValue: area,
          scope: { areaId, companyId: area.companyId },
        },
        tx,
      );
      return { archived: true, id: archived.id };
    });
  }

  async deactivateArea(actor: AuthTokenPayload, areaId: string, reason?: string) {
    return this.archiveArea(actor, areaId, reason);
  }

  async setAreaStatus(actor: AuthTokenPayload, areaId: string, status: "ACTIVE" | "INACTIVE") {
    return this.updateArea(actor, areaId, { status });
  }

  async deleteAreaPermanently(actor: AuthTokenPayload, areaId: string): Promise<void> {
    await this.archiveArea(actor, areaId);
  }

  async listAdminBuildings(companyId: string, query: PaginationQueryDto) {
    await this.getCompanyOrThrow(companyId);
    const where = { companyId, deletedAt: null, area: { deletedAt: null } };
    const [buildings, total] = await this.prisma.$transaction([
      this.prisma.constructionBuilding.findMany({
        ...pageWindow(query),
        where,
        orderBy: [{ title: "asc" }, { id: "asc" }],
        select: buildingSelect,
      }),
      this.prisma.constructionBuilding.count({ where }),
    ]);
    const items = await Promise.all(
      buildings.map(async (building) => ({
        ...building,
        deletion: await this.getBuildingDeletionCapability(building.id),
      })),
    );
    return paginated(items, total, query);
  }

  async createBuilding(actor: AuthTokenPayload, areaId: string, dto: CreateBuildingDto) {
    return this.prisma.$transaction(async (tx) => {
      const area = await this.getAreaOrThrow(areaId, tx);
      const building = await tx.constructionBuilding.create({
        data: {
          ...dto,
          areaId: area.id,
          companyId: area.companyId,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        },
        select: buildingSelect,
      });
      await this.auditLog.record(
        actor,
        {
          action: "construction-building.create",
          entityId: building.id,
          entityType: "ConstructionBuilding",
          newValue: building,
        },
        tx,
      );
      return building;
    });
  }

  async getBuilding(buildingId: string) {
    return this.getBuildingOrThrow(buildingId);
  }

  async updateBuilding(actor: AuthTokenPayload, buildingId: string, dto: UpdateBuildingDto) {
    return this.prisma.$transaction(async (tx) => {
      const oldBuilding = await this.getBuildingOrThrow(buildingId, tx);
      const building = await tx.constructionBuilding.update({
        where: { id: buildingId },
        data: { ...dto, startDate: dto.startDate ? new Date(dto.startDate) : undefined },
        select: buildingSelect,
      });
      await this.auditLog.record(
        actor,
        {
          action: "construction-building.update",
          entityId: building.id,
          entityType: "ConstructionBuilding",
          newValue: building,
          oldValue: oldBuilding,
        },
        tx,
      );
      return building;
    });
  }

  async archiveBuilding(actor: AuthTokenPayload, buildingId: string, reason?: string) {
    const archivedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ConstructionBuilding" WHERE "id" = ${buildingId}::uuid FOR UPDATE`;
      const building = await this.getBuildingOrThrow(buildingId, tx);
      await this.teardownArchivedScope(
        {
          areaId: building.areaId,
          buildingIds: [buildingId],
          companyId: building.companyId,
          reason,
          rootType: "ConstructionBuilding",
        },
        actor,
        archivedAt,
        tx,
      );
      const archived = await tx.constructionBuilding.update({
        data: {
          deletedAt: archivedAt,
          deletedById: actor.sub,
          deletedByType: this.actorType(actor),
          deleteReason: reason,
          status: "INACTIVE",
        },
        where: { id: buildingId },
      });
      await this.auditLog.record(
        actor,
        {
          action: "construction-building.archive",
          entityId: buildingId,
          entityType: "ConstructionBuilding",
          newValue: { deletedAt: archivedAt.toISOString(), reason },
          oldValue: building,
          scope: {
            areaId: building.areaId,
            buildingId,
            companyId: building.companyId,
          },
        },
        tx,
      );
      return { archived: true, id: archived.id };
    });
  }

  async deactivateBuilding(actor: AuthTokenPayload, buildingId: string, reason?: string) {
    return this.archiveBuilding(actor, buildingId, reason);
  }

  async setBuildingStatus(
    actor: AuthTokenPayload,
    buildingId: string,
    status: "ACTIVE" | "INACTIVE",
  ) {
    return this.updateBuilding(actor, buildingId, { status });
  }

  async deleteBuildingPermanently(actor: AuthTokenPayload, buildingId: string): Promise<void> {
    await this.archiveBuilding(actor, buildingId);
  }

  async listCompanyAreas(companyUserId: string, query: PaginationQueryDto) {
    const context = await this.getCompanyUserContext(companyUserId);
    const where: Prisma.ConstructionAreaWhereInput = context.isOwner
      ? { companyId: context.companyId, deletedAt: null }
      : {
          companyId: context.companyId,
          deletedAt: null,
          userAccess: { some: { companyUserId } },
        };
    const [areas, total] = await this.prisma.$transaction([
      this.prisma.constructionArea.findMany({
        ...pageWindow(query),
        where,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: areaSelect,
      }),
      this.prisma.constructionArea.count({ where }),
    ]);
    const items = await Promise.all(
      areas.map(async (area) => ({
        ...area,
        deletion: await this.getAreaDeletionCapability(area.id),
      })),
    );
    return paginated(items, total, query);
  }

  async listCompanyBuildings(companyUserId: string, query: PaginationQueryDto) {
    const context = await this.getCompanyUserContext(companyUserId);
    const where: Prisma.ConstructionBuildingWhereInput = context.isOwner
      ? { companyId: context.companyId, deletedAt: null, area: { deletedAt: null } }
      : {
          companyId: context.companyId,
          deletedAt: null,
          area: { deletedAt: null },
          OR: [
            { userAccess: { some: { companyUserId } } },
            { area: { userAccess: { some: { companyUserId } } } },
          ],
        };
    const [buildings, total] = await this.prisma.$transaction([
      this.prisma.constructionBuilding.findMany({
        ...pageWindow(query),
        where,
        orderBy: [{ title: "asc" }, { id: "asc" }],
        select: buildingSelect,
      }),
      this.prisma.constructionBuilding.count({ where }),
    ]);
    const items = await Promise.all(
      buildings.map(async (building) => ({
        ...building,
        deletion: await this.getBuildingDeletionCapability(building.id),
      })),
    );
    return paginated(items, total, query);
  }

  async assertCompanyArea(areaId: string, companyUserId: string) {
    const [area, context] = await Promise.all([
      this.getAreaOrThrow(areaId),
      this.getCompanyUserContext(companyUserId),
    ]);
    if (area.companyId !== context.companyId) {
      throw new NotFoundException("The construction area was not found.");
    }
    return area;
  }

  async assertCompanyBuilding(buildingId: string, companyUserId: string) {
    const [building, context] = await Promise.all([
      this.getBuildingOrThrow(buildingId),
      this.getCompanyUserContext(companyUserId),
    ]);
    if (building.companyId !== context.companyId) {
      throw new NotFoundException("The construction building was not found.");
    }
    return building;
  }

  async assertCompanyOwner(companyUserId: string) {
    const context = await this.getCompanyUserContext(companyUserId);
    if (!context.isOwner) {
      throw new NotFoundException("A company-wide scope assignment is required.");
    }
    return context;
  }

  private async getCompanyOrThrow(companyId: string, executor: PrismaExecutor = this.prisma) {
    const company = await executor.company.findUnique({
      where: { id: companyId, deletedAt: null },
      select: companySelect,
    });
    if (!company) {
      throw new NotFoundException("The company was not found.");
    }
    return company;
  }

  private async getAreaOrThrow(areaId: string, executor: PrismaExecutor = this.prisma) {
    const area = await executor.constructionArea.findUnique({
      where: { id: areaId, deletedAt: null, company: { deletedAt: null } },
      select: areaSelect,
    });
    if (!area) {
      throw new NotFoundException("The construction area was not found.");
    }
    return area;
  }

  private async getBuildingOrThrow(buildingId: string, executor: PrismaExecutor = this.prisma) {
    const building = await executor.constructionBuilding.findUnique({
      where: {
        id: buildingId,
        deletedAt: null,
        area: { deletedAt: null },
        company: { deletedAt: null },
      },
      select: buildingSelect,
    });
    if (!building) {
      throw new NotFoundException("The construction building was not found.");
    }
    return building;
  }

  private async getCompanyUserContext(companyUserId: string) {
    const user = await this.prisma.companyUser.findUnique({
      where: { id: companyUserId, deletedAt: null, company: { deletedAt: null } },
      select: { companyId: true, role: { select: { isCompanyOwnerRole: true } } },
    });
    if (!user) {
      throw new NotFoundException("The company user was not found.");
    }
    return { companyId: user.companyId, isOwner: user.role.isCompanyOwnerRole };
  }

  private actorType(actor: AuthTokenPayload) {
    return actor.context === AUTH_CONTEXT.gssAdmin
      ? AuditActorType.GSS_ADMIN
      : AuditActorType.COMPANY_USER;
  }

  private async teardownArchivedScope(
    scope: {
      areaId?: string;
      buildingIds: string[];
      companyId: string;
      reason?: string;
      rootType: "Company" | "ConstructionArea" | "ConstructionBuilding";
    },
    actor: AuthTokenPayload,
    archivedAt: Date,
    tx: Prisma.TransactionClient,
  ) {
    if (scope.buildingIds.length > 0) {
      await tx.gatewayBuildingAssignment.updateMany({
        data: {
          activeKey: `archived:${archivedAt.toISOString()}`,
          status: "ENDED",
          unassignedAt: archivedAt,
        },
        where: { buildingId: { in: scope.buildingIds }, status: "ACTIVE" },
      });
    }

    const rules = await tx.alarmRule.findMany({
      select: { id: true },
      where: {
        deletedAt: null,
        ...(scope.rootType === "Company"
          ? { companyId: scope.companyId }
          : scope.rootType === "ConstructionArea"
            ? { areaId: scope.areaId }
            : { buildingId: { in: scope.buildingIds } }),
      },
    });
    const ruleIds = rules.map(({ id }) => id);
    if (ruleIds.length > 0) {
      const policies = await tx.alarmRecipientPolicy.findMany({
        select: { id: true },
        where: { deletedAt: null, ruleId: { in: ruleIds } },
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
      await tx.alarmCounterState.updateMany({
        data: { currentCount: 0, status: AlarmCounterStatus.RESET, version: { increment: 1 } },
        where: { ruleId: { in: ruleIds } },
      });
      await Promise.all(
        rules.map(({ id }) =>
          tx.alarmRule.update({
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
    }

    const commands = await tx.gatewayCommand.findMany({
      select: { id: true },
      where: {
        deletedAt: null,
        status: { in: [GatewayCommandStatus.PENDING, GatewayCommandStatus.SENT] },
        OR: [
          { companyId: scope.companyId },
          ...(scope.areaId ? [{ areaId: scope.areaId }] : []),
          ...(scope.buildingIds.length > 0
            ? [
                { buildingId: { in: scope.buildingIds } },
                { provisioningRequest: { buildingId: { in: scope.buildingIds } } },
                {
                  alarmLevelDesiredApplications: {
                    some: { buildingId: { in: scope.buildingIds } },
                  },
                },
              ]
            : []),
        ],
      },
    });
    await Promise.all(
      commands.map(({ id }) =>
        tx.gatewayCommand.update({
          data: {
            activeKey: id,
            cancelledAt: archivedAt,
            failureReason: "Archived tenant scope cancelled the operational command.",
            status: GatewayCommandStatus.CANCELLED,
          },
          where: { id },
        }),
      ),
    );
  }

  private deletionCapability(blocker: string | null, code: string | null = null) {
    return blocker
      ? { allowed: false, blocker, code, mode: "NOT_ALLOWED" as const }
      : { allowed: true, blocker: null, code: null, mode: "ARCHIVE" as const };
  }

  private async getCompanyDeletionCapability(
    companyId: string,
    executor: PrismaExecutor = this.prisma,
  ) {
    void companyId;
    void executor;
    return this.deletionCapability(null);
  }

  private async getAreaDeletionCapability(areaId: string, executor: PrismaExecutor = this.prisma) {
    void areaId;
    void executor;
    return this.deletionCapability(null);
  }

  private async getBuildingDeletionCapability(
    buildingId: string,
    executor: PrismaExecutor = this.prisma,
  ) {
    void buildingId;
    void executor;
    return this.deletionCapability(null);
  }
}

function toPublicCompany<T extends { logoKey: string | null }>(company: T) {
  const { logoKey, ...record } = company;
  return { ...record, hasLogo: Boolean(logoKey) };
}
