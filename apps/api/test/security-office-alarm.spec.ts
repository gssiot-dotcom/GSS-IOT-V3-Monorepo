import { GatewayCommandStatus, SensorReadingStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  decideSecurityOfficeCommand,
  desiredSecurityOfficeState,
  nodeAlarmSeverity,
  readSecurityOfficePayload,
  SECURITY_OFFICE_RESEND_AFTER_MS,
} from "../src/modules/security-office-alarm/security-office-alarm.policy";
import type { LastSecurityOfficeCommand } from "../src/modules/security-office-alarm/security-office-alarm.policy";

const now = new Date("2026-11-24T12:00:00.000Z");
const active = (alertLevel: number) => ({ alarmActive: true, alertLevel });
const clear = { alarmActive: false, alertLevel: 0 };

function last(
  state: { alarmActive: boolean; alertLevel: number },
  status: GatewayCommandStatus,
  ageMs = 1_000,
): LastSecurityOfficeCommand {
  return { ...state, status, updatedAt: new Date(now.getTime() - ageMs) };
}

describe("security-office alarm node severity", () => {
  it("maps live unsafe classifications and ignores safe, unconfigured and fault-filtered nodes", () => {
    const node = (status: SensorReadingStatus, faultFiltered = false) =>
      nodeAlarmSeverity({ classificationEvidence: null, faultFiltered, status });

    expect(node(SensorReadingStatus.CAUTION)).toBe("caution");
    expect(node(SensorReadingStatus.WARNING)).toBe("warning");
    expect(node(SensorReadingStatus.DANGER)).toBe("danger");
    expect(node(SensorReadingStatus.SAFE)).toBeNull();
    expect(node(SensorReadingStatus.UNCONFIGURED)).toBeNull();
    expect(node(SensorReadingStatus.DANGER, true)).toBeNull();
  });

  it("keeps the last classified severity of an offline node because silence is not safety", () => {
    const offline = (classificationEvidence: unknown) =>
      nodeAlarmSeverity({
        classificationEvidence,
        faultFiltered: false,
        status: SensorReadingStatus.OFFLINE,
      });

    expect(offline({ classification: "danger" })).toBe("danger");
    expect(offline({ classification: "warning" })).toBe("warning");
    expect(offline({ classification: "safe" })).toBeNull();
    expect(offline({ classification: "unconfigured" })).toBeNull();
    expect(offline(null)).toBeNull();
    expect(offline(["danger"])).toBeNull();
  });

  it("uses the highest severity across the site and level 0 when nothing is alarming", () => {
    expect(desiredSecurityOfficeState([])).toEqual(clear);
    expect(desiredSecurityOfficeState([null, null])).toEqual(clear);
    expect(desiredSecurityOfficeState(["caution", null])).toEqual(active(1));
    expect(desiredSecurityOfficeState(["caution", "danger", "warning"])).toEqual(active(3));
  });

  it("reads only well-formed stored cmd 3 payloads", () => {
    expect(
      readSecurityOfficePayload({ alarmActive: true, alertLevel: 2, cmd: 3, requestId: "x" }),
    ).toEqual(active(2));
    expect(readSecurityOfficePayload({ alarmActive: "true", alertLevel: 2 })).toBeNull();
    expect(readSecurityOfficePayload({ alarmActive: true })).toBeNull();
    expect(readSecurityOfficePayload(null)).toBeNull();
  });
});

describe("security-office alarm command decision", () => {
  it("activates on the first unsafe state and stays quiet when nothing was ever commanded", () => {
    expect(decideSecurityOfficeCommand(active(2), null, now)).toEqual({
      kind: "send",
      reason: "activate",
      state: active(2),
    });
    expect(decideSecurityOfficeCommand(clear, null, now)).toEqual({
      kind: "none",
      reason: "no-alarm",
    });
  });

  it("does not repeat an acknowledged or in-flight state so a device button press is respected", () => {
    for (const status of [
      GatewayCommandStatus.ACKNOWLEDGED,
      GatewayCommandStatus.SENT,
      GatewayCommandStatus.PENDING,
      GatewayCommandStatus.CANCELLED,
    ]) {
      expect(decideSecurityOfficeCommand(active(3), last(active(3), status), now)).toEqual({
        kind: "none",
        reason: "already-commanded",
      });
    }
  });

  it("re-sends on escalation but not on de-escalation within one alarm episode", () => {
    const acknowledged = GatewayCommandStatus.ACKNOWLEDGED;
    expect(decideSecurityOfficeCommand(active(3), last(active(1), acknowledged), now)).toEqual({
      kind: "send",
      reason: "escalate",
      state: active(3),
    });
    expect(decideSecurityOfficeCommand(active(1), last(active(3), acknowledged), now)).toEqual({
      kind: "none",
      reason: "de-escalation",
    });
  });

  it("clears with alertLevel 0 when the site becomes safe and re-activates a new episode", () => {
    const acknowledged = GatewayCommandStatus.ACKNOWLEDGED;
    expect(decideSecurityOfficeCommand(clear, last(active(2), acknowledged), now)).toEqual({
      kind: "send",
      reason: "clear",
      state: clear,
    });
    expect(decideSecurityOfficeCommand({ alarmActive: false, alertLevel: 7 }, null, now)).toEqual({
      kind: "none",
      reason: "no-alarm",
    });
    expect(decideSecurityOfficeCommand(clear, last(clear, acknowledged), now)).toEqual({
      kind: "none",
      reason: "already-commanded",
    });
    expect(decideSecurityOfficeCommand(active(1), last(clear, acknowledged), now)).toEqual({
      kind: "send",
      reason: "activate",
      state: active(1),
    });
  });

  it("re-sends an undelivered identical state only after the cooldown", () => {
    for (const status of [GatewayCommandStatus.EXPIRED, GatewayCommandStatus.FAILED]) {
      expect(
        decideSecurityOfficeCommand(
          active(3),
          last(active(3), status, SECURITY_OFFICE_RESEND_AFTER_MS - 1),
          now,
        ),
      ).toEqual({ kind: "none", reason: "resend-cooldown" });
      expect(
        decideSecurityOfficeCommand(
          active(3),
          last(active(3), status, SECURITY_OFFICE_RESEND_AFTER_MS),
          now,
        ),
      ).toEqual({ kind: "send", reason: "resend", state: active(3) });
    }
  });

  it("sends a changed state immediately when the previous command was not delivered", () => {
    expect(
      decideSecurityOfficeCommand(clear, last(active(3), GatewayCommandStatus.FAILED), now),
    ).toEqual({ kind: "send", reason: "resend", state: clear });
    expect(
      decideSecurityOfficeCommand(active(1), last(active(3), GatewayCommandStatus.EXPIRED), now),
    ).toEqual({ kind: "send", reason: "resend", state: active(1) });
  });
});
