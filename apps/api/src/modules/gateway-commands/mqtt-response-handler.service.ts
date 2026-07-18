import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnModuleInit } from "@nestjs/common";
import { MqttPayloadParserService } from "../mqtt/mqtt-payload-parser.service";
import { MqttClientService } from "../mqtt/mqtt-client.service";
import { MqttTopicService } from "../mqtt/mqtt-topic.service";
import { GatewayCommandsService } from "./gateway-commands.service";

@Injectable()
export class MqttResponseHandlerService implements OnModuleInit {
  private readonly logger = new Logger(MqttResponseHandlerService.name);

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
    this.logger.debug(
      `Raw MQTT GATE_RES message topic=${topic} payload=${this.payloadPreview(payload)}`,
    );
    const parsed = this.parser.parseGatewayResponse(
      this.topics.parseResponseGatewaySerial(topic),
      payload,
    );
    if (!parsed) {
      return null;
    }
    const result = await this.commands.handleGatewayResponse(parsed);
    this.client.recordGatewayResponse({
      cmd: parsed.cmd,
      correlationMode: result.correlationMode,
      gatewaySerial: parsed.gatewaySerial,
      matchedCommandId: result.command?.id,
      requestId: parsed.requestId,
      success: parsed.success,
      topic,
      unmatchedReason: result.unmatchedReason,
    });
    return result.command;
  }

  private payloadPreview(payload: Buffer | string): string {
    const text = Buffer.isBuffer(payload) ? payload.toString("utf8") : payload;
    try {
      const parsed = JSON.parse(text) as unknown;
      return JSON.stringify(this.redactSecrets(parsed)).slice(0, 1_000);
    } catch {
      return text.slice(0, 1_000);
    }
  }

  private redactSecrets(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.redactSecrets(item));
    }
    if (!value || typeof value !== "object") {
      return value;
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        /password|passwd|secret|token|credential/i.test(key)
          ? "[redacted]"
          : this.redactSecrets(entry),
      ]),
    );
  }
}
