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
import { AdminEndpoint } from "../../common/decorators/admin-endpoint.decorator";
import { CurrentPrincipal } from "../../common/decorators/current-principal.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PaginationQueryDto, SearchPaginationQueryDto } from "../../common/dto/pagination.dto";
import { CreateGssRoleDto, UpdateGssRoleDto } from "./dto/gss-role.dto";
import { GssRoleService } from "./gss-role.service";
import { SystemSettingsService } from "./system-settings.service";

@AdminEndpoint()
@Controller("admin")
export class SettingsAdminController {
  constructor(
    @Inject(GssRoleService) private readonly roles: GssRoleService,
    @Inject(SystemSettingsService) private readonly system: SystemSettingsService,
  ) {}

  @RequirePermissions("admin-roles.view")
  @Get("roles")
  listRoles(
    @Query(new ValidationPipe({ expectedType: PaginationQueryDto, transform: true }))
    query: PaginationQueryDto,
  ) {
    return this.roles.listRoles(query);
  }

  @RequirePermissions("admin-roles.view")
  @Get("roles/permissions")
  listPermissions() {
    return this.roles.listPermissions();
  }

  @RequirePermissions("permissions.view")
  @Get("permissions")
  listPermissionCatalog(
    @Query(new ValidationPipe({ expectedType: SearchPaginationQueryDto, transform: true }))
    query: SearchPaginationQueryDto,
  ) {
    return this.roles.listPermissionCatalog(query);
  }

  @RequirePermissions("admin-roles.manage")
  @Post("roles")
  createRole(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Body(new ValidationPipe({ expectedType: CreateGssRoleDto, transform: true }))
    dto: CreateGssRoleDto,
  ) {
    return this.roles.createRole(auth!.principal, dto);
  }

  @RequirePermissions("admin-roles.manage")
  @Patch("roles/:roleId")
  updateRole(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("roleId") roleId: string,
    @Body(new ValidationPipe({ expectedType: UpdateGssRoleDto, transform: true }))
    dto: UpdateGssRoleDto,
  ) {
    return this.roles.updateRole(auth!.principal, roleId, dto);
  }

  @RequirePermissions("admin-roles.manage")
  @Delete("roles/:roleId")
  deleteRole(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("roleId") roleId: string,
  ) {
    return this.roles.deleteRole(auth!.principal, roleId);
  }

  @RequirePermissions("settings.system.view")
  @Get("settings/system")
  getSystemSettings() {
    return this.system.getReadModel();
  }
}
