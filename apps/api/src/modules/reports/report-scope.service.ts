import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type { AuthTokenPayload } from "../../common/auth.types";
import { AUTH_CONTEXT } from "../../common/auth.types";
import { PrismaService } from "../../prisma/prisma.service";
import type { ReportFiltersDto } from "./dto/reports.dto";

export interface ResolvedReportScope {
  companyId?: string;
  areaId?: string;
  buildingId?: string;
  gatewayId?: string;
  nodeTypeId?: string;
  allowedAreaIds?: string[];
  allowedBuildingIds?: string[];
  snapshot: Prisma.InputJsonObject;
}

interface CompanyScope {
  companyId: string;
  isOwner: boolean;
  userId: string;
  areaIds: string[];
  buildingIds: string[];
}

@Injectable()
export class ReportScopeService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolve(
    auth: AuthTokenPayload,
    filters: ReportFiltersDto = {},
  ): Promise<ResolvedReportScope> {
    if (auth.context === AUTH_CONTEXT.gssAdmin) {
      return this.resolveGlobalScope(filters);
    }

    const scope = await this.getCompanyScope(auth.sub);
    if (filters.companyId && filters.companyId !== scope.companyId) {
      throw new ForbiddenException("The report company is outside the authenticated company.");
    }

    const selected = await this.resolveSelectedResources(filters, scope.companyId);
    const accessibleBuildingIds = scope.buildingIds;
    const selectedAreaId = selected.areaId;
    const selectedBuildingId = selected.buildingId;

    if (selectedAreaId) {
      const allowedInArea = accessibleBuildingIds.filter((id) => selected.buildingIds.includes(id));
      if (!scope.isOwner && !scope.areaIds.includes(selectedAreaId) && allowedInArea.length === 0) {
        throw new ForbiddenException("The report site is outside the assigned scope.");
      }
    }

    if (selectedBuildingId && !accessibleBuildingIds.includes(selectedBuildingId)) {
      throw new ForbiddenException("The report building is outside the assigned scope.");
    }
    if (
      selected.gatewayId &&
      !scope.isOwner &&
      !selected.gatewayBuildingIds.some((id) => accessibleBuildingIds.includes(id))
    ) {
      throw new ForbiddenException("The report gateway is outside the assigned scope.");
    }

    const filteredBuildingIds = selectedAreaId
      ? accessibleBuildingIds.filter((id) => selected.buildingIds.includes(id))
      : selectedBuildingId
        ? [selectedBuildingId]
        : selected.gatewayId
          ? accessibleBuildingIds.filter((id) => selected.gatewayBuildingIds.includes(id))
          : accessibleBuildingIds;
    const filteredAreaIds = selectedAreaId
      ? [selectedAreaId]
      : selectedBuildingId
        ? selected.areaId
          ? [selected.areaId]
          : []
        : [...new Set([...scope.areaIds, ...selected.buildingAreaIds])];

    return {
      allowedAreaIds: filteredAreaIds,
      allowedBuildingIds: filteredBuildingIds,
      areaId: selectedAreaId,
      buildingId: selectedBuildingId,
      companyId: scope.companyId,
      gatewayId: selected.gatewayId,
      nodeTypeId: filters.nodeTypeId,
      snapshot: {
        access: "company",
        allowedAreaIds: filteredAreaIds,
        allowedBuildingIds: filteredBuildingIds,
        areaId: selectedAreaId ?? null,
        buildingId: selectedBuildingId ?? null,
        companyId: scope.companyId,
        gatewayId: selected.gatewayId ?? null,
        nodeTypeId: filters.nodeTypeId ?? null,
      },
    };
  }

  async canAccessJob(
    auth: AuthTokenPayload,
    job: {
      requestedByType: string;
      companyId: string | null;
      areaId: string | null;
      buildingId: string | null;
      scopeSnapshot: Prisma.JsonValue;
    },
  ): Promise<boolean> {
    if (auth.context === AUTH_CONTEXT.gssAdmin) return true;
    if (job.requestedByType !== "COMPANY_USER") return false;
    const scope = await this.getCompanyScope(auth.sub);
    if (job.companyId !== scope.companyId) return false;
    if (job.buildingId && !scope.buildingIds.includes(job.buildingId)) return false;
    if (
      job.areaId &&
      !scope.areaIds.includes(job.areaId) &&
      !this.hasBuildingInArea(scope, job.areaId)
    ) {
      return false;
    }

    const snapshot = this.readSnapshot(job.scopeSnapshot);
    return snapshot.allowedBuildingIds.every((id) => scope.buildingIds.includes(id));
  }

  async accessibleBuildingIds(auth: AuthTokenPayload): Promise<string[] | undefined> {
    if (auth.context === AUTH_CONTEXT.gssAdmin) return undefined;
    return (await this.getCompanyScope(auth.sub)).buildingIds;
  }

  private async resolveGlobalScope(filters: ReportFiltersDto): Promise<ResolvedReportScope> {
    if (filters.companyId) {
      const company = await this.prisma.company.findFirst({
        select: { id: true },
        where: { deletedAt: null, id: filters.companyId, status: "ACTIVE" },
      });
      if (!company) throw new BadRequestException("The report company was not found.");
    }
    const selected = await this.resolveSelectedResources(filters, filters.companyId);
    return {
      areaId: selected.areaId,
      buildingId: selected.buildingId,
      companyId: filters.companyId ?? selected.companyId,
      gatewayId: selected.gatewayId,
      nodeTypeId: filters.nodeTypeId,
      snapshot: {
        access: "global",
        areaId: selected.areaId ?? null,
        buildingId: selected.buildingId ?? null,
        companyId: filters.companyId ?? selected.companyId ?? null,
        gatewayId: selected.gatewayId ?? null,
        nodeTypeId: filters.nodeTypeId ?? null,
      },
    };
  }

  private async resolveSelectedResources(filters: ReportFiltersDto, expectedCompanyId?: string) {
    const building = filters.buildingId
      ? await this.prisma.constructionBuilding.findFirst({
          select: { areaId: true, companyId: true, id: true },
          where: {
            area: { deletedAt: null },
            company: { deletedAt: null, status: "ACTIVE" },
            deletedAt: null,
            id: filters.buildingId,
          },
        })
      : null;
    if (filters.buildingId && !building) {
      throw new BadRequestException("The report building was not found.");
    }
    if (building && expectedCompanyId && building.companyId !== expectedCompanyId) {
      throw new ForbiddenException("The report building is outside the authenticated company.");
    }
    if (building && filters.areaId && building.areaId !== filters.areaId) {
      throw new BadRequestException("The report site does not contain the selected building.");
    }

    const areaId = filters.areaId ?? building?.areaId;
    const area = areaId
      ? await this.prisma.constructionArea.findFirst({
          select: { companyId: true, id: true },
          where: {
            company: { deletedAt: null, status: "ACTIVE" },
            deletedAt: null,
            id: areaId,
          },
        })
      : null;
    if (areaId && !area) {
      throw new BadRequestException("The report site was not found.");
    }
    if (area && expectedCompanyId && area.companyId !== expectedCompanyId) {
      throw new ForbiddenException("The report site is outside the authenticated company.");
    }
    if (filters.companyId && area && area.companyId !== filters.companyId) {
      throw new BadRequestException("The report company does not contain the selected site.");
    }

    const gateway = filters.gatewayId
      ? await this.prisma.gateway.findUnique({
          select: {
            companyAssignments: {
              orderBy: { assignedAt: "desc" },
              select: { companyId: true },
              where: {
                company: { deletedAt: null, status: "ACTIVE" },
                status: "ACTIVE",
              },
            },
            buildingAssignments: {
              orderBy: { assignedAt: "desc" },
              select: { buildingId: true },
              where: {
                building: {
                  area: { deletedAt: null },
                  company: { deletedAt: null, status: "ACTIVE" },
                  deletedAt: null,
                },
                status: "ACTIVE",
              },
            },
            id: true,
          },
          where: { id: filters.gatewayId },
        })
      : null;
    if (filters.gatewayId && !gateway) {
      throw new BadRequestException("The report gateway was not found.");
    }
    const gatewayCompanyId = gateway?.companyAssignments[0]?.companyId;
    const gatewayBuildingIds = gateway?.buildingAssignments.map((item) => item.buildingId) ?? [];
    const selectedCompanyId = building?.companyId ?? area?.companyId ?? gatewayCompanyId;
    if (gateway && expectedCompanyId && gatewayCompanyId !== expectedCompanyId) {
      throw new ForbiddenException("The report gateway is outside the authenticated company.");
    }
    if (gateway && filters.companyId && gatewayCompanyId !== filters.companyId) {
      throw new BadRequestException("The report company does not contain the selected gateway.");
    }
    if (gateway && building && !gatewayBuildingIds.includes(building.id)) {
      throw new BadRequestException("The report gateway is not assigned to the selected building.");
    }

    const buildingRows = areaId
      ? await this.prisma.constructionBuilding.findMany({
          select: { areaId: true, id: true },
          where: {
            area: { deletedAt: null },
            company: { deletedAt: null, status: "ACTIVE" },
            areaId,
            deletedAt: null,
          },
        })
      : building
        ? [{ areaId: building.areaId, id: building.id }]
        : [];

    return {
      areaId,
      companyId: selectedCompanyId,
      buildingAreaIds: buildingRows.map((row) => row.areaId),
      buildingIds: buildingRows.map((row) => row.id),
      buildingId: building?.id,
      gatewayBuildingIds,
      gatewayCompanyId,
      gatewayId: gateway?.id,
    };
  }

  private async getCompanyScope(userId: string): Promise<CompanyScope> {
    const user = await this.prisma.companyUser.findUnique({
      include: { areaAccess: true, buildingAccess: true, company: true, role: true },
      where: { id: userId },
    });
    if (
      !user ||
      !user.isActive ||
      user.deletedAt ||
      user.company.deletedAt ||
      user.company.status !== "ACTIVE" ||
      user.role.deletedAt
    ) {
      throw new ForbiddenException("The company user is not active.");
    }

    const directAreaIds = user.areaAccess.map((item) => item.areaId);
    const directBuildingIds = user.buildingAccess.map((item) => item.buildingId);
    const inheritedBuildings = directAreaIds.length
      ? await this.prisma.constructionBuilding.findMany({
          select: { areaId: true, id: true },
          where: {
            area: { deletedAt: null },
            areaId: { in: directAreaIds },
            companyId: user.companyId,
            deletedAt: null,
          },
        })
      : [];
    const directBuildings = directBuildingIds.length
      ? await this.prisma.constructionBuilding.findMany({
          select: { areaId: true, id: true },
          where: {
            area: { deletedAt: null },
            companyId: user.companyId,
            deletedAt: null,
            id: { in: directBuildingIds },
          },
        })
      : [];
    const ownerBuildings = user.role.isCompanyOwnerRole
      ? await this.prisma.constructionBuilding.findMany({
          select: { areaId: true, id: true },
          where: { area: { deletedAt: null }, companyId: user.companyId, deletedAt: null },
        })
      : [];
    const buildingIds = [
      ...new Set([
        ...directBuildingIds,
        ...directBuildings.map((item) => item.id),
        ...inheritedBuildings.map((item) => item.id),
        ...ownerBuildings.map((item) => item.id),
      ]),
    ];
    const areaIds = [
      ...new Set([
        ...directAreaIds,
        ...directBuildings.map((item) => item.areaId),
        ...inheritedBuildings.map((item) => item.areaId),
        ...ownerBuildings.map((item) => item.areaId),
      ]),
    ];
    return {
      areaIds,
      buildingIds,
      companyId: user.companyId,
      isOwner: user.role.isCompanyOwnerRole,
      userId: user.id,
    };
  }

  private hasBuildingInArea(scope: CompanyScope, areaId: string): boolean {
    return scope.areaIds.includes(areaId);
  }

  private readSnapshot(value: Prisma.JsonValue): { allowedBuildingIds: string[] } {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return { allowedBuildingIds: [] };
    const snapshot = value as { allowedBuildingIds?: unknown };
    return {
      allowedBuildingIds: Array.isArray(snapshot.allowedBuildingIds)
        ? snapshot.allowedBuildingIds.filter((id): id is string => typeof id === "string")
        : [],
    };
  }
}
