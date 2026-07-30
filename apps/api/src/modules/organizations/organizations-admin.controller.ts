import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
  ValidationPipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import type { AuthenticatedRequest } from "../../common/auth.types";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import { AdminEndpoint } from "../../common/decorators/admin-endpoint.decorator";
import { CurrentPrincipal } from "../../common/decorators/current-principal.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import {
  ArchiveReasonDto,
  CreateAreaDto,
  CreateBuildingDto,
  CreateCompanyDto,
  UploadBuildingImageDto,
  UpdateAreaDto,
  UpdateBuildingDto,
  UpdateCompanyDto,
  UpdateOrganizationStatusDto,
} from "./dto/organization.dto";
import {
  BUILDING_IMAGE_MAX_BYTES,
  type UploadedBuildingImage,
  validateBuildingImageFile,
} from "./building-image-file";
import { BuildingImagesService } from "./building-images.service";
import { type BuildingImageResponse, streamBuildingImage } from "./building-image-stream";
import { OrganizationsService } from "./organizations.service";

const buildingImageUploadInterceptor = FileInterceptor("image", {
  limits: { fileSize: BUILDING_IMAGE_MAX_BYTES, files: 1 },
});

@AdminEndpoint()
@Controller("admin")
export class OrganizationsAdminController {
  constructor(
    @Inject(OrganizationsService) private readonly organizations: OrganizationsService,
    @Inject(BuildingImagesService) private readonly buildingImages: BuildingImagesService,
  ) {}

  @RequirePermissions("companies.view")
  @Get("companies")
  listCompanies(
    @Query(new ValidationPipe({ expectedType: PaginationQueryDto, transform: true }))
    query: PaginationQueryDto,
  ) {
    return this.organizations.listCompanies(query);
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
    @Body(new ValidationPipe({ expectedType: ArchiveReasonDto, transform: true }))
    dto: ArchiveReasonDto,
  ) {
    return this.organizations.archiveCompany(auth!.principal, companyId, dto.reason);
  }

  @RequirePermissions("companies.update")
  @Patch("companies/:companyId/status")
  setCompanyStatus(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("companyId") companyId: string,
    @Body(new ValidationPipe({ expectedType: UpdateOrganizationStatusDto, transform: true }))
    dto: UpdateOrganizationStatusDto,
  ) {
    return this.organizations.setCompanyStatus(auth!.principal, companyId, dto.status);
  }

  @RequirePermissions("areas.view")
  @Get("companies/:companyId/areas")
  listAreas(
    @Param("companyId") companyId: string,
    @Query(new ValidationPipe({ expectedType: PaginationQueryDto, transform: true }))
    query: PaginationQueryDto,
  ) {
    return this.organizations.listAdminAreas(companyId, query);
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
    @Body(new ValidationPipe({ expectedType: ArchiveReasonDto, transform: true }))
    dto: ArchiveReasonDto,
  ) {
    return this.organizations.archiveArea(auth!.principal, areaId, dto.reason);
  }

  @RequirePermissions("areas.update")
  @Patch("areas/:areaId/status")
  setAreaStatus(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("areaId") areaId: string,
    @Body(new ValidationPipe({ expectedType: UpdateOrganizationStatusDto, transform: true }))
    dto: UpdateOrganizationStatusDto,
  ) {
    return this.organizations.setAreaStatus(auth!.principal, areaId, dto.status);
  }

  @RequirePermissions("buildings.view")
  @Get("companies/:companyId/buildings")
  listBuildings(
    @Param("companyId") companyId: string,
    @Query(new ValidationPipe({ expectedType: PaginationQueryDto, transform: true }))
    query: PaginationQueryDto,
  ) {
    return this.organizations.listAdminBuildings(companyId, query);
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
    @Body(new ValidationPipe({ expectedType: ArchiveReasonDto, transform: true }))
    dto: ArchiveReasonDto,
  ) {
    return this.organizations.archiveBuilding(auth!.principal, buildingId, dto.reason);
  }

  @RequirePermissions("buildings.update")
  @Patch("buildings/:buildingId/status")
  setBuildingStatus(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
    @Body(new ValidationPipe({ expectedType: UpdateOrganizationStatusDto, transform: true }))
    dto: UpdateOrganizationStatusDto,
  ) {
    return this.organizations.setBuildingStatus(auth!.principal, buildingId, dto.status);
  }

  @RequirePermissions("building-plans.view")
  @Get("buildings/:buildingId/images")
  listImages(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
  ) {
    return this.buildingImages.list(auth!.principal, buildingId);
  }

  @RequirePermissions("building-plans.manage")
  @Post("buildings/:buildingId/images")
  @UseInterceptors(buildingImageUploadInterceptor)
  uploadImage(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
    @Body(new ValidationPipe({ expectedType: UploadBuildingImageDto, transform: true }))
    dto: UploadBuildingImageDto,
    @UploadedFile() file?: UploadedBuildingImage,
  ) {
    return this.buildingImages.upload(
      auth!.principal,
      buildingId,
      dto.kind,
      validateBuildingImageFile(file),
    );
  }

  @RequirePermissions("building-plans.view")
  @Get("building-images/:imageId/content")
  async getImageContent(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("imageId") imageId: string,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: BuildingImageResponse,
  ) {
    return streamBuildingImage(
      this.buildingImages,
      auth!.principal,
      imageId,
      ifNoneMatch,
      response,
    );
  }

  @RequirePermissions("building-plans.manage")
  @Delete("building-images/:imageId")
  deleteImage(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("imageId") imageId: string,
  ) {
    return this.buildingImages.requestDelete(auth!.principal, imageId);
  }
}
