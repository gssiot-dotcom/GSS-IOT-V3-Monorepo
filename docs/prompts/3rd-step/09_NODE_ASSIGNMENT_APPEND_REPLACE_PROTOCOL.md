# CODEX TASK 09 — Hardware-safe APPEND versus REPLACE node provisioning

Complete Tasks 02–08 first.

Read and preserve:

```txt
docs/architecture/PHASE_8_DEVICE_PROVISIONING.md
docs/prompts/2nd-step/03_PHASE_8_MQTT_PROTOCOL_BASELINE.md
apps/api/src/modules/gateway-commands/*
apps/api/test/e2e/*provision* or relevant gateway-command/device tests
```

## Goal

Implement user Requirement 8 without regressing strict Phase 8 requestId/ACK behavior.

## Hardware fact — authoritative requirement

For cmd 2, ESP32 replaces its remembered node list for the selected node type with the entire `nodes` array in the MQTT payload.

Therefore every provisioning request must explicitly choose:

```txt
APPEND
REPLACE
```

### APPEND semantics

- User selects only the new nodes to add.
- Backend loads currently active node assignments for the target gateway and selected node type.
- Final effective set = current active same-type nodes UNION newly selected nodes.
- MQTT cmd 2 payload contains the entire final effective set.
- Existing assignments remain active after ACK.
- New assignments are created only after strict successful ACK.

### REPLACE semantics

- User selects the complete final desired set.
- MQTT cmd 2 payload contains exactly that selected final set.
- On strict successful ACK, active same-gateway/same-node-type assignments not in the final set are ended, and selected assignments are retained/created.
- No DB assignment is changed before ACK.

Keep at least one selected node unless the firmware's empty-list clear behavior is explicitly documented and tested. Do not invent empty-clear support.

## Protocol and concurrency invariants

- `GatewayCommand.id` remains `requestId` in the stored and published payload.
- Retry reuses the same command ID/requestId and exact final payload.
- Unknown/wrong gateway/wrong cmd/malformed requestId never falls back.
- Legacy no-requestId fallback remains only as already approved.
- Fast ACK race protection remains.
- Negative/malformed/no-success ACK, failed, expired, cancelled, duplicate or late responses cause no false assignment change.
- Prevent conflicting nonterminal REGISTER_NODES commands for the same gateway + node type, or implement an equally safe monotonic sequencing strategy. The simplest approved default is a clear `409 Conflict` until the prior command reaches a terminal state.
- Numeric payload validation and duplicate detection remain strict.

## Data model and audit trail

Add an additive migration if needed so the provisioning request records:

- mode (`APPEND`/`REPLACE`);
- explicitly selected/requested node set;
- final effective payload node set;
- applied/ended assignments;
- request/command correlation;
- failure reason and response evidence.

Do not rely only on opaque JSON for business-critical requested/final membership. Use relational rows or clearly typed durable fields consistent with the current schema.

A practical model may mark provisioning items as selected versus carried-forward, but choose the cleanest relational design after inspecting current data.

Audit at least:

- request creation with mode and selected/final counts;
- successful ACK application;
- assignments created/retained/ended;
- conflicts/failures through normal command/audit behavior.

## Validation

For both modes:

- gateway must be actively assigned to the selected company/building;
- nodes must belong to that company;
- nodes must match selected NodeType;
- no selected node may be actively assigned to another gateway;
- nodes already assigned to the target gateway are valid final-set members;
- APPEND must not remove current nodes;
- REPLACE may remove only current assignments for that target gateway and selected node type;
- other node types on the gateway are untouched.

## API/UI

Extend the register-nodes DTO/contract with explicit mode.

In Admin device provisioning UI:

- require an explicit mode selector with clear localized explanation;
- show current nodes on the gateway for the selected type;
- APPEND selector focuses on eligible new nodes and previews the final combined payload;
- REPLACE selector represents the complete final set and warns which current nodes will be removed after ACK;
- show selected count, existing count and final payload count;
- never describe DB assignment as complete while command is PENDING/SENT;
- link/show command lifecycle and final ACK result;
- preserve company/building/gateway prerequisites.

## ACK application

Apply assignment changes in one transaction only after exact successful ACK:

### APPEND

- keep existing active same-type assignments;
- create missing final assignments with `sourceCommandId`;
- retain idempotency on duplicate ACK.

### REPLACE

- retain selected active assignments;
- create selected missing assignments;
- end active same-gateway/same-type assignments excluded from final set;
- preserve full history (`endedAt`, status and source/audit evidence);
- duplicate ACK changes nothing a second time.

## Required tests

Add exhaustive unit/E2E coverage:

1. APPEND with 3 existing + 2 new publishes all 5 numeric nodes.
2. APPEND ACK creates only the 2 missing assignments and retains 3.
3. APPEND failure/expiry/cancel leaves DB assignments unchanged.
4. REPLACE with 3 existing and 2 selected publishes exactly the 2 selected.
5. REPLACE ACK retains/creates selected and ends excluded same-type assignments.
6. REPLACE does not touch another node type.
7. Node assigned to another gateway is rejected.
8. Concurrent nonterminal same gateway/type request is rejected safely.
9. Retry payload/requestId is unchanged.
10. Duplicate/late/malformed/negative ACK has no duplicate or false side effect.
11. Fast ACK remains safe.
12. Audit/provisioning evidence is correct.
13. Frontend mode explanations and preview are correct.
14. Existing Phase 8, Phase 9 command and alarm regression tests pass.

Run Prisma generate/migration checks, focused command/device tests, full API E2E, web tests, typecheck, lint, format, build and diff check.

## Manual hardware-ready acceptance

Create a manual checklist for future live ESP32 verification, but do not claim live hardware passed unless actually executed. Include:

- inspect published APPEND full union payload;
- inspect published REPLACE exact payload;
- verify gateway memory after each;
- verify DB changes only after matching ACK.

## Out of scope

- Phase 14 deployment;
- changing cmd number/topic;
- raw DB-only assignment UI;
- empty payload clear unless separately approved.

## Definition of Done

- APPEND and REPLACE semantics are explicit, durable and audited.
- Payload always matches ESP32 replacement behavior.
- DB assignment history changes only on strict successful ACK.
- Phase 8 protocol invariants and all regressions remain green.
