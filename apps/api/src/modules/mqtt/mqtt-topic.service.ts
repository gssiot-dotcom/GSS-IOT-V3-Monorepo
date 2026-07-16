import { Injectable } from "@nestjs/common";
import { loadApiEnv } from "@gss-iot/config";
import type { CanonicalNodeType } from "@gss-iot/contracts";

@Injectable()
export class MqttTopicService {
  private readonly topicBase: string;

  constructor() {
    this.topicBase = loadApiEnv().MQTT_TOPIC_BASE.replace(/\/+$/, "");
  }

  publishTopic(gatewaySerial: string): string {
    return `${this.topicBase}/GATE_SUB/GRM22JU22P${gatewaySerial}`;
  }

  responseTopicFilter(): string {
    return `${this.topicBase}/GATE_RES/+`;
  }

  sensorTopicFilters(): string[] {
    return [
      `${this.topicBase}/GATE_PUB/+`,
      `${this.topicBase}/GATE_ANG/+`,
      `${this.topicBase}/GATE_FORM/+`,
    ];
  }

  parseResponseGatewaySerial(topic: string): string | null {
    const prefix = `${this.topicBase}/GATE_RES/`;
    if (!topic.startsWith(prefix)) {
      return null;
    }
    const token = topic.slice(prefix.length);
    return token.replace(/^GRM22JU22P/, "") || null;
  }

  parseSensorTopic(topic: string): { gatewaySerial: string; nodeType: CanonicalNodeType } | null {
    const prefixes: Array<{ prefix: string; nodeType: CanonicalNodeType }> = [
      { nodeType: "door_node", prefix: `${this.topicBase}/GATE_PUB/` },
      { nodeType: "angle_node", prefix: `${this.topicBase}/GATE_ANG/` },
      { nodeType: "gangform_node", prefix: `${this.topicBase}/GATE_FORM/` },
    ];
    const match = prefixes.find(({ prefix }) => topic.startsWith(prefix));
    if (!match) {
      return null;
    }
    const token = topic.slice(match.prefix.length).replace(/^GRM22JU22P/, "");
    return token ? { gatewaySerial: token, nodeType: match.nodeType } : null;
  }
}
