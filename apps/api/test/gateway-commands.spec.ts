import { EventEmitter } from "node:events";

import { BadRequestException, ConflictException } from "@nestjs/common";
import { GatewayCommandStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { IClientOptions, MqttClient } from "mqtt";

import { GatewayCommandAdapterRegistry } from "../src/modules/gateway-commands/adapters/gateway-command-adapters";
import { GatewayCommandTransitionService } from "../src/modules/gateway-commands/gateway-command-transition.service";
import { MqttClientService } from "../src/modules/mqtt/mqtt-client.service";
import { MqttPayloadParserService } from "../src/modules/mqtt/mqtt-payload-parser.service";
import { MqttTopicService } from "../src/modules/mqtt/mqtt-topic.service";

class FakeMqttClient extends EventEmitter {
  lastPublishedPayload?: string;
  readonly end = vi.fn((_force?: boolean, _options?: object, callback?: () => void) => {
    callback?.();
  });
  publishError?: Error;
  readonly publish = vi.fn(
    (_topic: string, payload: string, callback?: (error?: Error) => void) => {
      this.lastPublishedPayload = payload;
      callback?.(this.publishError);
    },
  );
  readonly subscribe = vi.fn((_filter: string, callback?: (error?: Error) => void) => {
    callback?.();
  });
}

class TestMqttClientService extends MqttClientService {
  readonly fakeClient = new FakeMqttClient();
  brokerUrl?: string;
  options?: IClientOptions;

  protected override connectClient(brokerUrl: string, options: IClientOptions): MqttClient {
    this.brokerUrl = brokerUrl;
    this.options = options;
    return this.fakeClient as unknown as MqttClient;
  }
}

describe("Gateway command Phase 5 helpers", () => {
  it("generates legacy topics and typed command payloads", () => {
    const topics = new MqttTopicService();
    const adapters = new GatewayCommandAdapterRegistry(topics);
    const topicBase = process.env.MQTT_TOPIC_BASE ?? "GSSIOT/test";

    expect(topics.publishTopic("GW-001")).toBe(`${topicBase}/GATE_SUB/GRM22JU22PGW-001`);
    expect(topics.parseResponseGatewaySerial(`${topicBase}/GATE_RES/GRM22JU22PGW-001`)).toBe(
      "GW-001",
    );
    expect(
      adapters.buildRegisterNodes({
        gatewaySerial: "GW-001",
        nodeNumbers: ["100", "101", "102"],
        nodeTypeNumericCode: 2,
      }).payload,
    ).toEqual({ cmd: 2, nodeType: 2, nodes: [100, 101, 102], numNodes: 3 });
    expect(
      adapters.buildSetFaultFilter({
        gatewaySerial: "GW-001",
        nodeNumbers: ["100", "101"],
        nodeTypeNumericCode: 0,
      }).payload,
    ).toEqual({ cmd: 5, nodeType: 0, nodes: [100, 101], numNodes: 2 });
    expect(
      adapters.buildSetFaultFilter({
        gatewaySerial: "GW-001",
        nodeNumbers: [],
        nodeTypeNumericCode: 0,
      }).payload,
    ).toEqual({ cmd: 5, nodeType: 0, nodes: [], numNodes: 0 });
    expect(
      adapters.buildSetAlarmLevels({
        alarmEnabled: true,
        alarmLevel1: 1,
        alarmLevel2: 2,
        alarmLevel3: 3,
        enabled: true,
        gatewaySerial: "GW-001",
        nodeTypeNumericCode: 1,
      }).payload,
    ).toMatchObject({ alarmLevel1: 1, alarmLevel2: 2, alarmLevel3: 3, cmd: 4, nodeType: 1 });
    expect(
      adapters.buildSetAlarmLevels({
        alarmEnabled: false,
        enabled: false,
        gatewaySerial: "GW-001",
        nodeTypeNumericCode: 1,
      }).payload,
    ).toEqual({ alarmEnabled: false, cmd: 4, enabled: false, nodeType: 1 });
    expect(
      adapters.buildSetAlarmLevels({
        alarmEnabled: false,
        enabled: true,
        gatewaySerial: "GW-001",
        nodeTypeNumericCode: 0,
      }).payload,
    ).toEqual({ alarmEnabled: false, cmd: 4, enabled: true, nodeType: 0 });
  });

  it("rejects invalid adapter input", () => {
    const adapters = new GatewayCommandAdapterRegistry(new MqttTopicService());
    expect(() =>
      adapters.buildRegisterNodes({
        gatewaySerial: "GW-001",
        nodeNumbers: ["100", "abc"],
        nodeTypeNumericCode: 0,
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      adapters.buildRegisterNodes({
        gatewaySerial: "GW-001",
        nodeNumbers: [" "],
        nodeTypeNumericCode: 0,
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      adapters.buildRegisterNodes({
        gatewaySerial: "GW-001",
        nodeNumbers: ["-1"],
        nodeTypeNumericCode: 0,
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      adapters.buildRegisterNodes({
        gatewaySerial: "GW-001",
        nodeNumbers: ["0100", "100"],
        nodeTypeNumericCode: 0,
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      adapters.buildSetFaultFilter({
        gatewaySerial: "GW-001",
        nodeNumbers: ["9007199254740992"],
        nodeTypeNumericCode: 0,
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      adapters.buildSetAlarmLevels({
        alarmEnabled: true,
        enabled: true,
        gatewaySerial: "GW-001",
        nodeTypeNumericCode: 1,
      }),
    ).toThrow(BadRequestException);
  });

  it("validates command status transitions", () => {
    const transitions = new GatewayCommandTransitionService();
    expect(() =>
      transitions.assertTransition(GatewayCommandStatus.PENDING, GatewayCommandStatus.SENT),
    ).not.toThrow();
    expect(() =>
      transitions.assertTransition(GatewayCommandStatus.ACKNOWLEDGED, GatewayCommandStatus.FAILED),
    ).toThrow(ConflictException);
    expect(transitions.activeKeyFor(GatewayCommandStatus.FAILED, "cmd-1")).toBe("active");
    expect(transitions.activeKeyFor(GatewayCommandStatus.EXPIRED, "cmd-1")).toBe("cmd-1");
  });

  it("parses malformed MQTT payloads safely", () => {
    const parser = new MqttPayloadParserService();
    expect(parser.parseGatewayResponse("GW-001", "{bad")).toBeNull();
    expect(parser.parseGatewayResponse(null, "{}")).toBeNull();
    expect(
      parser.parseGatewayResponse("GW-001", JSON.stringify({ cmd: 2, success: true })),
    ).toEqual({
      cmd: 2,
      gatewaySerial: "GW-001",
      payload: { cmd: 2, success: true },
      success: true,
    });
    expect(
      parser.parseGatewayResponse("GW-001", JSON.stringify({ cmd: 2, resp: "success" })),
    ).toMatchObject({
      cmd: 2,
      payload: { cmd: 2, resp: "success" },
      success: true,
    });
    expect(
      parser.parseGatewayResponse("GW-001", JSON.stringify({ cmd: 2, resp: "fail" })),
    ).toMatchObject({ failureReason: "resp reported failure.", success: false });
    expect(parser.parseGatewayResponse("GW-001", JSON.stringify({ cmd: 2 }))).toMatchObject({
      failureReason: "Gateway response did not contain an accepted success value.",
      success: false,
    });
  });

  it("keeps MQTT disabled mode broker-free and emits fake acknowledgements only when enabled", async () => {
    process.env.MQTT_ENABLED = "false";
    process.env.MQTT_FAKE_ACK = "false";
    const disabled = new MqttClientService(new MqttTopicService());
    disabled.onModuleInit();
    expect(disabled.getStatus()).toMatchObject({
      connected: false,
      enabled: false,
      subscribedTopicFilters: [],
    });
    await expect(disabled.publish("GSSIOT/test/GATE_SUB/GRM22P1", { cmd: 2 })).resolves.toEqual({
      skipped: true,
    });

    process.env.MQTT_FAKE_ACK = "true";
    const fake = new MqttClientService(new MqttTopicService());
    const listener = vi.fn();
    fake.onGatewayResponse(listener);
    await expect(fake.publish("GSSIOT/test/GATE_SUB/GRM22P1", { cmd: 2 })).resolves.toEqual({
      skipped: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(listener).toHaveBeenCalledOnce();
    process.env.MQTT_FAKE_ACK = "false";
  });

  it("tracks MQTT connection lifecycle and subscription status without credentials", () => {
    process.env.MQTT_ENABLED = "true";
    process.env.MQTT_BROKER_URL = "mqtt://secret-user:secret-password@broker.example:1883";
    process.env.MQTT_CLIENT_ID = "observability-client";
    const service = new TestMqttClientService(new MqttTopicService());

    service.onModuleInit();
    expect(service.brokerUrl).toBe("mqtt://secret-user:secret-password@broker.example:1883");
    service.fakeClient.emit("connect");

    const status = service.getStatus();
    expect(status).toMatchObject({
      brokerHost: "broker.example:1883",
      clientId: "observability-client",
      connected: true,
      enabled: true,
      lastError: null,
    });
    expect(status.lastConnectedAt).toBeTruthy();
    const topicBase = process.env.MQTT_TOPIC_BASE ?? "GSSIOT/test";
    expect(status.subscribedTopicFilters).toEqual([
      `${topicBase}/GATE_ANG/+`,
      `${topicBase}/GATE_FORM/+`,
      `${topicBase}/GATE_PUB/+`,
      `${topicBase}/GATE_RES/+`,
    ]);
    expect(JSON.stringify(status)).not.toContain("secret");

    service.fakeClient.emit("message", "GSSIOT/test/GATE_RES/GRM22JU22PGW-001", Buffer.from("{}"));
    expect(service.getStatus().lastMessageAt).toBeTruthy();

    service.fakeClient.emit("offline");
    expect(service.getStatus().connected).toBe(false);
    service.fakeClient.emit("reconnect");
    expect(service.getStatus().connected).toBe(false);
    service.fakeClient.emit("close");
    expect(service.getStatus().connected).toBe(false);
    process.env.MQTT_ENABLED = "false";
    process.env.MQTT_BROKER_URL = "mqtt://localhost:1883";
    process.env.MQTT_CLIENT_ID = "gss-iot-v3-api";
  });

  it("tracks MQTT publish success and failure status", async () => {
    process.env.MQTT_ENABLED = "true";
    const service = new TestMqttClientService(new MqttTopicService());
    service.onModuleInit();
    service.fakeClient.emit("connect");

    await expect(
      service.publish(
        "GSSIOT/test/GATE_SUB/GRM22JU22PGW-001",
        { cmd: 2, nodeType: 2, numNodes: 3, nodes: [100, 101, 102] },
        { commandId: "command-1", gatewaySerial: "GW-001" },
      ),
    ).resolves.toEqual({ skipped: false });
    expect(service.getStatus().lastPublishAt).toBeTruthy();
    expect(service.fakeClient.lastPublishedPayload).toBe(
      '{"cmd":2,"nodeType":2,"numNodes":3,"nodes":[100,101,102]}',
    );
    expect(service.fakeClient.lastPublishedPayload).not.toContain('"100"');

    service.fakeClient.publishError = new Error("broker rejected publish");
    await expect(
      service.publish(
        "GSSIOT/test/GATE_SUB/GRM22JU22PGW-001",
        { cmd: 2 },
        { commandId: "command-2", gatewaySerial: "GW-001" },
      ),
    ).rejects.toThrow("broker rejected publish");
    expect(service.getStatus().lastError).toContain("MQTT publish failed");
    process.env.MQTT_ENABLED = "false";
  });
});
