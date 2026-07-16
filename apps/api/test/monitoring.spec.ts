import { describe, expect, it } from "vitest";

import { MqttPayloadParserService } from "../src/modules/mqtt/mqtt-payload-parser.service";
import { MqttTopicService } from "../src/modules/mqtt/mqtt-topic.service";

describe("Phase 6 MQTT sensor parsing", () => {
  it("normalizes door, angle, and gangform payloads", () => {
    const topics = new MqttTopicService();
    const parser = new MqttPayloadParserService();
    const base = process.env.MQTT_TOPIC_BASE ?? "GSSIOT/test";

    expect(
      parser.parseSensorMessage(
        topics.parseSensorTopic(`${base}/GATE_PUB/GRM22JU22PGW-001`),
        JSON.stringify({ betChk: 87, doorChk: 1, doorNum: "D-1", msgId: "door-1" }),
      ),
    ).toMatchObject({
      gatewayMessageId: "door-1",
      gatewaySerial: "GW-001",
      nodeNumber: "D-1",
      nodeType: "door_node",
      status: "danger",
      values: { batteryLevel: 87, doorState: "open" },
    });

    expect(
      parser.parseSensorMessage(
        topics.parseSensorTopic(`${base}/GATE_ANG/GW-001`),
        JSON.stringify({ angle_x: 1.2, angle_y: -0.5, doorNum: "A-1", nodeType: 1 }),
      ),
    ).toMatchObject({
      nodeNumber: "A-1",
      nodeType: "angle_node",
      status: "safe",
      values: { angleX: 1.2, angleY: -0.5 },
    });

    expect(
      parser.parseSensorMessage(
        topics.parseSensorTopic(`${base}/GATE_FORM/GW-001`),
        JSON.stringify({ angle_x: 2.4, angle_y: 0.4, doorNum: "G-1", nodeType: "vertical" }),
      ),
    ).toMatchObject({
      nodeType: "gangform_node",
      values: { angleX: 2.4, angleY: 0.4 },
    });
  });

  it("rejects malformed or mismatched payloads", () => {
    const topics = new MqttTopicService();
    const parser = new MqttPayloadParserService();
    const base = process.env.MQTT_TOPIC_BASE ?? "GSSIOT/test";

    expect(
      parser.parseSensorMessage(topics.parseSensorTopic(`${base}/GATE_PUB/GW-001`), "{bad"),
    ).toBeNull();
    expect(
      parser.parseSensorMessage(
        topics.parseSensorTopic(`${base}/GATE_ANG/GW-001`),
        JSON.stringify({ angle_x: 1, doorNum: "A-1", nodeType: 2 }),
      ),
    ).toBeNull();
  });
});
