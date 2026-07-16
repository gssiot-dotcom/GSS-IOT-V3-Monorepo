# CODEX PROMPT - Phase 9: Alarm levels, fault filters and authoritative sensor classification

Read `AGENTS.md` first, then completed Phase 7-8 docs and code.

Also read:

- latest approved alarm occurrence-count blueprint;
- legacy BuildingAlarmLevel/GatewayAlarmSetting and cmd 4/cmd 5 behavior;
- current monitoring parser and persistence flow;
- current gateway command outbox.

Confirm Phase 8 is complete. Start only Phase 9.

## Goal

Implement persisted alarm-level and fault-filter configuration, apply it to gateways through the existing outbox, and make backend classification authoritative for door/angle/gangform readings.

This phase does not yet create occurrence-count alarm events or send notifications.

## Required domain behavior

### Alarm levels

Support three severities:

```txt
safe
caution
warning
danger
```

Create clean Prisma models for building/node-type alarm configuration and, where needed, per-gateway desired/applied state.

The design must distinguish:

- desired configuration saved by an authorized user;
- GatewayCommand(s) generated for assigned gateways;
- applied/acknowledged state per gateway;
- pending/failed/expired state;
- last applied payload/command;
- updatedBy actor and audit history.

Default scope should be building + node type. Gateway override is allowed only if architecture docs explicitly approve it.

### Fault filters

Persist fault-filter node selection by gateway + node type + node. Do not rely only on command payload history.

Track desired and applied state. Use cmd 5 through GatewayCommand outbox.

### Building orchestration

When a building alarm level is saved:

1. validate permission and company/building scope;
2. save desired config;
3. find all active gateways assigned to that building;
4. create a cmd 4 command per gateway;
5. publish immediately when online or remain pending when offline;
6. update applied state only after strict ACK success;
7. expose per-gateway status to UI.

Do the equivalent for fault filters where appropriate.

## Authoritative classification

Current angle/gangform parser defaults to SAFE when payload status is missing. Replace that as the source of truth.

- Door: `doorChk` closed/open classification remains deterministic.
- Angle/gangform: classify from persisted alarm levels using the approved metric, expected to be based on absolute X/Y deviation and highest matching severity.
- Confirm whether calibration offsets are required. If current approved architecture has no calibration model, record a decision and use the documented raw/normalized metric.
- A payload-provided status may be saved as diagnostic raw data, but must not override backend thresholds unless explicitly documented.
- If no active alarm configuration exists, return an explicit unconfigured state or documented safe fallback; do not silently hide missing configuration.

Store classification evidence needed by the next phase:

- metric used;
- normalized values;
- matched threshold/config version;
- resulting status.

Use a compatible schema approach without bloating LatestNodeState.

## APIs

Implement permission and scope protected endpoints for both GSS and Company contexts:

- view building alarm levels;
- update building alarm levels;
- inspect gateway application status;
- view/update fault filters;
- retry failed configuration commands where authorized.

Use existing permission keys or add approved keys consistently:

- `alarm-levels.view`
- `alarm-levels.manage`
- `nodes.configure`

## UI

Add usable pages/components from building monitoring/detail:

- alarm level form per node type;
- caution/warning/danger validation and ordering;
- enable/disable state;
- save confirmation;
- list of building gateways and pending/applied/failed result;
- fault-filter node selection;
- retry failed command;
- permission-aware actions.

Do not use raw IDs.

## Tests

Add unit and E2E tests for:

- valid/invalid threshold ordering;
- angle X/Y boundary classification;
- gangform boundary classification;
- door classification;
- payload without status still classified correctly;
- building scope enforcement;
- cmd 4 fan-out to all active building gateways;
- offline gateway remains pending;
- ACK updates applied state;
- negative/timeout preserves desired but not applied state;
- cmd 5 fault-filter desired/applied state;
- filtered node behavior is explicitly defined and tested;
- audit log creation.

## Out of scope

- No occurrence counters.
- No AlarmEvent, recipient resolution or notifications.
- No alarm list/ack/resolve UI.
- Do not start Phase 10.

## Definition of Done

- Alarm levels and fault filters are real persisted business configuration.
- Gateway commands are derived from desired configuration and tracked per gateway.
- Angle/gangform status is backend-classified from configuration.
- Monitoring history/latest show correct statuses.
- UI can configure and inspect results without raw IDs.
- All tests and docs pass.
