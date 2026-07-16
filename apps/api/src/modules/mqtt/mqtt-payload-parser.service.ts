import { Injectable } from "@nestjs/common";
import type { CanonicalNodeType, MonitoringStatus, SensorValues } from "@gss-iot/contracts";

export interface ParsedGatewayResponse {
  cmd: number;
  failureReason?: string;
  gatewaySerial: string;
  payload: Record<string, unknown>;
  success: boolean;
}

export interface ParsedSensorMessage {
  gatewayMessageId?: string;
  gatewaySequence?: string;
  gatewaySerial: string;
  measuredAt?: Date;
  nodeNumber: string;
  nodeType: CanonicalNodeType;
  payload: Record<string, unknown>;
  status: MonitoringStatus;
  values: SensorValues;
}

@Injectable()
export class MqttPayloadParserService {
  parseGatewayResponse(
    gatewaySerial: string | null,
    rawPayload: Buffer | string,
  ): ParsedGatewayResponse | null {
    if (!gatewaySerial) {
      return null;
    }
    try {
      const text = Buffer.isBuffer(rawPayload) ? rawPayload.toString("utf8") : rawPayload;
      const payload = JSON.parse(text) as unknown;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return null;
      }
      const record = payload as Record<string, unknown>;
      const cmd = Number(record.cmd);
      if (!Number.isInteger(cmd)) {
        return null;
      }
      const normalized = this.normalizeGatewayResponse(record);
      return { cmd, gatewaySerial, payload: record, ...normalized };
    } catch {
      return null;
    }
  }

  parseSensorMessage(
    topicContext: { gatewaySerial: string; nodeType: CanonicalNodeType } | null,
    rawPayload: Buffer | string,
  ): ParsedSensorMessage | null {
    if (!topicContext) {
      return null;
    }
    const payload = this.safeObject(rawPayload);
    if (!payload) {
      return null;
    }
    if (!this.payloadNodeTypeMatchesTopic(payload, topicContext.nodeType)) {
      return null;
    }

    const nodeNumber = this.toNonEmptyString(payload.doorNum ?? payload.nodeNumber ?? payload.node);
    if (!nodeNumber) {
      return null;
    }

    const measuredAt = this.parseDate(
      payload.measuredAt ?? payload.timestamp ?? payload.time ?? payload.createdAt,
    );
    const gatewayMessageId = this.toNonEmptyString(
      payload.messageId ?? payload.msgId ?? payload.id ?? payload.packetId,
    );
    const gatewaySequence = this.toNonEmptyString(
      payload.sequenceNumber ?? payload.sequence ?? payload.seq,
    );

    if (topicContext.nodeType === "door_node") {
      const doorChk = this.toFiniteNumber(payload.doorChk ?? payload.doorState);
      if (doorChk === null) {
        return null;
      }
      const batteryLevel = this.toNullableInteger(
        payload.betChk ?? payload.betChk_2 ?? payload.betChk_3 ?? payload.batteryLevel,
      );
      const doorState = doorChk === 1 ? "open" : "closed";
      return {
        gatewayMessageId,
        gatewaySequence,
        gatewaySerial: topicContext.gatewaySerial,
        measuredAt,
        nodeNumber,
        nodeType: topicContext.nodeType,
        payload,
        status: doorState === "open" ? "danger" : "safe",
        values: { batteryLevel, doorState },
      };
    }

    const angleX = this.toFiniteNumber(payload.angle_x ?? payload.angleX);
    const angleY = this.toFiniteNumber(payload.angle_y ?? payload.angleY ?? 0);
    if (angleX === null || angleY === null) {
      return null;
    }

    return {
      gatewayMessageId,
      gatewaySequence,
      gatewaySerial: topicContext.gatewaySerial,
      measuredAt,
      nodeNumber,
      nodeType: topicContext.nodeType,
      payload,
      status: this.parseStatus(payload.status),
      values: { angleX, angleY },
    };
  }

  private safeObject(rawPayload: Buffer | string): Record<string, unknown> | null {
    try {
      const text = Buffer.isBuffer(rawPayload) ? rawPayload.toString("utf8") : rawPayload;
      const payload = JSON.parse(text) as unknown;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return null;
      }
      return payload as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private normalizeGatewayResponse(payload: Record<string, unknown>): {
    failureReason?: string;
    success: boolean;
  } {
    const error = this.toNonEmptyString(payload.error);
    if (error && !this.isFalseLike(error)) {
      return { failureReason: error, success: false };
    }

    for (const key of ["success", "ok", "ack"] as const) {
      const normalized = this.normalizeBooleanLike(payload[key]);
      if (normalized !== null) {
        return normalized
          ? { success: true }
          : { failureReason: `${key} reported failure.`, success: false };
      }
    }

    for (const key of ["resp", "result", "status"] as const) {
      const normalized = this.normalizeStringOutcome(payload[key]);
      if (normalized !== null) {
        return normalized
          ? { success: true }
          : { failureReason: `${key} reported failure.`, success: false };
      }
    }

    return {
      failureReason: "Gateway response did not contain an accepted success value.",
      success: false,
    };
  }

  private normalizeBooleanLike(value: unknown): boolean | null {
    if (value === true) {
      return true;
    }
    if (value === false) {
      return false;
    }
    return this.normalizeStringOutcome(value);
  }

  private normalizeStringOutcome(value: unknown): boolean | null {
    const text = this.toNonEmptyString(value)?.toLowerCase();
    if (!text) {
      return null;
    }
    if (["success", "ok", "ack", "acknowledged", "true"].includes(text)) {
      return true;
    }
    if (["fail", "failed", "failure", "error", "nack", "ng", "false"].includes(text)) {
      return false;
    }
    return null;
  }

  private isFalseLike(value: string): boolean {
    return ["false", "0", "none", "null", "undefined"].includes(value.toLowerCase());
  }

  private payloadNodeTypeMatchesTopic(
    payload: Record<string, unknown>,
    topicNodeType: CanonicalNodeType,
  ): boolean {
    const raw = payload.nodeType ?? payload.alarmType ?? payload.type;
    if (raw === undefined || raw === null) {
      return true;
    }
    const normalized = this.normalizeNodeType(raw);
    return !normalized || normalized === topicNodeType;
  }

  private normalizeNodeType(value: unknown): CanonicalNodeType | null {
    if (value === 0 || value === "0" || value === "door_node") {
      return "door_node";
    }
    if (value === 1 || value === "1" || value === "angle_node") {
      return "angle_node";
    }
    if (
      value === 2 ||
      value === "2" ||
      value === "gangform_node" ||
      value === "vertical_node" ||
      value === "vertical" ||
      value === "gangform"
    ) {
      return "gangform_node";
    }
    return null;
  }

  private parseStatus(value: unknown): MonitoringStatus {
    return value === "caution" ||
      value === "warning" ||
      value === "danger" ||
      value === "offline" ||
      value === "safe"
      ? value
      : "safe";
  }

  private parseDate(value: unknown): Date | undefined {
    if (typeof value !== "string" && typeof value !== "number") {
      return undefined;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private toFiniteNumber(value: unknown): number | null {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private toNullableInteger(value: unknown): number | null {
    const numberValue = this.toFiniteNumber(value);
    return numberValue === null ? null : Math.trunc(numberValue);
  }

  private toNonEmptyString(value: unknown): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    const text = String(value).trim();
    return text.length ? text : undefined;
  }
}
