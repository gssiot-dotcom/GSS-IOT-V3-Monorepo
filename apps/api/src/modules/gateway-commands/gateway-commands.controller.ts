import { Body, Controller, Get, Inject, Param, Post, Query, ValidationPipe } from "@nestjs/common";
import type { GatewayCommandStatus } from "@prisma/client";

import type { AuthenticatedRequest } from "../../common/auth.types";
import { AdminEndpoint } from "../../common/decorators/admin-endpoint.decorator";
import { CurrentPrincipal } from "../../common/decorators/current-principal.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import {
  RegisterNodesCommandDto,
  SetAlarmLevelsCommandDto,
  SetFaultFilterCommandDto,
  WakeSecurityCommandDto,
} from "./dto/gateway-commands.dto";
import { GatewayCommandExpirationService } from "./gateway-command-expiration.service";
import { GatewayCommandPublisherService } from "./gateway-command-publisher.service";
import { GatewayCommandRetryService } from "./gateway-command-retry.service";
import { GatewayCommandsService } from "./gateway-commands.service";

@AdminEndpoint()
@Controller("admin/gateway-commands")
export class GatewayCommandsController {
  constructor(
    @Inject(GatewayCommandsService) private readonly commands: GatewayCommandsService,
    @Inject(GatewayCommandPublisherService)
    private readonly publisher: GatewayCommandPublisherService,
    @Inject(GatewayCommandRetryService) private readonly retryService: GatewayCommandRetryService,
    @Inject(GatewayCommandExpirationService)
    private readonly expiration: GatewayCommandExpirationService,
  ) {}

  @RequirePermissions("mqtt-commands.view")
  @Get()
  listCommands(
    @Query("status") status?: GatewayCommandStatus,
    @Query("gatewayId") gatewayId?: string,
  ) {
    return this.commands.listCommands(status, gatewayId);
  }

  @RequirePermissions("mqtt-commands.view")
  @Get(":commandId")
  getCommand(@Param("commandId") commandId: string) {
    return this.commands.getCommand(commandId);
  }

  @RequirePermissions("mqtt-commands.manage")
  @Post("register-nodes")
  async registerNodes(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Body(new ValidationPipe({ expectedType: RegisterNodesCommandDto, transform: true }))
    dto: RegisterNodesCommandDto,
  ) {
    const command = await this.commands.createRegisterNodesCommand(auth!.principal, dto);
    return this.publisher.publishPending(command.id);
  }

  @RequirePermissions("mqtt-commands.manage")
  @Post("wake-security")
  async wakeSecurity(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Body(new ValidationPipe({ expectedType: WakeSecurityCommandDto, transform: true }))
    dto: WakeSecurityCommandDto,
  ) {
    const command = await this.commands.createWakeSecurityCommand(auth!.principal, dto);
    return this.publisher.publishPending(command.id);
  }

  @RequirePermissions("mqtt-commands.manage")
  @Post("alarm-levels")
  async setAlarmLevels(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Body(new ValidationPipe({ expectedType: SetAlarmLevelsCommandDto, transform: true }))
    dto: SetAlarmLevelsCommandDto,
  ) {
    const command = await this.commands.createSetAlarmLevelsCommand(auth!.principal, dto);
    return this.publisher.publishPending(command.id);
  }

  @RequirePermissions("mqtt-commands.manage")
  @Post("fault-filter")
  async setFaultFilter(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Body(new ValidationPipe({ expectedType: SetFaultFilterCommandDto, transform: true }))
    dto: SetFaultFilterCommandDto,
  ) {
    const command = await this.commands.createSetFaultFilterCommand(auth!.principal, dto);
    return this.publisher.publishPending(command.id);
  }

  @RequirePermissions("mqtt-commands.manage")
  @Post(":commandId/retry")
  retryCommand(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("commandId") commandId: string,
  ) {
    return this.retryService.retry(auth!.principal, commandId);
  }

  @RequirePermissions("mqtt-commands.manage")
  @Post(":commandId/cancel")
  cancelCommand(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("commandId") commandId: string,
  ) {
    return this.commands.cancelCommand(auth!.principal, commandId);
  }

  @RequirePermissions("mqtt-commands.manage")
  @Post("process-expired")
  processExpired() {
    return this.expiration.expireNow().then((expired) => ({ expired }));
  }
}
