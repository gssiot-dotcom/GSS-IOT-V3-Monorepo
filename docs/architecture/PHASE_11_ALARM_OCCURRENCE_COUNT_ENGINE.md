# Phase 11 — Alarm occurrence-count engine

## Scope

Phase 11 adds the database-backed occurrence-count foundation:

- `AlarmRule` scoped to building + node type + severity;
- `AlarmRecipientPolicy` with exactly one CompanyPosition or specific CompanyUser target;
- one mutable `AlarmCounterState` per policy + node;
- `AlarmEvent` for a continuous triggered episode;
- immutable `AlarmPolicyTrigger` rows for policy-cycle trigger evidence;
- internal post-commit `alarm.policy-triggered` domain events.

Phase 11 does not resolve final recipient user lists, create recipient notifications, call SMS/Telegram/email/web-push providers, create delivery logs, emit notification badges, or add acknowledge/resolve operations UI. Those are implemented by Phase 12 in `docs/architecture/PHASE_12_NOTIFICATIONS_AND_ALARM_OPERATIONS.md`.

Phase 11 controlled manual sensor-flow acceptance passed on 2026-07-21 through the combined Phase 11/12 live manual checklist. Phase 11 status is `PHASE_11_COMPLETE`.

## Evaluation integration

Occurrence evaluation is integrated into the existing `MonitoringService.persistSensorReading` flow. The API still uses the existing MQTT subscriber, parser, assignment resolver, `SensorReading` persistence, `LatestNodeState` upsert and Phase 9 backend classification.

The transaction order is:

1. resolve active gateway, gateway-company, gateway-building, node-company and node-gateway assignments;
2. create the unique `SensorReading`;
3. update gateway/node last-seen state;
4. upsert `LatestNodeState`;
5. evaluate Phase 11 alarm rules and counters in the same serializable transaction;
6. commit;
7. emit monitoring realtime and internal `alarm.policy-triggered` events after commit.

No Phase 11 code publishes cmd 4/cmd 5 or creates another MQTT ingestion path.

## Count semantics

`receivedAt` is the authoritative count clock. `measuredAt`, gateway timestamps and payload timestamps remain evidence only and cannot reorder counter progress.

`requiredOccurrenceCount` is the number of eligible matching sensor readings required to trigger a policy. `countIntervalSeconds` is the minimum interval between counted readings. A reading before `nextCountAt` is stored and updates latest state, but does not increment the counter. A reading exactly at `nextCountAt` is eligible.

After a policy reaches its threshold, the previous cycle closes, one immutable `AlarmPolicyTrigger` is created, `cycleNo` increments and `currentCount` resets to 0. The next eligible reading starts the next cycle at count 1; readings before the new `nextCountAt` remain history only.

## Classification, desired state and filters

Phase 11 consumes the Phase 9 authoritative `SensorReading.status`, `classificationEvidence` and `faultFiltered` fields. It does not recalculate thresholds and does not trust payload status over backend classification.

Only `CAUTION`, `WARNING` and `DANGER` are counted. `SAFE` resets pending counters and resolves active unsafe events for the node with reason `SAFE`. After Phase 12, active unsafe events may be `OPEN` or `ACKNOWLEDGED`; both are auto-resolved by safe/fault-filtered/desired-disabled reset behavior. `UNCONFIGURED` and `OFFLINE` are preserved in monitoring/history and do not count.

Backend evaluation uses `GatewayAlarmLevelApplication.desiredEnabled` as the operator business intent. If desired alarm state is false for the gateway + building + node type, Phase 11 stores the reading/latest state, resets pending cycles for the node and does not count. `appliedEnabled` remains hardware acknowledgement state and is not modified by Phase 11.

Fault-filtered readings remain auditable in `SensorReading`, update latest state and carry Phase 9 evidence. They do not count, create events or create policy triggers; they reset pending cycles and resolve open events with reason `FAULT_FILTERED`.

## Rule and policy behavior

The supported rule scope for this release is building + node type + severity. The rule company and area are derived from the building and stored for scoped queries and audit evidence. Active uniqueness is enforced by `(buildingId, nodeTypeId, severity, activeKey)`.

Recipient policies require exactly one target:

- active `CompanyPosition` in the same company; or
- `CompanyUser` in the same company.

CompanyRole and GSS role are not valid alarm recipient categories. Duplicate active policies for the same rule + target + channel are rejected by database uniqueness. Policy lifecycle uses soft disable/history preservation.

Policy evaluation-version changes reset existing counter progress. Count, interval, target and channel changes increment `evaluationVersion`; display-name-only rule changes do not reset counters.

## Event and trigger identity

The active event episode key is `nodeId + ruleId + severity + activeKey`. One open event is reused for later policy triggers during the same continuous severity episode.

The immutable policy-trigger idempotency key is `policyId + nodeId + triggerCycleNo`. The trigger stores policy/rule/event/node IDs, first/last/trigger reading IDs, occurrence count, interval snapshot, evaluation-version snapshot, receivedAt trigger timestamp, compact classification evidence and assignment provenance.

Assignment provenance captures the active assignment rows used for evaluation:

- gateway-company assignment;
- gateway-building assignment;
- node-company assignment;
- node-gateway assignment.

Pending/sent provisioning commands, ended assignments and inactive company-device assignments are not used.

## Concurrency strategy

`MonitoringService.persistSensorReading` runs the reading/latest/evaluator work in a PostgreSQL serializable Prisma transaction with a bounded three-attempt retry on serialization conflict. `SensorReading.deduplicationKey` remains the first duplicate protection. Counter state uniqueness and trigger uniqueness provide database-level idempotency after restart or retry.

No Socket.IO or provider work is performed inside the transaction.

## APIs

GSS Admin:

- `GET /admin/alarm-rules`
- `GET /admin/alarm-rules/:ruleId`
- `POST /admin/alarm-rules`
- `PATCH /admin/alarm-rules/:ruleId`
- `DELETE /admin/alarm-rules/:ruleId`
- `GET /admin/alarm-rules/:ruleId/policies`
- `POST /admin/alarm-rules/:ruleId/policies`
- `PATCH /admin/alarm-policies/:policyId`
- `DELETE /admin/alarm-policies/:policyId`
- `GET /admin/alarms/counters`
- `GET /admin/alarms/events`
- `GET /admin/alarms/triggers`

Company endpoints mirror the same paths under `/company/*`. Rules and mutations require `alarm-rules.view/manage`; counter/event/trigger reads require `alarms.view`. Company endpoints also enforce same-company and building scope in service logic.

## Manual acceptance closeout

Manual acceptance passed on 2026-07-21. The verified live flow confirmed:

- CompanyPosition + scope recipient resolution worked for alarm policy evaluation.
- The Platform Manager policy generated notifications independently according to its own `requiredOccurrenceCount` and `countIntervalSeconds` configuration.
- Multiple eligible policy triggers created multiple notifications while one continuous unsafe node episode used one shared `AlarmEvent`.
- Site Manager acknowledgement updated that shared event, and the acknowledged state was visible to the Platform Manager.
- Unsafe manual resolve was rejected while the node remained in `DANGER`, and the rejected mutation did not change the event to `RESOLVED`.
- When the node returned to `SAFE`, automatic alarm resolution worked.
- Manual resolve also worked after the node was `SAFE`.
- The counter/notification flow and shared `AlarmEvent` behavior were verified end to end.

This closeout does not change MQTT ingestion, Phase 9 classification/alarm-level behavior, occurrence-count semantics, recipient resolution, `AlarmEvent` identity rules or automatic safe resolution.
