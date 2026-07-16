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
3. Backend creates a durable `GatewayCommand` and `NodeGatewayProvisioningRequest` in one transaction.
4. If MQTT publish is skipped because the gateway/broker is offline, the command and request remain `PENDING`.
5. If published, command and request become `SENT`.
6. A strict successful response updates the command to `ACKNOWLEDGED` and creates active `NodeGatewayAssignment` rows in the same transaction.
7. Negative responses update command and request to `FAILED` and preserve the raw response payload.
8. Expiry and cancellation do not create assignments. Late acknowledgements after terminal states are ignored because only active `SENT` commands are matched.
9. Duplicate acknowledgements are idempotent because terminal commands no longer match the active `SENT` query and active assignment uniqueness remains enforced.

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

Acknowledgement matching uses gateway serial plus command number. The saved serial is matched by exact value or suffix, preserving the Phase 6 documented behavior for gateways whose legacy response topic contains only the trailing identifier.

## Unassign decision

No confirmed hardware unregister/remove command exists for Phase 8. The Admin UI therefore exposes node-gateway unassign as DB assignment history only. It does not claim to modify physical gateway state. A future full replacement/sync command requires protocol confirmation before implementation.
