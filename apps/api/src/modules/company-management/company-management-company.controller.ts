import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  ValidationPipe,
} from "@nestjs/common";

import type { AuthenticatedRequest } from "../../common/auth.types";
import { CompanyEndpoint } from "../../common/decorators/company-endpoint.decorator";
import { CurrentPrincipal } from "../../common/decorators/current-principal.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PaginationQueryDto, SearchPaginationQueryDto } from "../../common/dto/pagination.dto";
import {
  CreateCompanyPositionDto,
  CreateCompanyRoleDto,
  CreateCompanyUserDto,
  ReplaceUserPositionAssignmentsDto,
  UpdateCompanyPositionDto,
  UpdateCompanyPositionStatusDto,
  UpdateCompanyRoleDto,
  UpdateCompanyRolePermissionsDto,
  UpdateCompanyUserDto,
  UpdateCompanyUserStatusDto,
} from "./dto/company-management.dto";
import { CompanyManagementService } from "./company-management.service";

@CompanyEndpoint()
@Controller("company")
export class CompanyManagementCompanyController {
  constructor(
    @Inject(CompanyManagementService) private readonly companyManagement: CompanyManagementService,
  ) {}

  @RequirePermissions("company-users.view")
  @Get("users")
  async listUsers(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Query(new ValidationPipe({ expectedType: PaginationQueryDto, transform: true }))
    query: PaginationQueryDto,
  ) {
    return this.companyManagement.listCompanyUsers(
      await this.companyManagement.getCompanyIdForCompanyUser(auth!.principal.sub),
      query,
    );
  }

  @RequirePermissions("company-users.create")
  @Post("users")
  async createUser(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Body(new ValidationPipe({ expectedType: CreateCompanyUserDto, transform: true }))
    dto: CreateCompanyUserDto,
  ) {
    return this.companyManagement.createCompanyUser(
      auth!.principal,
      await this.companyManagement.assertCompanyManager(auth!.principal.sub),
      dto,
    );
  }

  @RequirePermissions("company-users.view")
  @Get("users/:userId/effective-access")
  async getUserEffectiveAccess(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("userId") userId: string,
  ) {
    return this.companyManagement.getCompanyUserEffectiveAccess(
      await this.companyManagement.getCompanyIdForCompanyUser(auth!.principal.sub),
      userId,
    );
  }

  @RequirePermissions("company-users.update")
  @Patch("users/:userId")
  async updateUser(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("userId") userId: string,
    @Body(new ValidationPipe({ expectedType: UpdateCompanyUserDto, transform: true }))
    dto: UpdateCompanyUserDto,
  ) {
    return this.companyManagement.updateCompanyUser(
      auth!.principal,
      await this.companyManagement.assertCompanyManager(auth!.principal.sub),
      userId,
      dto,
    );
  }

  @RequirePermissions("company-users.delete")
  @Delete("users/:userId")
  async deactivateUser(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("userId") userId: string,
  ) {
    return this.companyManagement.deactivateCompanyUser(
      auth!.principal,
      await this.companyManagement.assertCompanyManager(auth!.principal.sub),
      userId,
    );
  }

  @RequirePermissions("company-users.update")
  @Patch("users/:userId/status")
  async updateUserStatus(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("userId") userId: string,
    @Body(new ValidationPipe({ expectedType: UpdateCompanyUserStatusDto, transform: true }))
    dto: UpdateCompanyUserStatusDto,
  ) {
    return this.companyManagement.updateCompanyUserStatus(
      auth!.principal,
      await this.companyManagement.assertCompanyManager(auth!.principal.sub),
      userId,
      dto.isActive,
    );
  }

  @RequirePermissions("company-users.delete")
  @Delete("users/:userId/permanent")
  async permanentlyDeleteUser(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("userId") userId: string,
  ) {
    return this.companyManagement.permanentlyDeleteCompanyUser(
      auth!.principal,
      await this.companyManagement.assertCompanyManager(auth!.principal.sub),
      userId,
    );
  }

  @RequirePermissions("company-roles.view")
  @Get("roles")
  async listRoles(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Query(new ValidationPipe({ expectedType: PaginationQueryDto, transform: true }))
    query: PaginationQueryDto,
  ) {
    return this.companyManagement.listCompanyRoles(
      await this.companyManagement.getCompanyIdForCompanyUser(auth!.principal.sub),
      query,
    );
  }

  @RequirePermissions("company-roles.manage")
  @Post("roles")
  async createRole(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Body(new ValidationPipe({ expectedType: CreateCompanyRoleDto, transform: true }))
    dto: CreateCompanyRoleDto,
  ) {
    return this.companyManagement.createCompanyRole(
      auth!.principal,
      await this.companyManagement.assertCompanyManager(auth!.principal.sub),
      dto,
    );
  }

  @RequirePermissions("company-roles.manage")
  @Patch("roles/:roleId")
  async updateRole(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("roleId") roleId: string,
    @Body(new ValidationPipe({ expectedType: UpdateCompanyRoleDto, transform: true }))
    dto: UpdateCompanyRoleDto,
  ) {
    return this.companyManagement.updateCompanyRole(
      auth!.principal,
      await this.companyManagement.assertCompanyManager(auth!.principal.sub),
      roleId,
      dto,
    );
  }

  @RequirePermissions("company-roles.manage")
  @Patch("roles/:roleId/permissions")
  async updateRolePermissions(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("roleId") roleId: string,
    @Body(new ValidationPipe({ expectedType: UpdateCompanyRolePermissionsDto, transform: true }))
    dto: UpdateCompanyRolePermissionsDto,
  ) {
    return this.companyManagement.updateCompanyRolePermissions(
      auth!.principal,
      await this.companyManagement.assertCompanyManager(auth!.principal.sub),
      roleId,
      dto,
    );
  }

  @RequirePermissions("company-roles.manage")
  @Delete("roles/:roleId")
  async deleteRole(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("roleId") roleId: string,
  ) {
    return this.companyManagement.deleteCompanyRole(
      auth!.principal,
      await this.companyManagement.assertCompanyManager(auth!.principal.sub),
      roleId,
    );
  }

  @RequirePermissions("company-permissions.view")
  @Get("permissions")
  listPermissions(
    @Query(new ValidationPipe({ expectedType: SearchPaginationQueryDto, transform: true }))
    query: SearchPaginationQueryDto,
  ) {
    return this.companyManagement.listCompanyPermissions(query);
  }

  @RequirePermissions("company-permissions.view")
  @Get("permissions/options")
  listPermissionOptions() {
    return this.companyManagement.listCompanyPermissionOptions();
  }

  @RequirePermissions("company-users.view")
  @Get("positions")
  async listPositions(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Query(new ValidationPipe({ expectedType: PaginationQueryDto, transform: true }))
    query: PaginationQueryDto,
  ) {
    return this.companyManagement.listCompanyPositions(
      await this.companyManagement.getCompanyIdForCompanyUser(auth!.principal.sub),
      query,
    );
  }

  @RequirePermissions("company-users.manage")
  @Post("positions")
  async createPosition(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Body(new ValidationPipe({ expectedType: CreateCompanyPositionDto, transform: true }))
    dto: CreateCompanyPositionDto,
  ) {
    return this.companyManagement.createCompanyPosition(
      auth!.principal,
      await this.companyManagement.assertCompanyManager(auth!.principal.sub),
      dto,
    );
  }

  @RequirePermissions("company-users.manage")
  @Patch("positions/:positionId")
  async updatePosition(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("positionId") positionId: string,
    @Body(new ValidationPipe({ expectedType: UpdateCompanyPositionDto, transform: true }))
    dto: UpdateCompanyPositionDto,
  ) {
    return this.companyManagement.updateCompanyPosition(
      auth!.principal,
      await this.companyManagement.assertCompanyManager(auth!.principal.sub),
      positionId,
      dto,
    );
  }

  @RequirePermissions("company-users.manage")
  @Delete("positions/:positionId")
  async deactivatePosition(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("positionId") positionId: string,
  ) {
    return this.companyManagement.deactivateCompanyPosition(
      auth!.principal,
      await this.companyManagement.assertCompanyManager(auth!.principal.sub),
      positionId,
    );
  }

  @RequirePermissions("company-users.manage")
  @Patch("positions/:positionId/status")
  async updatePositionStatus(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("positionId") positionId: string,
    @Body(new ValidationPipe({ expectedType: UpdateCompanyPositionStatusDto, transform: true }))
    dto: UpdateCompanyPositionStatusDto,
  ) {
    return this.companyManagement.updateCompanyPositionStatus(
      auth!.principal,
      await this.companyManagement.assertCompanyManager(auth!.principal.sub),
      positionId,
      dto.isActive,
    );
  }

  @RequirePermissions("company-users.manage")
  @Delete("positions/:positionId/permanent")
  async permanentlyDeletePosition(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("positionId") positionId: string,
  ) {
    return this.companyManagement.permanentlyDeleteCompanyPosition(
      auth!.principal,
      await this.companyManagement.assertCompanyManager(auth!.principal.sub),
      positionId,
    );
  }

  @RequirePermissions("company-users.manage")
  @Patch("users/:userId/positions")
  async replacePositionAssignments(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("userId") userId: string,
    @Body(new ValidationPipe({ expectedType: ReplaceUserPositionAssignmentsDto, transform: true }))
    dto: ReplaceUserPositionAssignmentsDto,
  ) {
    return this.companyManagement.replaceUserPositionAssignments(
      auth!.principal,
      await this.companyManagement.assertCompanyManager(auth!.principal.sub),
      userId,
      dto,
    );
  }
}
