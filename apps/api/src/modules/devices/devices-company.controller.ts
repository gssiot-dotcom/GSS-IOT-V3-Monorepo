import { Controller, Get, Inject, Param, Query, ValidationPipe } from "@nestjs/common";

import type { AuthenticatedRequest } from "../../common/auth.types";
import { CompanyEndpoint } from "../../common/decorators/company-endpoint.decorator";
import { CurrentPrincipal } from "../../common/decorators/current-principal.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import {
  RequireAreaScope,
  RequireBuildingScope,
} from "../../common/decorators/require-scope.decorator";
import { DevicesService } from "./devices.service";
import { CompanyDeviceInventoryQueryDto } from "./dto/devices.dto";

@CompanyEndpoint()
@Controller("company")
export class DevicesCompanyController {
  constructor(@Inject(DevicesService) private readonly devices: DevicesService) {}

  @RequirePermissions("company-devices.view")
  @Get("devices")
  listCompanyDevices(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Query(new ValidationPipe({ expectedType: CompanyDeviceInventoryQueryDto, transform: true }))
    query: CompanyDeviceInventoryQueryDto,
  ) {
    return this.devices.listCompanyDevices(auth!.principal.sub, query);
  }

  @RequirePermissions("company-devices.view")
  @RequireAreaScope("areaId")
  @Get("areas/:areaId/devices")
  listAreaDevices(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("areaId") areaId: string,
  ) {
    return this.devices.listCompanyAreaDevices(auth!.principal.sub, areaId);
  }

  @RequirePermissions("company-devices.view")
  @RequireBuildingScope("buildingId")
  @Get("buildings/:buildingId/devices")
  listBuildingDevices(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
  ) {
    return this.devices.listCompanyBuildingDevices(auth!.principal.sub, buildingId);
  }

  @RequirePermissions("gateway-node-connections.view")
  @RequireBuildingScope("buildingId")
  @Get("buildings/:buildingId/gateway-node-connections")
  listBuildingGatewayNodeConnections(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("buildingId") buildingId: string,
  ) {
    return this.devices.listCompanyBuildingDevices(auth!.principal.sub, buildingId);
  }
}
