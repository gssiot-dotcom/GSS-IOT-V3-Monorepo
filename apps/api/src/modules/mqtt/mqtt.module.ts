import { Module } from "@nestjs/common";

import { MqttClientService } from "./mqtt-client.service";
import { MqttPayloadParserService } from "./mqtt-payload-parser.service";
import { MqttTopicService } from "./mqtt-topic.service";

@Module({
  exports: [MqttClientService, MqttPayloadParserService, MqttTopicService],
  providers: [MqttClientService, MqttPayloadParserService, MqttTopicService],
})
export class MqttModule {}
