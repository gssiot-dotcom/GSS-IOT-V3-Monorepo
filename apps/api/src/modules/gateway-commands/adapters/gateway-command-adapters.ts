import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { GatewayCommandType } from "@prisma/client";

import { MqttTopicService } from "../../mqtt/mqtt-topic.service";

export interface GatewayCommandAdapterInput {
  gatewaySerial: string;
  nodeNumbers?: string[];
  nodeTypeNumericCode?: number;
  alarmActive?: boolean;
  alertLevel?: number;
  alarmEnabled?: boolean;
  enabled?: boolean;
  alarmLevel1?: number;
  alarmLevel2?: number;
  alarmLevel3?: number;
}

export interface BuiltGatewayCommand {
  commandNumber: number;
  commandType: GatewayCommandType;
  payload: Record<string, unknown>;
  topic: string;
}

@Injectable()
export class GatewayCommandAdapterRegistry {
  constructor(@Inject(MqttTopicService) private readonly topics: MqttTopicService) {}

  buildRegisterNodes(input: GatewayCommandAdapterInput): BuiltGatewayCommand {
    this.assertNodeType(input.nodeTypeNumericCode);
    const nodes = this.assertNodes(input.nodeNumbers);
    return {
      commandNumber: 2,
      commandType: "REGISTER_NODES",
      payload: {
        cmd: 2,
        nodeType: input.nodeTypeNumericCode,
        numNodes: nodes.length,
        nodes,
      },
      topic: this.topics.publishTopic(input.gatewaySerial),
    };
  }

  buildWakeSecurity(input: GatewayCommandAdapterInput): BuiltGatewayCommand {
    if (typeof input.alarmActive !== "boolean" || typeof input.alertLevel !== "number") {
      throw new BadRequestException("Wake security command requires alarmActive and alertLevel.");
    }
    return {
      commandNumber: 3,
      commandType: "WAKE_SECURITY",
      payload: { alarmActive: input.alarmActive, alertLevel: input.alertLevel, cmd: 3 },
      topic: this.topics.publishTopic(input.gatewaySerial),
    };
  }

  buildSetAlarmLevels(input: GatewayCommandAdapterInput): BuiltGatewayCommand {
    this.assertNodeType(input.nodeTypeNumericCode);
    if (typeof input.alarmEnabled !== "boolean" || typeof input.enabled !== "boolean") {
      throw new BadRequestException("Alarm-level command requires enabled flags.");
    }
    const payload: Record<string, unknown> = {
      alarmEnabled: input.alarmEnabled,
      cmd: 4,
      enabled: input.enabled,
      nodeType: input.nodeTypeNumericCode,
    };
    if (input.nodeTypeNumericCode !== 0) {
      for (const key of ["alarmLevel1", "alarmLevel2", "alarmLevel3"] as const) {
        if (typeof input[key] !== "number") {
          throw new BadRequestException(
            "Angle and gangform alarm-level commands require three levels.",
          );
        }
        payload[key] = input[key];
      }
    }
    return {
      commandNumber: 4,
      commandType: "SET_ALARM_LEVELS",
      payload,
      topic: this.topics.publishTopic(input.gatewaySerial),
    };
  }

  buildSetFaultFilter(input: GatewayCommandAdapterInput): BuiltGatewayCommand {
    this.assertNodeType(input.nodeTypeNumericCode);
    const nodes = this.assertNodes(input.nodeNumbers);
    return {
      commandNumber: 5,
      commandType: "SET_FAULT_FILTER",
      payload: {
        cmd: 5,
        nodeType: input.nodeTypeNumericCode,
        numNodes: nodes.length,
        nodes,
      },
      topic: this.topics.publishTopic(input.gatewaySerial),
    };
  }

  private assertNodeType(value: number | undefined): asserts value is number {
    if (value === undefined || !Number.isInteger(value) || value < 0 || value > 2) {
      throw new BadRequestException("Unsupported node type for gateway command.");
    }
  }

  private assertNodes(nodes: string[] | undefined): number[] {
    if (!nodes?.length) {
      throw new BadRequestException("At least one node is required.");
    }
    const normalized = nodes.map((node) => this.normalizeNodeNumber(node));
    if (new Set(normalized).size !== normalized.length) {
      throw new BadRequestException("Node numbers must be unique after numeric normalization.");
    }
    return normalized;
  }

  private normalizeNodeNumber(node: string): number {
    const text = node.trim();
    if (!text) {
      throw new BadRequestException("Node numbers cannot be empty.");
    }
    if (text.startsWith("-")) {
      throw new BadRequestException("Node numbers cannot be negative.");
    }
    if (!/^\d+$/.test(text)) {
      throw new BadRequestException("Node numbers must be numeric.");
    }
    const numberValue = Number(text);
    if (!Number.isSafeInteger(numberValue)) {
      throw new BadRequestException("Node numbers must be safe integers.");
    }
    return numberValue;
  }
}
