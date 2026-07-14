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
import { AdminEndpoint } from "../../common/decorators/admin-endpoint.decorator";
import { CurrentPrincipal } from "../../common/decorators/current-principal.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import {
  CreateAreaDto,
  CreateBuildingDto,
  CreateCompanyDto,
  CreateImagesDto,
  UpdateAreaDto,
  UpdateBuildingDto,
  UpdateCompanyDto,
} from "./dto/organization.dto";
import { OrganizationsService } from "./organizations.service";

@AdminEndpoint()
@Controller("admin")
export class OrganizationsAdminController {
  constructor(@Inject(OrganizationsService) private readonly organizations: OrganizationsService) {}

  @RequirePermissions("companies.view")
  @Get("companies")
  listCompanies() {
    return this.organizations.listCompanies();
  }

  @RequirePermissions("companies.create")
  @Post("companies")
  createCompany(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Body(new ValidationPipe({ expectedType: CreateCompanyDto, transform: true }))
    dto: CreateCompanyDto,
  ) {
    return this.organizations.createCompany(auth!.principal, dto);
  }

  @RequirePermissions("companies.view")
  @Get("companies/:companyId")
  getCompany(@Param("companyId") companyId: string) {
    return this.organizations.getCompany(companyId);
  }

  @RequirePermissions("companies.update")
  @Patch("companies/:companyId")
  updateCompany(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("companyId") companyId: string,
    @Body(new ValidationPipe({ expectedType: UpdateCompanyDto, transform: true }))
    dto: UpdateCompanyDto,
  ) {
    return this.organizations.updateCompany(auth!.principal, companyId, dto);
  }

  @RequirePermissions("companies.delete")
  @Delete("companies/:companyId")
  deactivateCompany(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("companyId") companyId: string,
  ) {
    return this.organizations.deactivateCompany(auth!.principal, companyId);
  }

  @RequirePermissions("areas.view")
  @Get("companies/:companyId/areas")
  listAreas(@Param("companyId") companyId: string) {
    return this.organizations.listAdminAreas(companyId);
  }

  @RequirePermissions("areas.create")
  @Post("companies/:companyId/areas")
  createArea(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("companyId") companyId: string,
    @Body(new ValidationPipe({ expectedType: CreateAreaDto, transform: true })) dto: CreateAreaDto,
  ) {
    return this.organizations.createArea(auth!.principal, companyId, dto);
  }

  @RequirePermissions("areas.update")
  @Patch("areas/:areaId")
  updateArea(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("areaId") areaId: string,
    @Body(new ValidationPipe({ expectedType: UpdateAreaDto, transform: true })) dto: UpdateAreaDto,
  ) {
    return this.organizations.updateArea(auth!.principal, areaId, dto);
  }

  @RequirePermissions("areas.delete")
  @Delete("areas/:areaId")
  deactivateArea(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("areaId") areaId: string,
  ) {
    return this.organizations.deactivateArea(auth!.principal, areaId);
  }

  @RequirePermissions("buildings.view")
  @Get("companies/:companyId/buildings")
  listBuildings(@Param("companyId") companyId: string) {
    return this.organizations.listAdminBuildings(companyId);
  }

  @RequirePermissions("buildings.create")
  @Post("areas/:areaId/buildings")
  createBuilding(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("areaId") areaId: string,
    @Body(new ValidationPipe({ expectedType: CreateBuildingDto, transform: true }))
    dto: CreateBuildingDto,
  ) {
    return this.organizations.createBuilding(auth!.principal, areaId, dto);
  }

  @RequirePermissions("buildings.update")
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
  @Delete("buildings/:buildingId")
  deactivateBuilding(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
  ) {
    return this.organizations.deactivateBuilding(auth!.principal, buildingId);
  }

  @RequirePermissions("building-plans.manage")
  @Post("buildings/:buildingId/plan-images")
  addImages(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
    @Body(new ValidationPipe({ expectedType: CreateImagesDto, transform: true }))
    dto: CreateImagesDto,
  ) {
    return this.organizations.addBuildingImages(auth!.principal, buildingId, dto.images);
  }

  @RequirePermissions("building-plans.manage")
  @Delete("building-plan-images/:imageId")
  deleteImage(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("imageId") imageId: string,
  ) {
    return this.organizations.deleteBuildingImage(auth!.principal, imageId);
  }
}
