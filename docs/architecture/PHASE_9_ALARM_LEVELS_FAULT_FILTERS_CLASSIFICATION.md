# Phase 9 — Alarm levels, fault filters and authoritative classification

## Scope

Phase 9 adds persisted alarm-level desired/applied state, fault-filter desired/applied state and backend-derived monitoring classification. It does not implement occurrence counting, `AlarmEvent`, recipient resolution, notifications, reports, retention, partitioning, migration or deployment.

## Decisions

- Angle and gangform classification metric is `max(abs(angleX), abs(angleY))`.
- Legacy `green/yellow/red` values map to `cautionThreshold/warningThreshold/dangerThreshold`.
- Thresholds are inclusive: `danger >= dangerThreshold`, else `warning >= warningThreshold`, else `caution >= cautionThreshold`, else `safe`.
- Enabled angle/gangform configurations require `0 < cautionThreshold < warningThreshold < dangerThreshold <= 12`.
- The canonical alarm-level scope is `building + node type`; Phase 9 does not add per-gateway threshold overrides.
- Legacy per-gateway alarm enable/disable is supported as per `gateway + building + node type` desired/applied state. It toggles hardware alarm activation only and never stores per-gateway threshold overrides.
- Door classification remains `doorChk = 0 => safe`, `doorChk = 1 => danger`; door cmd 4 controls enabled/alarmEnabled only.
- Calibration is deferred. Phase 9 uses raw absolute `angleX` and `angleY`.
- Missing active angle/gangform configuration is `UNCONFIGURED`, not safe.
- ACK-applied fault-filtered readings are retained in `SensorReading`, update `LatestNodeState`, store `faultFiltered=true` evidence and are marked for exclusion by future occurrence counting.

## Data model

Phase 9 migration `20260718120000_phase_9_alarm_levels_fault_filters` is additive:

- `BuildingAlarmLevelConfiguration`: current desired building + node-type configuration with explicit `enabled`, thresholds, version and updater.
- `BuildingAlarmLevelConfigurationHistory`: version history for every desired mutation.
- `GatewayAlarmLevelApplication`: per gateway desired/applied command status, applied version, request id, payload and failure details.
- `GatewayAlarmLevelApplication.desiredEnabled` and `appliedEnabled`: user-requested gateway/node-type alarm activation and the hardware ACK-applied activation. Future occurrence counting must consume the ACK-applied state, while UI displays desired state separately.
- `GatewayFaultFilterDesiredState`: desired gateway + node-type + node filter state linked to the cmd 5 command attempt.
- `GatewayFaultFilterAppliedState`: ACK-applied gateway + node-type + node filter state.
- `SensorReading.status` adds `UNCONFIGURED`.
- `SensorReading` and `LatestNodeState` add `classificationEvidence` and `faultFiltered`.

## Command flow

Alarm-level save:

1. Guarded GSS/Company endpoint validates `alarm-levels.manage`; Company endpoints also require building scope.
2. Desired building/node-type configuration is persisted first and versioned.
3. Active gateways assigned to the building are selected.
4. One existing `GatewayCommand` outbox command is created per gateway with `cmd=4`.
5. Building-level save sends hardware `enabled=true` and `alarmEnabled=true` for the selected node type on every active building gateway.
6. The final stored/published payload contains `requestId = GatewayCommand.id`.
7. Only strict successful ACK updates `GatewayAlarmLevelApplication` applied fields.
8. Mixed gateway results remain visible per gateway; one failed/pending gateway must not hide another gateway's successful application.

Single-gateway enable/disable:

1. Guarded GSS/Company endpoints validate `alarm-levels.manage`; Company endpoints also require building scope.
2. The gateway must be active and actively assigned to the requested building.
3. The selected building + node-type configuration supplies canonical thresholds.
4. The desired enabled state is persisted before publish and linked to one cmd 4 `GatewayCommand`.
5. Angle/gangform enable sends `enabled=true`, `alarmEnabled=true` and canonical thresholds.
6. Angle/gangform disable sends `enabled=false`, `alarmEnabled=false` without thresholds.
7. Door disable preserves legacy firmware shape: `enabled=true`, `alarmEnabled=false`.
8. Only strict successful ACK updates `appliedEnabled`; negative, timeout, expired, cancelled and late ACKs do not change applied state.
9. Publish uses the existing publisher; offline gateways remain `PENDING`.

Fault-filter save:

1. Guarded endpoint validates permission and scope.
2. Every selected node must belong to the company, be actively assigned to the selected gateway, match node type, have a numeric wire node number and be unique after numeric normalization.
3. Desired gateway/node-type/node state is persisted.
4. Existing outbox creates one `cmd=5` command. Node arrays stay JSON numbers on the MQTT wire.
5. Only strict successful ACK updates applied filter state.

Negative ACK, timeout, expired, cancelled and late ACK do not update applied state. Duplicate ACK is idempotent because the existing command lifecycle ignores terminal duplicate responses.

## Classification evidence

Angle/gangform readings store evidence including:

- raw `angleX` and `angleY`;
- absolute `angleX` and `angleY`;
- selected metric;
- matched configuration id/version;
- thresholds used;
- resulting classification;
- configuration state;
- raw payload status as diagnostic evidence;
- fault-filter state.

Payload status is diagnostic only and does not override backend classification.
