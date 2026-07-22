# Bulk node creation

## Contract

GSS Admin users with `nodes.create` can call
`POST /admin/devices/nodes/bulk` with:

```json
{
  "input": "100-103, 110, 120-122",
  "nodeTypeId": "<node-type-id>",
  "installedLocation": "optional shared location"
}
```

The shared parser accepts a single positive value, an inclusive range,
comma-separated values, or mixed segments. Whitespace is trimmed. Numeric
strings are canonicalized to decimal storage (`001` becomes `1`) and duplicate
input values are emitted once. Malformed, non-positive, descending, unsafe or
over-maximum input is rejected. The maximum batch size is 1,000 unique node
numbers.

## Atomic behavior

The API validates the complete request and selected NodeType before opening the
creation transaction. Existing inventory is compared by canonical numeric value,
so an existing `001` also blocks a requested `1`. Conflicts return `409`
`NODE_NUMBER_CONFLICT` with the canonical conflict list. Invalid input returns
`400` `INVALID_NODE_NUMBER_INPUT`. No node rows are created on either failure.

Successful batches create all nodes in one transaction and return the created
summaries, count and canonical numbers. One `node.bulk_create` audit record
contains the created IDs and numbers without sensitive data. Created nodes are
not assigned to a gateway; physical provisioning remains the existing MQTT
requestId/ACK flow.

## UI behavior

The Admin device dialog uses a Mantine textarea with localized examples, live
count, preview badges, invalid-segment feedback, selected NodeType and shared
installed location. The input resets only after a successful batch. The existing
single-node edit path remains a separate update operation, and the create action
is hidden when `nodes.create` is not effective.

No schema migration, seed change, arbitrary CSV import or gateway assignment is
introduced by this task.
