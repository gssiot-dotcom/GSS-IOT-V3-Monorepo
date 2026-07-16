# Phase 6 Monitoring and Realtime

## Scope

Phase 6 implements monitoring history and realtime state only:

- `SensorReading` immutable history rows.
- `LatestNodeState` one current-state row per node.
- MQTT sensor ingestion for `door_node`, `angle_node` and canonical `gangform_node`.
- Monitoring HTTP endpoints with backend permission and scope checks.
- Socket.IO monitoring rooms authorized on every join.
- Company monitoring UI through the three preserved legacy node-type cards.

Alarm thresholds, occurrence counting, notifications, providers, reports, partitioning and archival are deferred to later phases.

## MQTT sensor topics

The API subscribes to these legacy sensor topic filters using `MQTT_TOPIC_BASE`:

```txt
{MQTT_TOPIC_BASE}/GATE_PUB/+   -> door_node
{MQTT_TOPIC_BASE}/GATE_ANG/+   -> angle_node
{MQTT_TOPIC_BASE}/GATE_FORM/+  -> gangform_node
```

The final topic segment identifies the gateway. The `GRM22JU22P` prefix is stripped when present, and gateway lookup also supports matching saved serial numbers that end with the parsed token.

## Payload normalization

Door payload:

```json
{
  "doorNum": "D-001",
  "doorChk": 0,
  "betChk": 92,
  "msgId": "optional-message-id"
}
```

Normalized values:

```json
{
  "doorState": "closed",
  "batteryLevel": 92
}
```

`doorChk: 1` maps to monitoring status `danger`; every other valid door state maps to `safe`.

Angle and gangform payload:

```json
{
  "doorNum": "A-001",
  "angle_x": 1.25,
  "angle_y": -0.5,
  "nodeType": 1
}
```

Normalized values:

```json
{
  "angleX": 1.25,
  "angleY": -0.5
}
```

`vertical`, `vertical_node`, `gangform` and numeric node type `2` normalize to `gangform_node`. Phase 6 does not evaluate alarm thresholds, so angle and gangform readings default to `safe` unless the payload already contains a normalized monitoring status.

## Assignment validation

Before persistence, MQTT ingestion resolves:

```txt
active gateway
active gateway-company assignment
active gateway-building assignment
active node
matching canonical node type
active node-gateway assignment
active node-company assignment
same company across gateway, node and building
```

Unknown, inactive, unassigned or mismatched devices are safely logged and ignored.

## Deduplication strategy

Dedupe key precedence:

1. MQTT packet message id from the broker packet metadata.
2. Gateway payload `messageId`, `msgId`, `id` or `packetId`.
3. Gateway payload `sequenceNumber`, `sequence` or `seq`.
4. Payload measured time plus normalized value hash.
5. If the legacy payload has no reliable packet/message/sequence/measured-time key, the API stores the reading with a unique received-time key.

The final fallback intentionally preserves no-ID/no-time readings rather than discarding a legitimate later reading that has the same sensor value. Gateway retries should include packet metadata, a gateway id/sequence, or a measured time to dedupe deterministically.

## HTTP endpoints

GSS Admin:

```txt
GET /admin/monitoring/buildings/:buildingId
GET /admin/monitoring/buildings/:buildingId/node-types/:nodeType
GET /admin/monitoring/buildings/:buildingId/node-types/:nodeType/nodes/:nodeId/history
```

Company:

```txt
GET /company/buildings/:buildingId/monitoring
GET /company/buildings/:buildingId/monitoring/:nodeType
GET /company/buildings/:buildingId/monitoring/:nodeType/nodes/:nodeId/history
```

All endpoints require `monitoring.view`. Company endpoints also require valid company and building scope. Results are limited to nodes connected through gateways actively assigned to the requested building.

History query:

```txt
page      default 1, min 1
pageSize  default 25, min 1, max 100
```

Ordering is deterministic: newest `receivedAt` first, then `id`.

## Socket.IO rooms and events

Clients request a join with:

```txt
event: monitoring:join
body:  { buildingId, nodeType }
```

The server authenticates the socket token, checks `monitoring.realtime`, validates company building scope when applicable, resolves the canonical node type, and creates the room name itself:

```txt
monitoring:building:{buildingId}:node-type:{nodeType}
```

Clients never provide raw room names. Unauthorized joins return `{ ok: false }`.

After a `SensorReading` insert and `LatestNodeState` upsert succeed, the server emits:

```txt
event: monitoring:node-state
body:  { buildingId, nodeType, state }
```

The frontend keeps the last known value visible when the socket disconnects and shows connected, reconnecting or offline state.

## Retention

Phase 6 defines a default sensor history retention target of 180 days and adds indexes for node/time and building/node-type/time queries. Phase 10 will decide production partitioning, archival and physical purge jobs.
