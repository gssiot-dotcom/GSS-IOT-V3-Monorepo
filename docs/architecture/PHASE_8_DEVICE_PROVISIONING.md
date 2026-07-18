# Phase 8 — Device provisioning and MQTT-backed node assignment

## Scope

Phase 8 makes node-to-gateway assignment physical-state driven. GSS Admin users create a `REGISTER_NODES` GatewayCommand (`cmd: 2`) from selected company, building, gateway, node type and node IDs. The database does not create an active `NodeGatewayAssignment` until the gateway returns a strictly successful acknowledgement.

Alarm levels, fault filters, alarm classification, alarm occurrence counting, notifications and reports remain out of scope for later phases.

## Data model

`GatewayCommand` remains the outbox and lifecycle source for `pending | sent | acknowledged | failed | expired | cancelled`.

Phase 8 adds:

- `NodeGatewayProvisioningRequest`: one row per register-nodes command, linked by `commandId`, with requested company, building, gateway, node type, status, response payload and failure reason.
- `NodeGatewayProvisioningItem`: one row per requested node ID, linked to the provisioning request and, after successful acknowledgement, to the applied assignment.
- `NodeGatewayAssignment.sourceCommandId`: nullable provenance for assignments created by cmd 2.

Selected node IDs are relational state, not only JSON command payload.

## Lifecycle

1. Admin selects company, building, an actively assigned gateway, one node type and eligible unassigned company-owned nodes.
2. Backend validates gateway-company, gateway-building, node company ownership, node type and active assignment state.
3. Backend normalizes selected node numbers to safe JSON integers for the MQTT wire payload and rejects empty, non-numeric, unsafe, negative or numerically duplicated values before command persistence.
4. Backend creates a durable `GatewayCommand` first, then writes the final outbound MQTT payload with `requestId` equal to that `GatewayCommand.id`.
5. If MQTT publish is skipped because the gateway/broker is offline, the command and request remain `PENDING`.
6. Before publish, the backend records a publish attempt while the command is still `PENDING`; this makes a fast requestId response eligible without marking the command `SENT` too early.
7. If published, command and request become `SENT` only through a conditional update that cannot overwrite a concurrent `ACKNOWLEDGED` or `FAILED` response.
8. A strict successful response updates the command to `ACKNOWLEDGED` and creates active `NodeGatewayAssignment` rows in the same transaction.
9. Negative responses update command and request to `FAILED` and preserve the raw response payload.
10. Expiry and cancellation do not create assignments. Late acknowledgements after terminal states are ignored because only active eligible commands are matched.
11. Duplicate acknowledgements are idempotent because terminal commands cannot be updated back to non-terminal status and active assignment uniqueness remains enforced.

## Deterministic requestId correlation

The NestJS backend owns MQTT command correlation. For `cmd: 2`, `cmd: 3`, `cmd: 4` and `cmd: 5`, it creates the `GatewayCommand` row before publish, then stores and publishes a final payload with:

```json
{ "cmd": 2, "requestId": "<GatewayCommand.id>" }
```

The request id is stable for retries because the same `GatewayCommand.id` and stored payload are reused. The publisher records an attempt before sending and uses conditional `PENDING -> SENT` updates after publish so a fast gateway response can acknowledge or fail an in-flight `PENDING` command without being overwritten.

Gateway response correlation order:

1. Exact `requestId`: find the command by id, then verify gateway serial, `cmd`, active eligibility and command-specific fields. Unknown, malformed, wrong-gateway or wrong-cmd request IDs do not fall back to legacy gateway/cmd matching.
2. Legacy no-requestId response: match by gateway serial plus explicit `cmd` only when exactly one eligible active command exists.
3. No response is inferred from `resp` alone. Malformed JSON or a response without integer `cmd` is ignored.

For `cmd: 2` successful responses, the response gateway/cmd plus `nodeType`, `numNodes` and `nodes` must match the stored command payload. Node order may differ, but missing/additional nodes are rejected and no assignment is applied. Exact requestId mismatches fail the command; ambiguous legacy mismatches leave commands unchanged.

## Legacy MQTT node-number wire format

Node numbers remain strings in the database/domain model, but `cmd: 2` register-node and `cmd: 5` fault-filter MQTT payloads publish node arrays as JSON numbers for legacy gateway compatibility.

Example `cmd: 2` payload:

```json
{
  "cmd": 2,
  "requestId": "<GatewayCommand.id>",
  "nodeType": 2,
  "numNodes": 3,
  "nodes": [100, 101, 102]
}
```

The MQTT adapter rejects a command before `GatewayCommand` persistence or publish if any selected node number is empty, non-numeric, not a JavaScript safe integer, negative or becomes duplicated after numeric normalization, such as `0100` and `100`.

## Live hardware verification

Phase 8 closure uses a recorded selected live-test gateway for the verification run. The selected gateway serial is evidence, not a permanent architecture constant.

The completed 2026-07-18 live ESP32 verification used selected gateway `0300` and GatewayCommand `160b3e5c-139d-479b-8535-a82f25f95b02`. The stored and published `cmd=2` payload was:

```json
{
  "cmd": 2,
  "nodes": [100, 101, 102],
  "nodeType": 2,
  "numNodes": 3,
  "requestId": "160b3e5c-139d-479b-8535-a82f25f95b02"
}
```

The gateway ACK payload was:

```json
{
  "cmd": 2,
  "resp": "success",
  "nodes": [100, 101, 102],
  "nodeType": 2,
  "numNodes": 3,
  "requestId": "160b3e5c-139d-479b-8535-a82f25f95b02"
}
```

Database and protected Admin API verification confirmed the command is `ACKNOWLEDGED`, belongs to gateway `0300`, and the ACK correlates by exact requestId. Nodes `100`, `101` and `102` each have exactly one active `NodeGatewayAssignment`; all assignments point to gateway `0300`; every `sourceCommandId` equals `160b3e5c-139d-479b-8535-a82f25f95b02`; duplicate active assignment groups equal `0`; and audit side effects remain idempotent with one command acknowledgement audit and one provisioning-apply audit.

## Strict acknowledgement parsing

The parser no longer treats missing `error` as success.

Accepted success values:

- `success: true`
- `ok: true`
- `ack: true`
- `resp | result | status: "success" | "ok" | "ack" | "acknowledged" | "true"`

Accepted failure values:

- `success | ok | ack: false`
- `resp | result | status: "fail" | "failed" | "failure" | "error" | "nack" | "ng" | "false"`
- non-empty `error`
- no accepted success value in an otherwise parseable response

Malformed JSON or a response without integer `cmd` is ignored and never acknowledges a command.

## Topic and serial matching

Publish topics keep the existing Phase 5 form:

```txt
{MQTT_TOPIC_BASE}/GATE_SUB/GRM22JU22P{gatewaySerial}
```

Response topics are parsed from:

```txt
{MQTT_TOPIC_BASE}/GATE_RES/{gatewaySerial}
{MQTT_TOPIC_BASE}/GATE_RES/GRM22JU22P{gatewaySerial}
```

Acknowledgement matching prefers exact `requestId` when present. Legacy responses without `requestId` use gateway serial plus command number. The saved serial is matched by exact value or suffix, preserving the Phase 6 documented behavior for gateways whose legacy response topic contains only the trailing identifier.

## MQTT observability

Phase 8 includes production-safe MQTT runtime observability:

- `MqttClientService` logs disabled mode, redacted broker connection attempts, connection lifecycle, successful topic-filter subscriptions, outbound publish success/failure and normalized gateway responses.
- Publish logs include command id when available, gateway serial, topic, command number and JSON payload byte size. They do not log MQTT username, password or provider secrets.
- Gateway response logs include topic, parsed gateway serial, command number, requestId when present, normalized success/failure, matched command id, correlation mode and unmatched/ambiguous reason after outbox lookup.
- Raw `GATE_RES` payload content is logged at debug level before response normalization with secret-like keys redacted.
- Malformed `GATE_PUB`/`GATE_ANG`/`GATE_FORM` sensor payload content is logged at debug level with secret-like keys redacted; the normal warning remains concise.
- GSS Admin `GET /admin/gateway-commands/mqtt-status` is protected by `mqtt-commands.view` and returns only sanitized runtime state: enabled, connected, broker host, client id, subscribed topic filters, last connected/message/publish timestamps and last error.
- MQTT username and password are never returned by the status API and are not rendered in the Admin UI.

## Unassign decision

No confirmed hardware unregister/remove command exists for Phase 8. The Admin UI therefore exposes node-gateway unassign as DB assignment history only. It does not claim to modify physical gateway state. A future full replacement/sync command requires protocol confirmation before implementation.
