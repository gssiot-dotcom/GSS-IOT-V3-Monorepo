# Node provisioning APPEND/REPLACE protocol

## Scope

The Admin node provisioning form submits an explicit `mode` with every
`REGISTER_NODES` request. The mode is persisted with the durable
`NodeGatewayProvisioningRequest` and is never inferred from the selected UI
values.

- `APPEND` keeps the gateway's currently active assignments for the selected
  node type and unions them with the selected unassigned nodes.
- `REPLACE` treats the selected nodes as the complete final membership for the
  gateway and node type. Existing active assignments omitted from the final
  set are ended only after a successful strict ACK.
- An empty requested selection is rejected. Clearing a membership is not an
  implicit side effect of an empty command.

Each provisioning item records whether the node was selected by the caller;
the request's item set records the final command membership. Successful ACK
application records created and retained assignments in the existing
assignment history and records every REPLACE removal in
`NodeGatewayProvisioningEndedAssignment`. All request and application changes
are audited in the same transaction as the state transition.

## Safety and retry behavior

The API validates company, building, node type, active company assignment and
cross-gateway conflicts before creating the outbox command. A PostgreSQL
transaction advisory lock serializes nonterminal provisioning requests for the
same gateway and node type; a second `PENDING` or `SENT` request receives a
conflict response. The command payload remains the existing cmd 2 shape and
keeps the same `GatewayCommand.id` as `requestId` across retries.

Only an exact successful ACK can apply the durable assignment changes.
Malformed, negative, wrong, duplicate and late responses remain side-effect
free through the existing requestId/ACK correlation and idempotency guards.

## Migration notes

Task 09 adds `ProvisioningMode`, the persisted request mode and selected item
flag, replacement history, and a follow-up additive migration that removes
the obsolete one-to-one `assignmentId` index so an assignment retained across
multiple provisioning requests can be referenced by each request item. No
seed change is required. Rollback must be planned as a deployment migration;
the replacement-history table and mode columns must not be removed while
request or audit history depends on them.
