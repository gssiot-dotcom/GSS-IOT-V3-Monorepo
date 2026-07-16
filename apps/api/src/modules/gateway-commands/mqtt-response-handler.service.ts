import { Inject, Injectable } from "@nestjs/common";
import type { OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { MqttPayloadParserService } from "../mqtt/mqtt-payload-parser.service";
import { MqttClientService } from "../mqtt/mqtt-client.service";
import { MqttTopicService } from "../mqtt/mqtt-topic.service";
import { GatewayCommandsService } from "./gateway-commands.service";

@Injectable()
export class MqttResponseHandlerService implements OnModuleInit {
  constructor(
    @Inject(GatewayCommandsService) private readonly commands: GatewayCommandsService,
    @Inject(MqttClientService) private readonly client: MqttClientService,
    @Inject(MqttPayloadParserService) private readonly parser: MqttPayloadParserService,
    @Inject(MqttTopicService) private readonly topics: MqttTopicService,
  ) {}

  onModuleInit(): void {
    this.client.onGatewayResponse((topic, payload) => {
      void this.handleRawResponse(topic, payload);
    });
  }

  async handleRawResponse(topic: string, payload: Buffer | string) {
    const parsed = this.parser.parseGatewayResponse(
      this.topics.parseResponseGatewaySerial(topic),
      payload,
    );
    if (!parsed) {
      return null;
    }
    if (!parsed.success) {
      return this.commands.failSentGatewayResponse(
        parsed.gatewaySerial,
        parsed.cmd,
        parsed.payload as Prisma.InputJsonObject,
        parsed.failureReason ?? "Gateway returned a negative acknowledgement.",
      );
    }
    return this.commands.acknowledgeSentCommand(
      parsed.gatewaySerial,
      parsed.cmd,
      parsed.payload as Prisma.InputJsonObject,
    );
  }
}
