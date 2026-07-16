import { Controller, Get, Inject, Param, Query, ValidationPipe } from "@nestjs/common";

import type { AuthenticatedRequest } from "../../common/auth.types";
import { CompanyEndpoint } from "../../common/decorators/company-endpoint.decorator";
import { CurrentPrincipal } from "../../common/decorators/current-principal.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { RequireBuildingScope } from "../../common/decorators/require-scope.decorator";
import { SensorHistoryQueryDto } from "./dto/monitoring.dto";
import { MonitoringService } from "./monitoring.service";

@CompanyEndpoint()
@Controller("company/buildings/:buildingId/monitoring")
export class MonitoringCompanyController {
  constructor(@Inject(MonitoringService) private readonly monitoring: MonitoringService) {}

  @RequirePermissions("monitoring.view")
  @RequireBuildingScope("buildingId")
  @Get()
  listBuildingOverview(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
  ) {
    return this.monitoring.listBuildingOverview(auth!.principal, buildingId);
  }

  @RequirePermissions("monitoring.view")
  @RequireBuildingScope("buildingId")
  @Get(":nodeType")
  listNodeTypeStates(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
    @Param("nodeType") nodeType: string,
  ) {
    return this.monitoring.listNodeTypeStates(auth!.principal, buildingId, nodeType);
  }

  @RequirePermissions("monitoring.view")
  @RequireBuildingScope("buildingId")
  @Get(":nodeType/nodes/:nodeId/history")
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
