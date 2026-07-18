# CODEX PROMPT - Phase 11: Alarm occurrence-count engine

Read `AGENTS.md` first.

Then read all completed Phase 7-10 architecture docs and especially the latest approved occurrence-count blueprint. The latest blueprint overrides the older delay-only AlarmCandidate design.

Confirm Phase 10 is complete. Start only Phase 11.

Also read `docs/prompts/2nd-step/03_PHASE_8_MQTT_PROTOCOL_BASELINE.md`. Preserve the completed command correlation and provisioning provenance. Node/gateway/building reassignment must be derived only from acknowledged active assignment state, never from a merely PENDING or SENT provisioning command.

## Goal

Implement the database-backed alarm evaluation engine using:

- severity: caution, warning, danger;
- `requiredOccurrenceCount` = valid occurrence count;
- `countIntervalSeconds` = minimum interval before the next matching reading can count;
- CompanyPosition or specific user recipient policy;
- company/site/building/gateway/node-type scope;
- transaction-safe per node-policy counter state.

This phase creates alarm domain records and in-app notification records, but external provider delivery and full operations UI belong to Phase 12.

## Non-negotiable semantics

`requiredOccurrenceCount` is not number of notifications.

`countIntervalSeconds` is not a simple delayed timer.

Example:

```txt
12:00 danger -> count 1, nextCountAt 12:03
12:01 danger -> history only, no count
12:03 danger -> count 2
12:08 danger -> count 3, trigger
12:11 danger -> new cycle count 1, not count 4
```

Each reading belongs to only the highest matching severity. Danger must not also increment warning and caution.

## Prisma models

Implement the latest approved relational design, including equivalent models for:

- `AlarmRule`
- `AlarmRecipientPolicy`
- `AlarmCounterState`
- `AlarmEvent`
- `AlarmNotification`

Use CompanyPosition and/or specific user targets. Do not use CompanyRole as the primary recipient category.

Counter state must be one small mutable row per policy + node, not one new counter row per reading.

Add database constraints for:

- occurrence count >= 1;
- interval >= 0;
- unique policy+node state;
- notification idempotency;
- one active event per approved continuous episode key where appropriate.

## Evaluation integration

Integrate after SensorReading persistence and authoritative classification.

Required flow:

1. persist unique SensorReading;
2. update LatestNodeState;
3. if filtered, apply documented skip/reset behavior;
4. if safe, reset relevant counter states and resolve active event according to rule;
5. find active rules matching company/site/building/gateway/node type/severity;
6. for each active recipient policy lock/update AlarmCounterState transactionally;
7. count only when reading time >= nextCountAt;
8. create/update AlarmEvent and AlarmNotification when threshold count is reached;
9. close old cycle and make next eligible matching reading start a new cycle;
10. emit internal realtime alarm event after commit.

## Concurrency and dedupe

- Reuse SensorReading dedupe as first protection.
- Counter update must use row lock, serializable transaction or optimistic version check.
- Parallel messages must not double-increment.
- Duplicate ACK/message or retry must not duplicate AlarmNotification.
- Define behavior for out-of-order `measuredAt` vs `receivedAt`; document which timestamp drives counting.

## Reset and transition rules

Implement and test:

- safe -> all relevant active severity cycles reset;
- caution -> warning -> danger: old severity cycle resets, new severity starts;
- danger -> warning -> caution: old severity cycle closes, lower severity starts new cycle;
- configuration version change: define whether current counters reset;
- policy disable/delete: counter becomes inactive/cleared safely;
- node/gateway/building reassignment: stale scope counter cannot trigger in old scope.

## APIs

Create GSS and Company permission/scope protected CRUD for:

- rules;
- recipient policies;
- count/interval configuration;
- read-only counter/debug state for authorized admin support if useful;
- event list/detail foundation.

Permissions:

- `alarm-rules.view`
- `alarm-rules.manage`
- `alarms.view`

Do not expose internal concurrency fields as writable API inputs.

## Tests

Use `docs/quality/ALARM_OCCURRENCE_TEST_CASES.md` and expand it.

Required tests:

- immediate count 1/interval 0;
- count 3/3-minute exact timeline;
- ineligible readings remain in SensorReading but do not count;
- new cycle after trigger;
- parallel policies on one node;
- severity isolation;
- safe reset;
- severity up/down transitions;
- duplicate and parallel message protection;
- recipient position + scope resolution candidate set;
- inactive user/ended position ignored;
- policy disabled/config changed;
- node reassignment;
- permission/scope security.

## Out of scope

- No SMS/email/Telegram provider integration.
- No full alarm badge/list/ack/resolve UX beyond minimal debugging/admin foundation.
- No reports.
- Do not start Phase 12.

## Definition of Done

- Count/interval behavior exactly matches approved timeline.
- Counter state is durable and concurrency safe.
- AlarmEvent/Notification records are idempotent and auditable.
- Position + scope targeting is correct.
- Full unit/E2E matrix passes.
