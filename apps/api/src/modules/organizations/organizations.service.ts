import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { hash } from "bcrypt";
import type { Prisma } from "@prisma/client";

import type { AuthTokenPayload } from "../../common/auth.types";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  CreateAreaDto,
  CreateBuildingDto,
  CreateBuildingPlanImageDto,
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
  ) {}

  async listCompanies() {
    return this.prisma.company.findMany({ orderBy: { name: "asc" }, select: companySelect });
  }

  async getCompany(companyId: string) {
    return this.getCompanyOrThrow(companyId);
  }

  async createCompany(actor: AuthTokenPayload, dto: CreateCompanyDto) {
    return this.prisma.$transaction(async (tx) => {
      const templates = await tx.companyRole.findMany({
        where: { companyId: null, isSystem: true },
        include: { permissions: { select: { permissionId: true } } },
      });
      const platformTemplate = templates.find((template) => template.key === "platform_manager");

      if (!platformTemplate) {
        throw new ConflictException("The platform manager role template is unavailable.");
      }

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

      const roleByKey = new Map<string, string>();
      for (const template of templates) {
        const role = await tx.companyRole.create({
          data: {
            companyId: company.id,
            isCompanyOwnerRole: template.isCompanyOwnerRole,
            key: template.key,
            name: template.name,
            permissions: {
              createMany: {
                data: template.permissions.map(({ permissionId }) => ({ permissionId })),
              },
            },
          },
        });
        roleByKey.set(template.key, role.id);
      }

      const platformManager = await tx.companyUser.create({
        data: {
          companyId: company.id,
          email: dto.platformManager.email.toLowerCase(),
          name: dto.platformManager.name,
          passwordHash: await hash(dto.platformManager.password, 12),
          phone: dto.platformManager.phone,
          roleId: roleByKey.get("platform_manager")!,
        },
        select: { email: true, id: true, name: true, roleId: true },
      });

      await this.auditLog.record(
        actor,
        {
          action: "company.create",
          entityId: company.id,
          entityType: "Company",
          newValue: { company, platformManager },
        },
        tx,
      );

      return { company, platformManager };
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
          newValue: company,
          oldValue: oldCompany,
        },
        tx,
      );
      return company;
    });
  }

  async deactivateCompany(actor: AuthTokenPayload, companyId: string) {
    return this.updateCompany(actor, companyId, { status: "INACTIVE" });
  }

  async listAdminAreas(companyId: string) {
    await this.getCompanyOrThrow(companyId);
    return this.prisma.constructionArea.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      select: areaSelect,
    });
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

  async listAdminBuildings(companyId: string) {
    await this.getCompanyOrThrow(companyId);
    return this.prisma.constructionBuilding.findMany({
      where: { companyId },
      orderBy: { title: "asc" },
      select: buildingSelect,
    });
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

  async addBuildingImages(
    actor: AuthTokenPayload,
    buildingId: string,
    images: CreateBuildingPlanImageDto[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.getBuildingOrThrow(buildingId, tx);
      const created = await Promise.all(
        images.map((image) =>
          tx.buildingPlanImage.create({ data: { ...image, buildingId }, select: imageSelect }),
        ),
      );
      await this.auditLog.record(
        actor,
        {
          action: "building-plan-image.create",
          entityId: buildingId,
          entityType: "ConstructionBuilding",
          newValue: { images: created },
        },
        tx,
      );
      return created;
    });
  }

  async listBuildingImages(buildingId: string) {
    await this.getBuildingOrThrow(buildingId);
    return this.prisma.buildingPlanImage.findMany({
      where: { buildingId },
      orderBy: [{ kind: "asc" }, { orderIndex: "asc" }],
      select: imageSelect,
    });
  }

  async deleteBuildingImage(actor: AuthTokenPayload, imageId: string) {
    return this.prisma.$transaction(async (tx) => {
      const image = await tx.buildingPlanImage.findUnique({
        where: { id: imageId },
        select: imageSelect,
      });
      if (!image) {
        throw new NotFoundException("The building image was not found.");
      }
      await tx.buildingPlanImage.delete({ where: { id: imageId } });
      await this.auditLog.record(
        actor,
        {
          action: "building-plan-image.delete",
          entityId: imageId,
          entityType: "BuildingPlanImage",
          oldValue: image,
        },
        tx,
      );
    });
  }

  async listCompanyAreas(companyUserId: string) {
    const context = await this.getCompanyUserContext(companyUserId);
    return this.prisma.constructionArea.findMany({
      where: context.isOwner
        ? { companyId: context.companyId }
        : { companyId: context.companyId, userAccess: { some: { companyUserId } } },
      orderBy: { name: "asc" },
      select: areaSelect,
    });
  }

  async listCompanyBuildings(companyUserId: string) {
    const context = await this.getCompanyUserContext(companyUserId);
    return this.prisma.constructionBuilding.findMany({
      where: context.isOwner
        ? { companyId: context.companyId }
        : {
            companyId: context.companyId,
            OR: [
              { userAccess: { some: { companyUserId } } },
              { area: { userAccess: { some: { companyUserId } } } },
            ],
          },
      orderBy: { title: "asc" },
      select: buildingSelect,
    });
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
}

const imageSelect = {
  id: true,
  buildingId: true,
  kind: true,
  storageKey: true,
  orderIndex: true,
  width: true,
  height: true,
  createdAt: true,
} satisfies Prisma.BuildingPlanImageSelect;
