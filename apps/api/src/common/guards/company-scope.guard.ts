import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { AuthenticatedRequest } from "../auth.types";
import { REQUIRED_SCOPE_KEY } from "../decorators/require-scope.decorator";
import type { ScopeRequirement } from "../decorators/require-scope.decorator";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CompanyScopeGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<ScopeRequirement>(REQUIRED_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requirement) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.auth?.user;

    if (!user || !("companyId" in user)) {
      throw new ForbiddenException("A company user is required for scoped access.");
    }

    const resourceId = request.params[requirement.param];
    if (!resourceId) {
      throw new ForbiddenException("The scoped resource identifier is required.");
    }

    const allowed = await this.hasScope(
      user.id,
      user.companyId,
      user.roleId,
      requirement,
      resourceId,
    );

    if (!allowed) {
      throw new ForbiddenException("The requested resource is outside the assigned scope.");
    }

    return true;
  }

  private async hasScope(
    userId: string,
    companyId: string,
    roleId: string,
    requirement: ScopeRequirement,
    resourceId: string,
  ): Promise<boolean> {
    if (requirement.type === "company") {
      return companyId === resourceId;
    }

    const role = await this.prisma.companyRole.findUnique({ where: { id: roleId } });
    if (!role) {
      return false;
    }

    if (requirement.type === "area") {
      const area = await this.prisma.constructionArea.findUnique({ where: { id: resourceId } });
      if (!area || area.companyId !== companyId) {
        return false;
      }

      if (role.isCompanyOwnerRole) {
        return true;
      }

      return Boolean(
        await this.prisma.companyUserAreaAccess.findUnique({
          where: { companyUserId_areaId: { companyUserId: userId, areaId: area.id } },
        }),
      );
    }

    const building = await this.prisma.constructionBuilding.findUnique({
      where: { id: resourceId },
    });
    if (!building || building.companyId !== companyId) {
      return false;
    }

    if (role.isCompanyOwnerRole) {
      return true;
    }

    const [buildingAccess, areaAccess] = await Promise.all([
      this.prisma.companyUserBuildingAccess.findUnique({
        where: { companyUserId_buildingId: { companyUserId: userId, buildingId: building.id } },
      }),
      this.prisma.companyUserAreaAccess.findUnique({
        where: { companyUserId_areaId: { companyUserId: userId, areaId: building.areaId } },
      }),
    ]);

    return Boolean(buildingAccess || areaAccess);
  }
}
