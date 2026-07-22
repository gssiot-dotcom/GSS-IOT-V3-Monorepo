# Device inventory lifecycle and deletion

## Scope

Task 07 adds explicit edit and hard-delete behavior to the existing GSS Admin
device inventory. The backend remains authoritative; frontend permission checks
and deletion capability fields are UX hints only.

## Edit and delete authorization

Gateway edits require `gateways.update`; node edits require `nodes.update`.
Gateway deletion requires `gateways.delete`; node deletion requires
`nodes.delete`. Assignment and MQTT provisioning actions retain their existing
permission guards and scope checks. No raw UUID-only node-to-gateway assignment
control is introduced.

## Pristine-only hard delete

`GET /admin/devices/gateways` and `GET /admin/devices/nodes` return a
server-derived `deletion: { allowed, blocker }` capability. A device is
deletable only when every relevant assignment, provisioning, command,
monitoring, alarm, sensor and fault-filter relation is empty. Ended assignment
rows count as history and still block deletion.

`DELETE /admin/devices/gateways/:gatewayId` and
`DELETE /admin/devices/nodes/:nodeId` repeat the blocker check inside a database
transaction. Historical devices return a structured `409` with
`code=DEVICE_HISTORY_EXISTS` and `lifecycle=INACTIVE_OR_RETIRED`; no cascade or
history erasure is used. Successful deletes create audit rows.

No schema migration, seed change or lifecycle redesign is required for this
task. Devices with business history must use the existing inactive/retired
lifecycle path when that workflow is introduced.
