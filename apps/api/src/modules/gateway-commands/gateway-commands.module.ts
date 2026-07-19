import { Module } from "@nestjs/common";

import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { AuthModule } from "../auth/auth.module";
import { MqttModule } from "../mqtt/mqtt.module";
import { RbacModule } from "../rbac/rbac.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { GatewayCommandAdapterRegistry } from "./adapters/gateway-command-adapters";
import { GatewayCommandExpirationService } from "./gateway-command-expiration.service";
import { GatewayCommandPublisherService } from "./gateway-command-publisher.service";
import { GatewayCommandReconnectService } from "./gateway-command-reconnect.service";
import { GatewayCommandRetryService } from "./gateway-command-retry.service";
import { GatewayCommandTransitionService } from "./gateway-command-transition.service";
import { GatewayCommandsController } from "./gateway-commands.controller";
import { GatewayCommandsService } from "./gateway-commands.service";
import { MqttResponseHandlerService } from "./mqtt-response-handler.service";

@Module({
  controllers: [GatewayCommandsController],
  exports: [GatewayCommandPublisherService, GatewayCommandRetryService, GatewayCommandsService],
  imports: [PrismaModule, AuditLogsModule, AuthModule, RbacModule, MqttModule],
  providers: [
    GatewayCommandAdapterRegistry,
    GatewayCommandExpirationService,
    GatewayCommandPublisherService,
    GatewayCommandReconnectService,
    GatewayCommandRetryService,
    GatewayCommandTransitionService,
    GatewayCommandsService,
    MqttResponseHandlerService,
  ],
})
export class GatewayCommandsModule {}
