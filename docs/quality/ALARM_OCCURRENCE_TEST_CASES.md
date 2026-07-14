# Alarm Occurrence Count — Mandatory Test Cases

## Terminology

- `requiredOccurrenceCount`: `회수`.
- `countIntervalSeconds`: `지속시간`, counted readings orasidagi minimal interval.
- A unique sensor reading is always stored in history.
- Only an eligible matching reading increments a policy counter.

## Base thresholds

```txt
safe: value < 1.0
caution: 1.0 <= value < 2.0
warning: 2.0 <= value < 4.0
danger: value >= 4.0
```

## TC-A01 — Count 3, interval 3 minutes

Policy:

```txt
severity=danger
requiredOccurrenceCount=3
countIntervalSeconds=180
```

Readings:

```txt
12:00 danger -> count 1, nextCountAt 12:03
12:01 danger -> stored only, count 1
12:03 danger -> count 2, nextCountAt 12:06
12:05 danger -> stored only, count 2
12:08 danger -> count 3, trigger
12:11 danger -> new cycle count 1
```

Assertions:

- six unique SensorReading rows;
- triggerReading is 12:08;
- exactly one notification per resolved recipient/channel for cycle 1;
- 12:11 is cycle 2 count 1, not old count 4.

## TC-A02 — Parallel count policies

```txt
A: count=1, interval=0
B: count=3, interval=180
C: count=5, interval=300
```

Assert each `node + policy` state is independent. One reading may trigger A and increment/trigger B/C independently.

## TC-A03 — Reading before interval

Reading received one second before `nextCountAt`:

- is persisted;
- updates LatestNodeState;
- does not increment counter;
- does not create notification.

## TC-A04 — Exact boundary

Reading at exactly `receivedAt == nextCountAt` must be eligible.

## TC-A05 — Safe reset

```txt
12:00 warning count 1
12:03 warning count 2
12:04 safe
12:10 warning
```

Assert 12:10 starts count 1 in a new cycle.

## TC-A06 — Severity escalation

```txt
warning count 2
next reading danger
```

Assert warning cycle resets and danger cycle starts at count 1. Danger must not increment warning or caution.

## TC-A07 — Severity de-escalation

Danger to warning starts a new warning cycle and closes/resets danger state according to event lifecycle rules.

## TC-A08 — Duplicate MQTT message

Two messages with same `(gatewayId,nodeId,sequenceNumber)`:

- one SensorReading insert;
- one counter increment;
- one notification maximum.

## TC-A09 — Concurrent eligible messages

Two different messages arrive concurrently after `nextCountAt`:

- transaction/lock/version prevents lost update or double trigger;
- cycle number and evidence are deterministic.

## TC-A10 — Fault-filtered node

Reading may be logged with filter evidence, but must not increment alarm counter or trigger notification.

## TC-A11 — No matching position recipient

Policy triggers but no active position assignment intersects scope:

- AlarmEvent/evidence is retained;
- notification is `skipped` with reason `NO_RECIPIENT` or equivalent;
- no cross-scope fallback recipient is invented.

## TC-A12 — Inactive recipient

Inactive user is excluded at send resolution time.

## TC-A13 — Scope mismatch

Position assignment for Building B must not receive Building A alarm, even if position name matches.

## TC-A14 — Provider failure

Business trigger creates one AlarmNotification. Provider technical retries create delivery attempts, not new occurrence triggers.

## TC-A15 — Restart resilience

After API restart, counter state is restored from PostgreSQL and next eligible reading continues correctly.

## TC-A16 — Rule update during cycle

When count/interval/recipient policy changes:

- versioned/updated policy behavior must be deterministic;
- recommended default: reset existing state for that policy and audit the reset.

## TC-A17 — Alarm acknowledgement

Acknowledgement does not automatically redefine sensor occurrence counting. Verify accepted business decision on whether later cycle triggers continue while unsafe state persists.

## TC-A18 — Data volume

Load test with expected node count and message rate:

- counter row count remains bounded by active node-policy combinations;
- sensor history insert throughput and partition/index strategy stay within target.
