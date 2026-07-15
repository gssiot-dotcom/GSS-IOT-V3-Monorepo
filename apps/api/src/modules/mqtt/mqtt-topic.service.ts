import { Injectable } from "@nestjs/common";
import { loadApiEnv } from "@gss-iot/config";

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

  parseResponseGatewaySerial(topic: string): string | null {
    const prefix = `${this.topicBase}/GATE_RES/`;
    if (!topic.startsWith(prefix)) {
      return null;
    }
    const token = topic.slice(prefix.length);
    return token.replace(/^GRM22JU22P/, "") || null;
  }
}
