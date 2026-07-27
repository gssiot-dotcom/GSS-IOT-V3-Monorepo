import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { hash } from "bcrypt";
import type { Prisma } from "@prisma/client";

import type { AuthTokenPayload } from "../../common/auth.types";
import { type PaginationQueryDto, pageWindow, paginated } from "../../common/dto/pagination.dto";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { CompanyLogoStorageService } from "../company-branding/company-logo-storage.service";
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
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ConstructionBuildingSelect;

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
    @Inject(CompanyLogoStorageService) private readonly logoStorage: CompanyLogoStorageService,
  ) {}

  async listCompanies(query: PaginationQueryDto) {
    const [companies, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        ...pageWindow(query),
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: companySelect,
      }),
      this.prisma.company.count(),
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

  async deactivateCompany(actor: AuthTokenPayload, companyId: string) {
    return this.updateCompany(actor, companyId, { status: "INACTIVE" });
  }

  async setCompanyStatus(
    actor: AuthTokenPayload,
    companyId: string,
    status: "ACTIVE" | "INACTIVE",
  ) {
    return this.updateCompany(actor, companyId, { status });
  }

  async deleteCompanyPermanently(actor: AuthTokenPayload, companyId: string): Promise<void> {
    const company = await this.getCompanyOrThrow(companyId);
    const deletion = await this.getCompanyDeletionCapability(companyId);
    this.assertDeletionAllowed(deletion, "company", "DEACTIVATE");

    const storedLogo = company.logoKey ? await this.logoStorage.get(company.logoKey) : undefined;
    if (company.logoKey) {
      try {
        await this.logoStorage.remove(company.logoKey);
      } catch {
        throw new ConflictException({
          blocker: "companyLogoCleanup",
          code: "COMPANY_LOGO_CLEANUP_FAILED",
          message: "The private company logo could not be removed. Retry the deletion.",
          recommendedAlternative: "DEACTIVATE",
        });
      }
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const current = await this.getCompanyOrThrow(companyId, tx);
        this.assertDeletionAllowed(
          await this.getCompanyDeletionCapability(companyId, tx),
          "company",
          "DEACTIVATE",
        );
        await tx.company.delete({ where: { id: companyId } });
        await this.auditLog.record(
          actor,
          {
            action: "company.delete",
            entityId: companyId,
            entityType: "Company",
            oldValue: toPublicCompany(current),
          },
          tx,
        );
      });
    } catch (error) {
      if (company.logoKey && storedLogo) {
        await this.logoStorage
          .put(company.logoKey, storedLogo.body, storedLogo.contentType)
          .catch(() => undefined);
      }
      throw error;
    }
  }

  async listAdminAreas(companyId: string, query: PaginationQueryDto) {
    await this.getCompanyOrThrow(companyId);
    const where = { companyId };
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

  async deactivateArea(actor: AuthTokenPayload, areaId: string) {
    return this.updateArea(actor, areaId, { status: "INACTIVE" });
  }

  async setAreaStatus(actor: AuthTokenPayload, areaId: string, status: "ACTIVE" | "INACTIVE") {
    return this.updateArea(actor, areaId, { status });
  }

  async deleteAreaPermanently(actor: AuthTokenPayload, areaId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const area = await this.getAreaOrThrow(areaId, tx);
      this.assertDeletionAllowed(
        await this.getAreaDeletionCapability(areaId, tx),
        "construction area",
        "DEACTIVATE",
      );
      await tx.constructionArea.delete({ where: { id: areaId } });
      await this.auditLog.record(
        actor,
        {
          action: "construction-area.delete",
          entityId: areaId,
          entityType: "ConstructionArea",
          oldValue: area,
        },
        tx,
      );
    });
  }

  async listAdminBuildings(companyId: string, query: PaginationQueryDto) {
    await this.getCompanyOrThrow(companyId);
    const where = { companyId };
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

  async deactivateBuilding(actor: AuthTokenPayload, buildingId: string) {
    return this.updateBuilding(actor, buildingId, { status: "INACTIVE" });
  }

  async setBuildingStatus(
    actor: AuthTokenPayload,
    buildingId: string,
    status: "ACTIVE" | "INACTIVE",
  ) {
    return this.updateBuilding(actor, buildingId, { status });
  }

  async deleteBuildingPermanently(actor: AuthTokenPayload, buildingId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const building = await this.getBuildingOrThrow(buildingId, tx);
      this.assertDeletionAllowed(
        await this.getBuildingDeletionCapability(buildingId, tx),
        "construction building",
        "DEACTIVATE",
      );
      await tx.constructionBuilding.delete({ where: { id: buildingId } });
      await this.auditLog.record(
        actor,
        {
          action: "construction-building.delete",
          entityId: buildingId,
          entityType: "ConstructionBuilding",
          oldValue: building,
        },
        tx,
      );
    });
  }

  async listCompanyAreas(companyUserId: string, query: PaginationQueryDto) {
    const context = await this.getCompanyUserContext(companyUserId);
    const where: Prisma.ConstructionAreaWhereInput = context.isOwner
      ? { companyId: context.companyId }
      : { companyId: context.companyId, userAccess: { some: { companyUserId } } };
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
      ? { companyId: context.companyId }
      : {
          companyId: context.companyId,
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
      where: { id: companyId },
      select: companySelect,
    });
    if (!company) {
      throw new NotFoundException("The company was not found.");
    }
    return company;
  }

  private async getAreaOrThrow(areaId: string, executor: PrismaExecutor = this.prisma) {
    const area = await executor.constructionArea.findUnique({
      where: { id: areaId },
      select: areaSelect,
    });
    if (!area) {
      throw new NotFoundException("The construction area was not found.");
    }
    return area;
  }

  private async getBuildingOrThrow(buildingId: string, executor: PrismaExecutor = this.prisma) {
    const building = await executor.constructionBuilding.findUnique({
      where: { id: buildingId },
      select: buildingSelect,
    });
    if (!building) {
      throw new NotFoundException("The construction building was not found.");
    }
    return building;
  }

  private async getCompanyUserContext(companyUserId: string) {
    const user = await this.prisma.companyUser.findUnique({
      where: { id: companyUserId },
      select: { companyId: true, role: { select: { isCompanyOwnerRole: true } } },
    });
    if (!user) {
      throw new NotFoundException("The company user was not found.");
    }
    return { companyId: user.companyId, isOwner: user.role.isCompanyOwnerRole };
  }

  private deletionCapability(blocker: string | null, code: string | null = null) {
    return blocker
      ? { allowed: false, blocker, code, mode: "NOT_ALLOWED" as const }
      : { allowed: true, blocker: null, code: null, mode: "HARD_DELETE" as const };
  }

  private assertDeletionAllowed(
    deletion: ReturnType<OrganizationsService["deletionCapability"]>,
    entityLabel: string,
    recommendedAlternative: string,
  ) {
    if (deletion.allowed) return;
    throw new ConflictException({
      blocker: deletion.blocker,
      code: deletion.code ?? "PROTECTED_HISTORY_EXISTS",
      message: `This ${entityLabel} has protected relationships or history and cannot be hard-deleted.`,
      recommendedAlternative,
    });
  }

  private async getCompanyDeletionCapability(
    companyId: string,
    executor: PrismaExecutor = this.prisma,
  ) {
    const [
      areas,
      buildings,
      users,
      roles,
      positions,
      assignments,
      alarmRules,
      alarmEvents,
      reports,
    ] = await Promise.all([
      executor.constructionArea.count({ where: { companyId } }),
      executor.constructionBuilding.count({ where: { companyId } }),
      executor.companyUser.count({ where: { companyId } }),
      executor.companyRole.count({ where: { companyId } }),
      executor.companyPosition.count({ where: { companyId } }),
      executor.companyDeviceAssignment.count({ where: { companyId } }),
      executor.alarmRule.count({ where: { companyId } }),
      executor.alarmEvent.count({ where: { companyId } }),
      executor.reportJob.count({ where: { companyId } }),
    ]);
    if (areas) return this.deletionCapability("childSites", "COMPANY_HAS_SITES");
    if (buildings) return this.deletionCapability("childBuildings", "COMPANY_HAS_BUILDINGS");
    if (assignments)
      return this.deletionCapability("deviceAssignmentHistory", "COMPANY_HAS_DEVICE_HISTORY");
    if (alarmRules || alarmEvents)
      return this.deletionCapability("alarmHistory", "COMPANY_HAS_ALARM_HISTORY");
    if (reports) return this.deletionCapability("reportHistory", "COMPANY_HAS_REPORT_HISTORY");
    if (users) return this.deletionCapability("companyUsers", "COMPANY_HAS_USERS");
    if (positions) return this.deletionCapability("companyPositions", "COMPANY_HAS_POSITIONS");
    if (roles) return this.deletionCapability("companyRoles", "COMPANY_HAS_ROLES");
    return this.deletionCapability(null);
  }

  private async getAreaDeletionCapability(areaId: string, executor: PrismaExecutor = this.prisma) {
    const [buildings, access, positions, rules, events, readings, reports] = await Promise.all([
      executor.constructionBuilding.count({ where: { areaId } }),
      executor.companyUserAreaAccess.count({ where: { areaId } }),
      executor.companyUserPositionAssignment.count({ where: { areaId } }),
      executor.alarmRule.count({ where: { areaId } }),
      executor.alarmEvent.count({ where: { areaId } }),
      executor.sensorReading.count({ where: { areaId } }),
      executor.reportJob.count({ where: { areaId } }),
    ]);
    if (buildings) return this.deletionCapability("childBuildings", "AREA_HAS_BUILDINGS");
    if (access || positions)
      return this.deletionCapability("userScopeHistory", "AREA_HAS_SCOPE_HISTORY");
    if (rules || events || readings)
      return this.deletionCapability("operationalHistory", "AREA_HAS_OPERATIONAL_HISTORY");
    if (reports) return this.deletionCapability("reportHistory", "AREA_HAS_REPORT_HISTORY");
    return this.deletionCapability(null);
  }

  private async getBuildingDeletionCapability(
    buildingId: string,
    executor: PrismaExecutor = this.prisma,
  ) {
    const [
      images,
      access,
      positions,
      gatewayAssignments,
      provisioning,
      levels,
      rules,
      events,
      readings,
      latest,
      reports,
    ] = await Promise.all([
      executor.buildingPlanImage.count({ where: { buildingId } }),
      executor.companyUserBuildingAccess.count({ where: { buildingId } }),
      executor.companyUserPositionAssignment.count({ where: { buildingId } }),
      executor.gatewayBuildingAssignment.count({ where: { buildingId } }),
      executor.nodeGatewayProvisioningRequest.count({ where: { buildingId } }),
      executor.buildingAlarmLevelConfiguration.count({ where: { buildingId } }),
      executor.alarmRule.count({ where: { buildingId } }),
      executor.alarmEvent.count({ where: { buildingId } }),
      executor.sensorReading.count({ where: { buildingId } }),
      executor.latestNodeState.count({ where: { buildingId } }),
      executor.reportJob.count({ where: { buildingId } }),
    ]);
    if (images) return this.deletionCapability("buildingPlanAssets", "BUILDING_HAS_ASSETS");
    if (access || positions)
      return this.deletionCapability("userScopeHistory", "BUILDING_HAS_SCOPE_HISTORY");
    if (gatewayAssignments || provisioning)
      return this.deletionCapability("deviceAssignmentHistory", "BUILDING_HAS_DEVICE_HISTORY");
    if (levels || rules || events || readings || latest)
      return this.deletionCapability("operationalHistory", "BUILDING_HAS_OPERATIONAL_HISTORY");
    if (reports) return this.deletionCapability("reportHistory", "BUILDING_HAS_REPORT_HISTORY");
    return this.deletionCapability(null);
  }
}

function toPublicCompany<T extends { logoKey: string | null }>(company: T) {
  const { logoKey, ...record } = company;
  return { ...record, hasLogo: Boolean(logoKey) };
}
