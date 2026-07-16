# CODEX PROMPT - Phase 8: Device provisioning and MQTT-backed node assignment

Read `AGENTS.md` first.

Then read the completed Phase 7 docs and code, plus:

- current Prisma device assignment models
- `apps/api/src/modules/devices/**`
- `apps/api/src/modules/gateway-commands/**`
- `apps/api/src/modules/mqtt/**`
- device and gateway-command E2E tests
- legacy cmd 2 registration behavior only as a business reference

Confirm Phase 7 is complete. Start only Phase 8.

## Goal

Make device provisioning a coherent physical + database workflow. A node must not become actively assigned to a gateway merely because a DB endpoint was called. The active assignment must reflect a successful MQTT register-nodes command response.

## Confirmed current gap

- `DevicesService.assignNodeToGateway()` immediately creates `NodeGatewayAssignment`.
- `createRegisterNodesCommand()` creates cmd 2, but ACK does not create the assignment.
- UI uses raw UUID text fields and the node-to-gateway button only calls the DB assignment endpoint.

This can produce DB/physical gateway divergence.

## Required business workflow

```txt
Select company
-> select building
-> select a gateway assigned to that company/building
-> select one node type
-> select eligible company-owned unassigned nodes
-> create durable REGISTER_NODES GatewayCommand (cmd 2)
-> pending/sent while offline or publishing
-> strict ACK success
-> atomically activate NodeGatewayAssignment history
-> UI shows completed assignment
```

Failure, timeout, cancel or negative response must not create a false active assignment.

## Data model design

Implement the minimum auditable link between command intent and assignment result. Choose a clean relational design and document it. Acceptable patterns include:

- `GatewayCommand` relation to a provisioning request containing selected node IDs, or
- a `NodeGatewayProvisioning` / `DeviceProvisioningRequest` aggregate with command relation and per-node items.

The design must support:

- multiple nodes of the same type in one cmd 2;
- pending/sent/acknowledged/failed/expired/cancelled state;
- idempotent ACK handling;
- no duplicate active assignment;
- audit of requested vs applied nodes;
- retry without duplicate assignment rows;
- offline gateway outbox behavior;
- moving a node from one gateway only through an explicit safe workflow.

Do not use a JSON payload as the only source of truth for selected database node IDs.

## MQTT response compatibility

- Inspect real legacy `GATE_RES` payload examples/docs.
- Replace permissive success logic such as `error === undefined` with strict normalized success/failure parsing.
- Explicitly support known legacy fields such as `success`, `result`, `status`, `ack`, `resp` only when their accepted values are documented.
- Negative and malformed responses must never acknowledge a command.
- Verify gateway serial extraction and full-serial vs last-four matching. Document the decision and add tests.

## Gateway and node assignment UI

Replace raw UUID inputs with guided selectors:

- Company selector.
- Site/building selector filtered by company.
- Gateway selector filtered by active company/building assignment.
- Node-type selector.
- Multi-select of eligible nodes filtered by company, type and current assignment.

Show:

- current company/building/gateway assignment;
- pending provisioning state;
- command status and timestamps;
- response/failure reason;
- retry/cancel when allowed;
- assignment history.

Add proper loading, empty, validation and error states.

## Gateway -> company/building UX

Keep the existing history-based backend rules, but complete the UI:

- no raw IDs;
- assign, move and unassign actions;
- validate company consistency;
- show active assignment and history;
- do not allow building assignment before company assignment.

## Unassign decision

Do not invent an unsupported MQTT unregistration command. If real hardware has no unassign/remove command:

- document that DB unassign does not modify gateway hardware, or
- implement a full replacement/sync command only if confirmed by legacy protocol docs.

Record this in `DECISION_LOG.md`.

## Permissions

Use existing permission intent:

- `gateways.assign`
- `nodes.assign`
- `devices.assign`
- `mqtt-commands.view`
- `mqtt-commands.manage`

Backend authorization remains required for every mutation.

## Tests

Add E2E coverage for:

1. Successful cmd 2 ACK creates active NodeGatewayAssignment.
2. Pending/offline command does not create active assignment before ACK.
3. Negative response does not create assignment.
4. Timeout/expired/cancelled command does not create assignment.
5. Duplicate ACK is idempotent.
6. Retry cannot create duplicate assignment.
7. Cross-company gateway/node selection is rejected.
8. Mixed node types in one command are rejected.
9. Already-assigned nodes are rejected or moved only through approved flow.
10. Super admin and normal permission behavior.
11. UI selector filtering and command status rendering.

## Out of scope

- Alarm level/fault filter domain settings belong to Phase 9.
- Do not implement alarm occurrence counters, notifications or reports.
- Do not start Phase 9.

## Definition of Done

- There is one authoritative, auditable physical provisioning workflow.
- ACK success and active DB assignment cannot diverge under normal flow.
- UI requires no pasted UUIDs.
- Gateway/company/building and node/company/gateway assignment UX is usable.
- Strict legacy response parsing is covered by tests.
- Existing Phase 1-7 behavior remains green.

## Required verification

Run all standard checks plus Prisma migration/generate/seed and E2E tests.

At the end report exact schema changes, state machine, ACK mapping, UI flow, tests and remaining hardware protocol decisions.
