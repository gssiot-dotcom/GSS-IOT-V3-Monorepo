import { Inject, Injectable } from "@nestjs/common";
import { GatewayCommandStatus } from "@prisma/client";

import { AuditLogService } from "../audit-logs/audit-log.service";
import { MqttClientService } from "../mqtt/mqtt-client.service";
import { GatewayCommandsService } from "./gateway-commands.service";

@Injectable()
export class GatewayCommandPublisherService {
  constructor(
    @Inject(GatewayCommandsService) private readonly commands: GatewayCommandsService,
    @Inject(MqttClientService) private readonly mqtt: MqttClientService,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
  ) {}

  async publishPending(commandId: string) {
    const command = await this.commands.getCommand(commandId);
    if (command.status !== GatewayCommandStatus.PENDING) {
      return command;
    }
    if (command.expiresAt <= new Date()) {
      await this.commands.expireOverdueCommands();
      return this.commands.getCommand(commandId);
    }
    try {
      const result = await this.mqtt.publish(
        command.topic,
        command.payload as Record<string, unknown>,
      );
      if (result.skipped) {
        return command;
      }
      const sent = await this.commands.markSent(command.id);
      await this.auditLog.record(this.systemActor(), {
        action: "gateway-command.publish",
        entityId: sent.id,
        entityType: "GatewayCommand",
        newValue: sent,
        oldValue: command,
      });
      return sent;
    } catch (error) {
      const failed = await this.commands.markFailed(
        command.id,
        error instanceof Error ? error.message : "MQTT publish failed.",
      );
      await this.auditLog.record(this.systemActor(), {
        action: "gateway-command.publish-failed",
        entityId: failed.id,
        entityType: "GatewayCommand",
        newValue: failed,
        oldValue: command,
      });
      return failed;
    }
  }

  private systemActor() {
    return {
      aud: "gss-admin" as const,
      context: "gss-admin" as const,
      email: "system@gss.local",
      roleId: "00000000-0000-0000-0000-000000000000",
      sub: "00000000-0000-0000-0000-000000000000",
      tokenVersion: 0,
    };
  }
}
