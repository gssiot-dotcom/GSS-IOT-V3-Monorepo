import { Controller, Get, Inject, Param, Query, ValidationPipe } from "@nestjs/common";

import type { AuthenticatedRequest } from "../../common/auth.types";
import { AdminEndpoint } from "../../common/decorators/admin-endpoint.decorator";
import { CurrentPrincipal } from "../../common/decorators/current-principal.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { AdminMonitoringQueryDto, SensorHistoryQueryDto } from "./dto/monitoring.dto";
import { MonitoringService } from "./monitoring.service";

@AdminEndpoint()
@Controller("admin/monitoring")
export class MonitoringAdminController {
  constructor(@Inject(MonitoringService) private readonly monitoring: MonitoringService) {}

  @RequirePermissions("monitoring.view")
  @Get("options")
  listOptions(@CurrentPrincipal() auth: AuthenticatedRequest["auth"]) {
    return this.monitoring.listAdminOptions(auth!.principal);
  }

  @RequirePermissions("monitoring.view")
  @Get("summary")
  listSummary(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Query(new ValidationPipe({ expectedType: AdminMonitoringQueryDto, transform: true }))
    query: AdminMonitoringQueryDto,
  ) {
    return this.monitoring.listAdminSummary(auth!.principal, query);
  }

  @RequirePermissions("monitoring.view")
  @Get("buildings/:buildingId")
  listBuildingOverview(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
  ) {
    return this.monitoring.listBuildingOverview(auth!.principal, buildingId);
  }

  @RequirePermissions("monitoring.view")
  @Get("buildings/:buildingId/node-types/:nodeType")
  listNodeTypeStates(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
    @Param("nodeType") nodeType: string,
  ) {
    return this.monitoring.listNodeTypeStates(auth!.principal, buildingId, nodeType);
  }

  @RequirePermissions("monitoring.view")
  @Get("buildings/:buildingId/node-types/:nodeType/nodes/:nodeId/history")
  listNodeHistory(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
    @Param("nodeId") nodeId: string,
    @Param("nodeType") nodeType: string,
    @Query(new ValidationPipe({ expectedType: SensorHistoryQueryDto, transform: true }))
    query: SensorHistoryQueryDto,
  ) {
    return this.monitoring.listNodeHistory(auth!.principal, buildingId, nodeType, nodeId, query);
  }
}
