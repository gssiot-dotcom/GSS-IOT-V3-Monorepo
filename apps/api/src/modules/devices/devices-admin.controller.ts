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
  AssignDeviceToCompanyDto,
  AssignGatewayToBuildingDto,
  AssignNodeToGatewayDto,
  BulkCreateNodesDto,
  CreateGatewayDto,
  CreateNodeDto,
  UpdateGatewayDto,
  UpdateNodeDto,
} from "./dto/devices.dto";
import { DevicesService } from "./devices.service";

@AdminEndpoint()
@Controller("admin/devices")
export class DevicesAdminController {
  constructor(@Inject(DevicesService) private readonly devices: DevicesService) {}

  @RequirePermissions("devices.view")
  @Get("node-types")
  listNodeTypes() {
    return this.devices.listNodeTypes();
  }

  @RequirePermissions("devices.assign")
  @Get("provisioning-options")
  listProvisioningOptions() {
    return this.devices.listProvisioningOptions();
  }

  @RequirePermissions("gateways.view")
  @Get("gateways")
  listGateways() {
    return this.devices.listGateways();
  }

  @RequirePermissions("gateways.create")
  @Post("gateways")
  createGateway(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Body(new ValidationPipe({ expectedType: CreateGatewayDto, transform: true }))
    dto: CreateGatewayDto,
  ) {
    return this.devices.createGateway(auth!.principal, dto);
  }

  @RequirePermissions("gateways.update")
  @Patch("gateways/:gatewayId")
  updateGateway(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("gatewayId") gatewayId: string,
    @Body(new ValidationPipe({ expectedType: UpdateGatewayDto, transform: true }))
    dto: UpdateGatewayDto,
  ) {
    return this.devices.updateGateway(auth!.principal, gatewayId, dto);
  }

  @RequirePermissions("gateways.delete")
  @Delete("gateways/:gatewayId")
  deleteGateway(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("gatewayId") gatewayId: string,
  ) {
    return this.devices.deleteGateway(auth!.principal, gatewayId);
  }

  @RequirePermissions("gateways.assign")
  @Post("gateways/:gatewayId/company-assignment")
  assignGatewayToCompany(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("gatewayId") gatewayId: string,
    @Body(new ValidationPipe({ expectedType: AssignDeviceToCompanyDto, transform: true }))
    dto: AssignDeviceToCompanyDto,
  ) {
    return this.devices.assignGatewayToCompany(auth!.principal, gatewayId, dto.companyId);
  }

  @RequirePermissions("gateways.assign")
  @Delete("gateways/:gatewayId/company-assignment")
  unassignGatewayFromCompany(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("gatewayId") gatewayId: string,
  ) {
    return this.devices.unassignGatewayFromCompany(auth!.principal, gatewayId);
  }

  @RequirePermissions("gateways.assign")
  @Post("gateways/:gatewayId/building-assignment")
  assignGatewayToBuilding(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("gatewayId") gatewayId: string,
    @Body(new ValidationPipe({ expectedType: AssignGatewayToBuildingDto, transform: true }))
    dto: AssignGatewayToBuildingDto,
  ) {
    return this.devices.assignGatewayToBuilding(auth!.principal, gatewayId, dto.buildingId);
  }

  @RequirePermissions("gateways.assign")
  @Delete("gateways/:gatewayId/building-assignment")
  unassignGatewayFromBuilding(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("gatewayId") gatewayId: string,
  ) {
    return this.devices.unassignGatewayFromBuilding(auth!.principal, gatewayId);
  }

  @RequirePermissions("nodes.view")
  @Get("nodes")
  listNodes() {
    return this.devices.listNodes();
  }

  @RequirePermissions("nodes.create")
  @Post("nodes/bulk")
  bulkCreateNodes(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Body(new ValidationPipe({ expectedType: BulkCreateNodesDto, transform: true }))
    dto: BulkCreateNodesDto,
  ) {
    return this.devices.bulkCreateNodes(auth!.principal, dto);
  }

  @RequirePermissions("nodes.create")
  @Post("nodes")
  createNode(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Body(new ValidationPipe({ expectedType: CreateNodeDto, transform: true }))
    dto: CreateNodeDto,
  ) {
    return this.devices.createNode(auth!.principal, dto);
  }

  @RequirePermissions("nodes.update")
  @Patch("nodes/:nodeId")
  updateNode(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("nodeId") nodeId: string,
    @Body(new ValidationPipe({ expectedType: UpdateNodeDto, transform: true }))
    dto: UpdateNodeDto,
  ) {
    return this.devices.updateNode(auth!.principal, nodeId, dto);
  }

  @RequirePermissions("nodes.delete")
  @Delete("nodes/:nodeId")
  deleteNode(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("nodeId") nodeId: string,
  ) {
    return this.devices.deleteNode(auth!.principal, nodeId);
  }

  @RequirePermissions("nodes.assign")
  @Post("nodes/:nodeId/company-assignment")
  assignNodeToCompany(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("nodeId") nodeId: string,
    @Body(new ValidationPipe({ expectedType: AssignDeviceToCompanyDto, transform: true }))
    dto: AssignDeviceToCompanyDto,
  ) {
    return this.devices.assignNodeToCompany(auth!.principal, nodeId, dto.companyId);
  }

  @RequirePermissions("nodes.assign")
  @Delete("nodes/:nodeId/company-assignment")
  unassignNodeFromCompany(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("nodeId") nodeId: string,
  ) {
    return this.devices.unassignNodeFromCompany(auth!.principal, nodeId);
  }

  @RequirePermissions("nodes.assign")
  @Post("nodes/:nodeId/gateway-assignment")
  assignNodeToGateway(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("nodeId") nodeId: string,
    @Body(new ValidationPipe({ expectedType: AssignNodeToGatewayDto, transform: true }))
    dto: AssignNodeToGatewayDto,
  ) {
    return this.devices.assignNodeToGateway(auth!.principal, nodeId, dto.gatewayId);
  }

  @RequirePermissions("nodes.assign")
  @Delete("nodes/:nodeId/gateway-assignment")
  unassignNodeFromGateway(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("nodeId") nodeId: string,
  ) {
    return this.devices.unassignNodeFromGateway(auth!.principal, nodeId);
  }
}
