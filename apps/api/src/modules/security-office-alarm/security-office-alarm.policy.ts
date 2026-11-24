import { GatewayCommandStatus, SensorReadingStatus } from "@prisma/client";

/**
 * Security-office gateway (경비실 게이트웨이) linkage rules.
 *
 * A SECURITY_OFFICE_GATEWAY mirrors the highest active alarm severity of every node in the
 * construction site (Area) that contains the building it is assigned to. The backend only
 * publishes cmd 3 on state transitions so a local button acknowledgement on the device is not
 * immediately overridden by the next repeated reading.
 */

export type SecurityOfficeSeverity = "caution" | "warning" | "danger";

export const SECURITY_OFFICE_ALERT_LEVEL: Readonly<Record<SecurityOfficeSeverity, number>> = {
  caution: 1,
  warning: 2,
  danger: 3,
};

export const SECURITY_OFFICE_CLEAR_ALERT_LEVEL = 0;

/** Minimum wait before an undelivered (FAILED/EXPIRED) identical state is published again. */
export const SECURITY_OFFICE_RESEND_AFTER_MS = 60_000;

export interface SecurityOfficeAlarmState {
  alarmActive: boolean;
  alertLevel: number;
}

export interface LastSecurityOfficeCommand {
  alarmActive: boolean;
  alertLevel: number;
  status: GatewayCommandStatus;
  /** Time of the command's latest lifecycle transition. */
  updatedAt: Date;
}

export type SecurityOfficeDecision =
  | {
      kind: "none";
      reason: "already-commanded" | "de-escalation" | "no-alarm" | "resend-cooldown";
    }
  | {
      kind: "send";
      reason: "activate" | "clear" | "escalate" | "resend";
      state: SecurityOfficeAlarmState;
    };

export interface NodeAlarmSnapshot {
  classificationEvidence: unknown;
  faultFiltered: boolean;
  status: SensorReadingStatus;
}

const severityByStatus: Partial<Record<SensorReadingStatus, SecurityOfficeSeverity>> = {
  [SensorReadingStatus.CAUTION]: "caution",
  [SensorReadingStatus.WARNING]: "warning",
  [SensorReadingStatus.DANGER]: "danger",
};

const severityByClassification: Readonly<Record<string, SecurityOfficeSeverity>> = {
  caution: "caution",
  danger: "danger",
  warning: "warning",
};

const undeliveredStatuses: ReadonlySet<GatewayCommandStatus> = new Set([
  GatewayCommandStatus.EXPIRED,
  GatewayCommandStatus.FAILED,
]);

/**
 * Returns the alarm severity a node currently contributes. OFFLINE nodes keep their last
 * classified severity because silence is not evidence of safety; only a SAFE reading,
 * fault filtering, disabled alarm intent or unassignment clears the contribution.
 */
export function nodeAlarmSeverity(node: NodeAlarmSnapshot): SecurityOfficeSeverity | null {
  if (node.faultFiltered) return null;
  if (node.status === SensorReadingStatus.OFFLINE) {
    const evidence = node.classificationEvidence;
    if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return null;
    const classification = (evidence as { classification?: unknown }).classification;
    return typeof classification === "string"
      ? (severityByClassification[classification] ?? null)
      : null;
  }
  return severityByStatus[node.status] ?? null;
}

export function desiredSecurityOfficeState(
  severities: ReadonlyArray<SecurityOfficeSeverity | null>,
): SecurityOfficeAlarmState {
  const alertLevel = severities.reduce<number>(
    (highest, severity) =>
      severity ? Math.max(highest, SECURITY_OFFICE_ALERT_LEVEL[severity]) : highest,
    SECURITY_OFFICE_CLEAR_ALERT_LEVEL,
  );
  return { alarmActive: alertLevel > SECURITY_OFFICE_CLEAR_ALERT_LEVEL, alertLevel };
}

/** Reads the commanded state from a stored cmd 3 payload; malformed payloads return null. */
export function readSecurityOfficePayload(payload: unknown): SecurityOfficeAlarmState | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const { alarmActive, alertLevel } = payload as Record<string, unknown>;
  if (typeof alarmActive !== "boolean" || typeof alertLevel !== "number") return null;
  return { alarmActive, alertLevel };
}

export function decideSecurityOfficeCommand(
  desired: SecurityOfficeAlarmState,
  last: LastSecurityOfficeCommand | null,
  now: Date,
  resendAfterMs = SECURITY_OFFICE_RESEND_AFTER_MS,
): SecurityOfficeDecision {
  const target = normalize(desired);
  if (!last) {
    return target.alarmActive
      ? { kind: "send", reason: "activate", state: target }
      : { kind: "none", reason: "no-alarm" };
  }

  const previous = normalize(last);
  const sameState =
    previous.alarmActive === target.alarmActive && previous.alertLevel === target.alertLevel;

  if (undeliveredStatuses.has(last.status)) {
    if (!sameState) return { kind: "send", reason: "resend", state: target };
    return now.getTime() - last.updatedAt.getTime() >= resendAfterMs
      ? { kind: "send", reason: "resend", state: target }
      : { kind: "none", reason: "resend-cooldown" };
  }

  // PENDING, SENT, ACKNOWLEDGED and operator-CANCELLED commands count as already commanded.
  if (!target.alarmActive) {
    return previous.alarmActive
      ? { kind: "send", reason: "clear", state: target }
      : { kind: "none", reason: "already-commanded" };
  }
  if (!previous.alarmActive) {
    return { kind: "send", reason: "activate", state: target };
  }
  if (target.alertLevel > previous.alertLevel) {
    return { kind: "send", reason: "escalate", state: target };
  }
  return target.alertLevel < previous.alertLevel
    ? { kind: "none", reason: "de-escalation" }
    : { kind: "none", reason: "already-commanded" };
}

function normalize(state: SecurityOfficeAlarmState): SecurityOfficeAlarmState {
  return state.alarmActive
    ? state
    : { alarmActive: false, alertLevel: SECURITY_OFFICE_CLEAR_ALERT_LEVEL };
}
