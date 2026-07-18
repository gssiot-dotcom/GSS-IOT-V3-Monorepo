import { EventEmitter } from "node:events";

import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { loadApiEnv } from "@gss-iot/config";
import type { MqttStatusRecord } from "@gss-iot/contracts";
import type { IClientOptions, MqttClient } from "mqtt";
import { connect } from "mqtt";

import { MqttTopicService } from "./mqtt-topic.service";

export interface MqttPublishResult {
  skipped: boolean;
}

export interface MqttPublishMetadata {
  commandId?: string;
  gatewaySerial?: string;
  requestId?: string;
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
  private readonly subscribedTopicFilters = new Set<string>();
  private connected = false;
  private lastConnectedAt: Date | null = null;
  private lastError: string | null = null;
  private lastMessageAt: Date | null = null;
  private lastPublishAt: Date | null = null;

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
      this.logger.log("MQTT integration disabled by configuration.");
      return;
    }
    this.logger.log(`MQTT connecting to broker ${this.safeBrokerUrl()}.`);
    this.client = this.connectClient(this.env.MQTT_BROKER_URL, {
      clientId: this.env.MQTT_CLIENT_ID,
      password: this.env.MQTT_PASSWORD,
      reconnectPeriod: 5_000,
      username: this.env.MQTT_USERNAME,
    });
    this.client.on("connect", () => {
      this.connected = true;
      this.lastConnectedAt = new Date();
      this.lastError = null;
      this.logger.log("MQTT connected.");
      const filter = this.topics.responseTopicFilter();
      this.client?.subscribe(filter, (error) => {
        if (error) {
          this.recordError(`MQTT response subscription failed: ${error.message}`);
          return;
        }
        this.recordSubscribedFilter(filter);
      });
      for (const sensorFilter of this.topics.sensorTopicFilters()) {
        this.client?.subscribe(sensorFilter, (error) => {
          if (error) {
            this.recordError(`MQTT sensor subscription failed: ${error.message}`);
            return;
          }
          this.recordSubscribedFilter(sensorFilter);
        });
      }
    });
    this.client.on("message", (topic, payload, packet?: { dup?: boolean; messageId?: number }) => {
      this.lastMessageAt = new Date();
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
    this.client.on("reconnect", () => {
      this.connected = false;
      this.logger.warn("MQTT reconnecting.");
    });
    this.client.on("offline", () => {
      this.connected = false;
      this.logger.warn("MQTT offline.");
    });
    this.client.on("close", () => {
      this.connected = false;
      this.logger.warn("MQTT connection closed.");
    });
    this.client.on("error", (error) => {
      this.connected = false;
      this.recordError(`MQTT client error: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.client?.end(false, {}, () => resolve());
      if (!this.client) resolve();
    });
  }

  getStatus(): MqttStatusRecord {
    return {
      brokerHost: this.brokerHost(),
      clientId: this.env.MQTT_CLIENT_ID,
      connected: this.connected,
      enabled: this.env.MQTT_ENABLED,
      lastConnectedAt: this.lastConnectedAt?.toISOString() ?? null,
      lastError: this.lastError,
      lastMessageAt: this.lastMessageAt?.toISOString() ?? null,
      lastPublishAt: this.lastPublishAt?.toISOString() ?? null,
      subscribedTopicFilters: [...this.subscribedTopicFilters].sort(),
    };
  }

  willPublish(): boolean {
    return this.env.MQTT_ENABLED || this.env.MQTT_FAKE_ACK;
  }

  recordGatewayResponse(details: {
    cmd: number;
    correlationMode: "legacy_cmd" | "legacy_shape" | "request_id";
    gatewaySerial: string;
    matchedCommandId?: string | null;
    requestId?: string;
    success: boolean;
    topic: string;
    unmatchedReason?: string;
  }): void {
    this.logger.log(
      `MQTT gateway response received topic=${details.topic} gatewaySerial=${details.gatewaySerial} cmd=${details.cmd} requestId=${details.requestId ?? "none"} success=${details.success} matchedCommandId=${details.matchedCommandId ?? "none"} correlationMode=${details.correlationMode}${details.unmatchedReason ? ` unmatchedReason=${details.unmatchedReason}` : ""}`,
    );
  }

  async publish(
    topic: string,
    payload: Record<string, unknown>,
    metadata: MqttPublishMetadata = {},
  ): Promise<MqttPublishResult> {
    if (!this.env.MQTT_ENABLED) {
      if (this.env.MQTT_FAKE_ACK) {
        setTimeout(() => {
          const responseTopic = topic.replace("/GATE_SUB/", "/GATE_RES/");
          this.events.emit(
            "gateway-response",
            responseTopic,
            Buffer.from(
              JSON.stringify({
                ...payload,
                resp: "success",
              }),
            ),
          );
        }, 250);
        this.recordPublishSuccess(topic, payload, metadata);
        return { skipped: false };
      }
      return { skipped: true };
    }
    if (!this.client) {
      const error = new Error("MQTT client is unavailable.");
      this.recordPublishFailure(topic, payload, metadata, error);
      throw error;
    }
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const error = new Error("MQTT publish timed out.");
        this.recordPublishFailure(topic, payload, metadata, error);
        reject(error);
      }, this.env.MQTT_PUBLISH_TIMEOUT_MS);
      this.client?.publish(topic, JSON.stringify(payload), (error) => {
        clearTimeout(timeout);
        if (error) {
          this.recordPublishFailure(topic, payload, metadata, error);
          reject(error);
          return;
        }
        this.recordPublishSuccess(topic, payload, metadata);
        resolve();
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

  private recordSubscribedFilter(filter: string): void {
    this.subscribedTopicFilters.add(filter);
    this.logger.log(`MQTT subscribed topic filter: ${filter}`);
  }

  private recordPublishSuccess(
    topic: string,
    payload: Record<string, unknown>,
    metadata: MqttPublishMetadata,
  ): void {
    this.lastPublishAt = new Date();
    this.lastError = null;
    this.logger.log(
      `MQTT publish succeeded commandId=${metadata.commandId ?? "none"} requestId=${metadata.requestId ?? "none"} gatewaySerial=${metadata.gatewaySerial ?? "unknown"} topic=${topic} cmd=${this.commandNumber(payload)} payloadSize=${this.payloadSize(payload)}`,
    );
  }

  private recordPublishFailure(
    topic: string,
    payload: Record<string, unknown>,
    metadata: MqttPublishMetadata,
    error: Error,
  ): void {
    this.recordError(
      `MQTT publish failed commandId=${metadata.commandId ?? "none"} requestId=${metadata.requestId ?? "none"} gatewaySerial=${metadata.gatewaySerial ?? "unknown"} topic=${topic} cmd=${this.commandNumber(payload)} payloadSize=${this.payloadSize(payload)} error=${error.message}`,
    );
  }

  private recordError(message: string): void {
    this.lastError = message;
    this.logger.error(message);
  }

  private commandNumber(payload: Record<string, unknown>): string {
    const cmd = Number(payload.cmd);
    return Number.isInteger(cmd) ? String(cmd) : "unknown";
  }

  private payloadSize(payload: Record<string, unknown>): number {
    return Buffer.byteLength(JSON.stringify(payload), "utf8");
  }

  private safeBrokerUrl(): string {
    try {
      const url = new URL(this.env.MQTT_BROKER_URL);
      url.username = "";
      url.password = "";
      return url.toString();
    } catch {
      return this.brokerHost();
    }
  }

  private brokerHost(): string {
    try {
      return new URL(this.env.MQTT_BROKER_URL).host;
    } catch {
      return "unknown";
    }
  }

  protected connectClient(brokerUrl: string, options: IClientOptions): MqttClient {
    return connect(brokerUrl, options);
  }
}
