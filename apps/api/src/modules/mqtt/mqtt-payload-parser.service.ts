import { Injectable } from "@nestjs/common";

export interface ParsedGatewayResponse {
  cmd: number;
  gatewaySerial: string;
  payload: Record<string, unknown>;
  success: boolean;
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
      const success =
        record.success === true ||
        record.result === "ok" ||
        record.status === "ok" ||
        record.ack === true ||
        record.error === undefined;
      return { cmd, gatewaySerial, payload: record, success };
    } catch {
      return null;
    }
  }
}
