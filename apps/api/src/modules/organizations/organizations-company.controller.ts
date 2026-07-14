import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  ValidationPipe,
} from "@nestjs/common";

import type { AuthenticatedRequest } from "../../common/auth.types";
import { CompanyEndpoint } from "../../common/decorators/company-endpoint.decorator";
import { CurrentPrincipal } from "../../common/decorators/current-principal.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import {
  RequireAreaScope,
  RequireBuildingScope,
  RequireManageAreaScope,
  RequireManageBuildingScope,
} from "../../common/decorators/require-scope.decorator";
import {
  CreateAreaDto,
  CreateBuildingDto,
  CreateImagesDto,
  UpdateAreaDto,
  UpdateBuildingDto,
} from "./dto/organization.dto";
import { OrganizationsService } from "./organizations.service";

@CompanyEndpoint()
@Controller("company")
export class OrganizationsCompanyController {
  constructor(@Inject(OrganizationsService) private readonly organizations: OrganizationsService) {}

  @RequirePermissions("areas.view")
  @Get("areas")
  listAreas(@CurrentPrincipal() auth: AuthenticatedRequest["auth"]) {
    return this.organizations.listCompanyAreas(auth!.principal.sub);
  }

  @RequirePermissions("areas.create")
  @Post("areas")
  async createArea(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Body(new ValidationPipe({ expectedType: CreateAreaDto, transform: true })) dto: CreateAreaDto,
  ) {
    const context = await this.organizations.assertCompanyOwner(auth!.principal.sub);
    return this.organizations.createArea(auth!.principal, context.companyId, dto);
  }

  @RequirePermissions("areas.view")
  @RequireAreaScope("areaId")
  @Get("areas/:areaId")
  getArea(@CurrentPrincipal() auth: AuthenticatedRequest["auth"], @Param("areaId") areaId: string) {
    return this.organizations.assertCompanyArea(areaId, auth!.principal.sub);
  }

  @RequirePermissions("areas.update")
  @RequireManageAreaScope("areaId")
  @Patch("areas/:areaId")
  updateArea(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("areaId") areaId: string,
    @Body(new ValidationPipe({ expectedType: UpdateAreaDto, transform: true })) dto: UpdateAreaDto,
  ) {
    return this.organizations.updateArea(auth!.principal, areaId, dto);
  }

  @RequirePermissions("areas.delete")
  @RequireManageAreaScope("areaId")
  @Delete("areas/:areaId")
  deactivateArea(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("areaId") areaId: string,
  ) {
    return this.organizations.deactivateArea(auth!.principal, areaId);
  }

  @RequirePermissions("buildings.view")
  @Get("buildings")
  listBuildings(@CurrentPrincipal() auth: AuthenticatedRequest["auth"]) {
    return this.organizations.listCompanyBuildings(auth!.principal.sub);
  }

  @RequirePermissions("buildings.create")
  @RequireManageAreaScope("areaId")
  @Post("areas/:areaId/buildings")
  createBuilding(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("areaId") areaId: string,
    @Body(new ValidationPipe({ expectedType: CreateBuildingDto, transform: true }))
    dto: CreateBuildingDto,
  ) {
    return this.organizations.createBuilding(auth!.principal, areaId, dto);
  }

  @RequirePermissions("buildings.view")
  @RequireBuildingScope("buildingId")
  @Get("buildings/:buildingId")
  getBuilding(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
  ) {
    return this.organizations.assertCompanyBuilding(buildingId, auth!.principal.sub);
  }

  @RequirePermissions("buildings.update")
  @RequireManageBuildingScope("buildingId")
  @Patch("buildings/:buildingId")
  updateBuilding(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
    @Body(new ValidationPipe({ expectedType: UpdateBuildingDto, transform: true }))
    dto: UpdateBuildingDto,
  ) {
    return this.organizations.updateBuilding(auth!.principal, buildingId, dto);
  }

  @RequirePermissions("buildings.delete")
  @RequireManageBuildingScope("buildingId")
  @Delete("buildings/:buildingId")
  deactivateBuilding(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
  ) {
    return this.organizations.deactivateBuilding(auth!.principal, buildingId);
  }

  @RequirePermissions("building-plans.view")
  @RequireBuildingScope("buildingId")
  @Get("buildings/:buildingId/plan-images")
  listImages(@Param("buildingId") buildingId: string) {
    return this.organizations.listBuildingImages(buildingId);
  }

  @RequirePermissions("building-plans.manage")
  @RequireManageBuildingScope("buildingId")
  @Post("buildings/:buildingId/plan-images")
  addImages(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
    @Body(new ValidationPipe({ expectedType: CreateImagesDto, transform: true }))
    dto: CreateImagesDto,
  ) {
    return this.organizations.addBuildingImages(auth!.principal, buildingId, dto.images);
  }
}
