import { Body, Controller, Get, Inject, Param, Patch, Post, ValidationPipe } from "@nestjs/common";

import type { AuthenticatedRequest } from "../../common/auth.types";
import { CompanyEndpoint } from "../../common/decorators/company-endpoint.decorator";
import { CurrentPrincipal } from "../../common/decorators/current-principal.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import {
  RequireBuildingScope,
  RequireManageBuildingScope,
} from "../../common/decorators/require-scope.decorator";
import { AlarmLevelsService } from "./alarm-levels.service";
import {
  ToggleGatewayAlarmLevelDto,
  UpdateBuildingAlarmLevelDto,
  UpdateFaultFilterDto,
} from "./dto/alarm-levels.dto";

@CompanyEndpoint()
@Controller("company/buildings/:buildingId/alarm-levels")
export class AlarmLevelsCompanyController {
  constructor(@Inject(AlarmLevelsService) private readonly alarmLevels: AlarmLevelsService) {}

  @RequirePermissions("alarm-levels.view")
  @RequireBuildingScope("buildingId")
  @Get()
  listAlarmLevels(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
  ) {
    return this.alarmLevels.listAlarmLevels(auth!.principal, buildingId);
  }

  @RequirePermissions("alarm-levels.manage")
  @RequireManageBuildingScope("buildingId")
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
  @RequireManageBuildingScope("buildingId")
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
  @RequireBuildingScope("buildingId")
  @Get("fault-filters")
  listFaultFilters(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
  ) {
    return this.alarmLevels.listFaultFilters(auth!.principal, buildingId);
  }

  @RequirePermissions("alarm-levels.manage")
  @RequireManageBuildingScope("buildingId")
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
  @RequireManageBuildingScope("buildingId")
  @Post("commands/:commandId/retry")
  retryConfigurationCommand(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
    @Param("commandId") commandId: string,
  ) {
    return this.alarmLevels.retryConfigurationCommand(auth!.principal, buildingId, commandId);
  }
}
