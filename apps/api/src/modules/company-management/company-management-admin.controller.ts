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
  CreateCompanyPositionDto,
  CreateCompanyRoleDto,
  CreateCompanyUserDto,
  ReplaceUserPositionAssignmentsDto,
  UpdateCompanyRolePermissionsDto,
  UpdateCompanyUserDto,
} from "./dto/company-management.dto";
import { CompanyManagementService } from "./company-management.service";

@AdminEndpoint()
@Controller("admin")
export class CompanyManagementAdminController {
  constructor(
    @Inject(CompanyManagementService) private readonly companyManagement: CompanyManagementService,
  ) {}

  @RequirePermissions("company-users.view")
  @Get("companies/:companyId/users")
  listUsers(@Param("companyId") companyId: string) {
    return this.companyManagement.listCompanyUsers(companyId);
  }

  @RequirePermissions("company-users.create")
  @Post("companies/:companyId/users")
  createUser(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("companyId") companyId: string,
    @Body(new ValidationPipe({ expectedType: CreateCompanyUserDto, transform: true }))
    dto: CreateCompanyUserDto,
  ) {
    return this.companyManagement.createCompanyUser(auth!.principal, companyId, dto);
  }

  @RequirePermissions("company-users.update")
  @Patch("companies/:companyId/users/:userId")
  updateUser(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("companyId") companyId: string,
    @Param("userId") userId: string,
    @Body(new ValidationPipe({ expectedType: UpdateCompanyUserDto, transform: true }))
    dto: UpdateCompanyUserDto,
  ) {
    return this.companyManagement.updateCompanyUser(auth!.principal, companyId, userId, dto);
  }

  @RequirePermissions("company-users.delete")
  @Delete("companies/:companyId/users/:userId")
  deactivateUser(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("companyId") companyId: string,
    @Param("userId") userId: string,
  ) {
    return this.companyManagement.deactivateCompanyUser(auth!.principal, companyId, userId);
  }

  @RequirePermissions("company-roles.view")
  @Get("companies/:companyId/roles")
  listRoles(@Param("companyId") companyId: string) {
    return this.companyManagement.listCompanyRoles(companyId);
  }

  @RequirePermissions("company-roles.manage")
  @Post("companies/:companyId/roles")
  createRole(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("companyId") companyId: string,
    @Body(new ValidationPipe({ expectedType: CreateCompanyRoleDto, transform: true }))
    dto: CreateCompanyRoleDto,
  ) {
    return this.companyManagement.createCompanyRole(auth!.principal, companyId, dto);
  }

  @RequirePermissions("company-roles.manage")
  @Patch("companies/:companyId/roles/:roleId/permissions")
  updateRolePermissions(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("companyId") companyId: string,
    @Param("roleId") roleId: string,
    @Body(new ValidationPipe({ expectedType: UpdateCompanyRolePermissionsDto, transform: true }))
    dto: UpdateCompanyRolePermissionsDto,
  ) {
    return this.companyManagement.updateCompanyRolePermissions(
      auth!.principal,
      companyId,
      roleId,
      dto,
    );
  }

  @RequirePermissions("company-permissions.view")
  @Get("company-permissions")
  listCompanyPermissions() {
    return this.companyManagement.listCompanyPermissions();
  }

  @RequirePermissions("company-users.view")
  @Get("companies/:companyId/positions")
  listPositions(@Param("companyId") companyId: string) {
    return this.companyManagement.listCompanyPositions(companyId);
  }

  @RequirePermissions("company-users.manage")
  @Post("companies/:companyId/positions")
  createPosition(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("companyId") companyId: string,
    @Body(new ValidationPipe({ expectedType: CreateCompanyPositionDto, transform: true }))
    dto: CreateCompanyPositionDto,
  ) {
    return this.companyManagement.createCompanyPosition(auth!.principal, companyId, dto);
  }

  @RequirePermissions("company-users.manage")
  @Delete("companies/:companyId/positions/:positionId")
  deactivatePosition(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("companyId") companyId: string,
    @Param("positionId") positionId: string,
  ) {
    return this.companyManagement.deactivateCompanyPosition(auth!.principal, companyId, positionId);
  }

  @RequirePermissions("company-users.manage")
  @Patch("companies/:companyId/users/:userId/positions")
  replacePositionAssignments(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("companyId") companyId: string,
    @Param("userId") userId: string,
    @Body(new ValidationPipe({ expectedType: ReplaceUserPositionAssignmentsDto, transform: true }))
    dto: ReplaceUserPositionAssignmentsDto,
  ) {
    return this.companyManagement.replaceUserPositionAssignments(
      auth!.principal,
      companyId,
      userId,
      dto,
    );
  }
}
