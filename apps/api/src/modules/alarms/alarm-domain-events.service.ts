import { EventEmitter } from "node:events";

import { Injectable } from "@nestjs/common";

export interface AlarmPolicyTriggeredEvent {
  alarmEventId: string;
  nodeId: string;
  policyId: string;
  ruleId: string;
  triggerId: string;
  triggeredAt: string;
}

@Injectable()
export class AlarmDomainEventsService {
  private readonly events = new EventEmitter();

  emitPolicyTriggered(event: AlarmPolicyTriggeredEvent): void {
    this.events.emit("alarm.policy-triggered", event);
  }

  onPolicyTriggered(listener: (event: AlarmPolicyTriggeredEvent) => void): void {
    this.events.on("alarm.policy-triggered", listener);
  }
}
