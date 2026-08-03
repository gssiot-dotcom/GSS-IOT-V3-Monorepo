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
  ArchiveReasonDto,
  CreateBuildingDto,
  UploadBuildingImageDto,
  UpdateAreaDto,
  UpdateBuildingDto,
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

@CompanyEndpoint()
@Controller("company")
export class OrganizationsCompanyController {
  constructor(
    @Inject(OrganizationsService) private readonly organizations: OrganizationsService,
    @Inject(BuildingImagesService) private readonly buildingImages: BuildingImagesService,
  ) {}

  @RequirePermissions("areas.view")
  @Get("areas")
  listAreas(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Query(new ValidationPipe({ expectedType: PaginationQueryDto, transform: true }))
    query: PaginationQueryDto,
  ) {
    return this.organizations.listCompanyAreas(auth!.principal.sub, query);
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

  @RequirePermissions("areas.view")
  @RequireAreaScope("areaId")
  @Get("areas/:areaId/overview")
  getAreaOverview(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("areaId") areaId: string,
  ) {
    return this.organizations.getCompanyAreaOverview(areaId, auth!.principal.sub);
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
    @Body(new ValidationPipe({ expectedType: ArchiveReasonDto, transform: true }))
    dto: ArchiveReasonDto,
  ) {
    return this.organizations.archiveArea(auth!.principal, areaId, dto.reason);
  }

  @RequirePermissions("areas.update")
  @RequireManageAreaScope("areaId")
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
  @Get("buildings")
  listBuildings(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Query(new ValidationPipe({ expectedType: PaginationQueryDto, transform: true }))
    query: PaginationQueryDto,
  ) {
    return this.organizations.listCompanyBuildings(auth!.principal.sub, query);
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

  @RequirePermissions("buildings.view")
  @RequireBuildingScope("buildingId")
  @Get("buildings/:buildingId/overview")
  getBuildingOverview(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
  ) {
    return this.organizations.getCompanyBuildingOverview(buildingId, auth!.principal.sub);
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
    @Body(new ValidationPipe({ expectedType: ArchiveReasonDto, transform: true }))
    dto: ArchiveReasonDto,
  ) {
    return this.organizations.archiveBuilding(auth!.principal, buildingId, dto.reason);
  }

  @RequirePermissions("buildings.update")
  @RequireManageBuildingScope("buildingId")
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
  @RequireBuildingScope("buildingId")
  @Get("buildings/:buildingId/images")
  listImages(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
  ) {
    return this.buildingImages.list(auth!.principal, buildingId);
  }

  @RequirePermissions("building-plans.manage")
  @RequireManageBuildingScope("buildingId")
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
