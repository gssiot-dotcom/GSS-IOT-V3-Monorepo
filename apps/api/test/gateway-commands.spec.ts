import { BadRequestException, ConflictException } from "@nestjs/common";
import { GatewayCommandStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { GatewayCommandAdapterRegistry } from "../src/modules/gateway-commands/adapters/gateway-command-adapters";
import { GatewayCommandTransitionService } from "../src/modules/gateway-commands/gateway-command-transition.service";
import { MqttClientService } from "../src/modules/mqtt/mqtt-client.service";
import { MqttPayloadParserService } from "../src/modules/mqtt/mqtt-payload-parser.service";
import { MqttTopicService } from "../src/modules/mqtt/mqtt-topic.service";

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
        nodeNumbers: ["N-1", "N-2"],
        nodeTypeNumericCode: 0,
      }).payload,
    ).toEqual({ cmd: 2, nodeType: 0, nodes: ["N-1", "N-2"], numNodes: 2 });
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
  });

  it("rejects invalid adapter input", () => {
    const adapters = new GatewayCommandAdapterRegistry(new MqttTopicService());
    expect(() =>
      adapters.buildSetFaultFilter({
        gatewaySerial: "GW-001",
        nodeNumbers: [],
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
  });

  it("keeps MQTT disabled mode broker-free and emits fake acknowledgements only when enabled", async () => {
    process.env.MQTT_FAKE_ACK = "false";
    const disabled = new MqttClientService(new MqttTopicService());
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
});
