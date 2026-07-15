import { Inject, Injectable } from "@nestjs/common";
import type { OnModuleInit } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { MqttClientService } from "../mqtt/mqtt-client.service";
import { GatewayCommandPublisherService } from "./gateway-command-publisher.service";
import { GatewayCommandsService } from "./gateway-commands.service";

@Injectable()
export class GatewayCommandReconnectService implements OnModuleInit {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MqttClientService) private readonly mqtt: MqttClientService,
    @Inject(GatewayCommandsService) private readonly commands: GatewayCommandsService,
    @Inject(GatewayCommandPublisherService)
    private readonly publisher: GatewayCommandPublisherService,
  ) {}

  onModuleInit(): void {
    this.mqtt.onGatewayReconnect((gatewaySerial) => {
      void this.processGatewaySerial(gatewaySerial);
    });
  }

  async processGatewaySerial(gatewaySerial: string) {
    const gateway = await this.prisma.gateway.findUnique({
      where: { serialNumber: gatewaySerial },
      select: { id: true },
    });
    if (!gateway) {
      return 0;
    }
    return this.processGateway(gateway.id);
  }

  async processGateway(gatewayId: string) {
    const pending = await this.commands.pendingCommandsForGateway(gatewayId);
    let processed = 0;
    for (const command of pending) {
      await this.publisher.publishPending(command.id);
      processed += 1;
    }
    return processed;
  }
}
