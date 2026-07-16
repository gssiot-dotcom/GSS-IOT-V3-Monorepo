import { EventEmitter } from "node:events";

import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { loadApiEnv } from "@gss-iot/config";
import type { MqttClient } from "mqtt";
import { connect } from "mqtt";

import { MqttTopicService } from "./mqtt-topic.service";

export interface MqttPublishResult {
  skipped: boolean;
}

export interface MqttSensorMessageMetadata {
  duplicate?: boolean;
  packetMessageId?: number;
  receivedAt?: Date;
}

@Injectable()
export class MqttClientService implements OnModuleInit, OnModuleDestroy {
  private readonly env = loadApiEnv();
  private readonly events = new EventEmitter();
  private readonly logger = new Logger(MqttClientService.name);
  private client?: MqttClient;

  constructor(@Inject(MqttTopicService) private readonly topics: MqttTopicService) {}

  onGatewayResponse(listener: (topic: string, payload: Buffer) => void): void {
    this.events.on("gateway-response", listener);
  }

  onGatewayReconnect(listener: (gatewaySerial: string) => void): void {
    this.events.on("gateway-reconnect", listener);
  }

  onSensorMessage(
    listener: (topic: string, payload: Buffer, metadata: MqttSensorMessageMetadata) => void,
  ): void {
    this.events.on("sensor-message", listener);
  }

  onModuleInit(): void {
    if (!this.env.MQTT_ENABLED) {
      return;
    }
    this.client = connect(this.env.MQTT_BROKER_URL, {
      clientId: this.env.MQTT_CLIENT_ID,
      password: this.env.MQTT_PASSWORD,
      reconnectPeriod: 5_000,
      username: this.env.MQTT_USERNAME,
    });
    this.client.on("connect", () => {
      const filter = this.topics.responseTopicFilter();
      this.client?.subscribe(filter, (error) => {
        if (error) {
          this.logger.error(`MQTT response subscription failed: ${error.message}`);
        }
      });
      for (const sensorFilter of this.topics.sensorTopicFilters()) {
        this.client?.subscribe(sensorFilter, (error) => {
          if (error) {
            this.logger.error(`MQTT sensor subscription failed: ${error.message}`);
          }
        });
      }
    });
    this.client.on("message", (topic, payload, packet?: { dup?: boolean; messageId?: number }) => {
      if (this.topics.parseResponseGatewaySerial(topic)) {
        this.events.emit("gateway-response", topic, payload);
        return;
      }
      if (this.topics.parseSensorTopic(topic)) {
        this.events.emit("sensor-message", topic, payload, {
          duplicate: packet?.dup,
          packetMessageId: packet?.messageId,
          receivedAt: new Date(),
        } satisfies MqttSensorMessageMetadata);
      }
    });
    this.client.on("error", (error) => {
      this.logger.error(`MQTT client error: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.client?.end(false, {}, () => resolve());
      if (!this.client) resolve();
    });
  }

  async publish(topic: string, payload: Record<string, unknown>): Promise<MqttPublishResult> {
    if (!this.env.MQTT_ENABLED) {
      if (this.env.MQTT_FAKE_ACK) {
        setTimeout(() => {
          const responseTopic = topic.replace("/GATE_SUB/", "/GATE_RES/");
          this.events.emit(
            "gateway-response",
            responseTopic,
            Buffer.from(JSON.stringify({ cmd: payload.cmd, success: true })),
          );
        }, 250);
        return { skipped: false };
      }
      return { skipped: true };
    }
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("MQTT publish timed out.")),
        this.env.MQTT_PUBLISH_TIMEOUT_MS,
      );
      this.client?.publish(topic, JSON.stringify(payload), (error) => {
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve();
      });
    });
    return { skipped: false };
  }

  simulateSensorMessage(
    topic: string,
    payload: Record<string, unknown>,
    metadata: MqttSensorMessageMetadata = {},
  ): void {
    this.events.emit("sensor-message", topic, Buffer.from(JSON.stringify(payload)), {
      receivedAt: new Date(),
      ...metadata,
    } satisfies MqttSensorMessageMetadata);
  }
}
