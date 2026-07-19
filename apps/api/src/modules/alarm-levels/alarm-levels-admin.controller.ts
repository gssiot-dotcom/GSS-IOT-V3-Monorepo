import { Body, Controller, Get, Inject, Param, Patch, Post, ValidationPipe } from "@nestjs/common";

import type { AuthenticatedRequest } from "../../common/auth.types";
import { AdminEndpoint } from "../../common/decorators/admin-endpoint.decorator";
import { CurrentPrincipal } from "../../common/decorators/current-principal.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { AlarmLevelsService } from "./alarm-levels.service";
import {
  ToggleGatewayAlarmLevelDto,
  UpdateBuildingAlarmLevelDto,
  UpdateFaultFilterDto,
} from "./dto/alarm-levels.dto";

@AdminEndpoint()
@Controller("admin/buildings/:buildingId/alarm-levels")
export class AlarmLevelsAdminController {
  constructor(@Inject(AlarmLevelsService) private readonly alarmLevels: AlarmLevelsService) {}

  @RequirePermissions("alarm-levels.view")
  @Get()
  listAlarmLevels(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
  ) {
    return this.alarmLevels.listAlarmLevels(auth!.principal, buildingId);
  }

  @RequirePermissions("alarm-levels.manage")
  @Patch("node-types/:nodeTypeId")
  updateAlarmLevel(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
    @Param("nodeTypeId") nodeTypeId: string,
    @Body(new ValidationPipe({ expectedType: UpdateBuildingAlarmLevelDto, transform: true }))
    dto: UpdateBuildingAlarmLevelDto,
  ) {
    return this.alarmLevels.updateAlarmLevel(auth!.principal, buildingId, nodeTypeId, dto);
  }

  @RequirePermissions("alarm-levels.manage")
  @Patch("gateways/:gatewayId")
  toggleGatewayAlarmLevel(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
    @Param("gatewayId") gatewayId: string,
    @Body(new ValidationPipe({ expectedType: ToggleGatewayAlarmLevelDto, transform: true }))
    dto: ToggleGatewayAlarmLevelDto,
  ) {
    return this.alarmLevels.toggleGatewayAlarmLevel(auth!.principal, buildingId, gatewayId, dto);
  }

  @RequirePermissions("alarm-levels.view")
  @Get("fault-filters")
  listFaultFilters(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
  ) {
    return this.alarmLevels.listFaultFilters(auth!.principal, buildingId);
  }

  @RequirePermissions("alarm-levels.manage")
  @Patch("fault-filters")
  updateFaultFilter(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
    @Body(new ValidationPipe({ expectedType: UpdateFaultFilterDto, transform: true }))
    dto: UpdateFaultFilterDto,
  ) {
    return this.alarmLevels.updateFaultFilter(auth!.principal, buildingId, dto);
  }

  @RequirePermissions("alarm-levels.manage")
  @Post("commands/:commandId/retry")
  retryConfigurationCommand(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
    @Param("commandId") commandId: string,
  ) {
    return this.alarmLevels.retryConfigurationCommand(auth!.principal, buildingId, commandId);
  }
}
