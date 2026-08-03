# Company monitoring presentation

Task 10 keeps the existing scoped monitoring APIs, Socket.IO room and
alarm-level/fault-filter panels, and adds a reusable presentation layer for
Company node-type monitoring.

## Views and detail

The latest-state panel supports a locally persisted `TABLE`/`CARD` preference.
Both views consume the same `MonitoringNodeStateRecord` array, so realtime
upserts update the visible representation without a second subscription or
per-card polling. Cards are keyboard-accessible and expose status text, not
color alone.

Door cards show open/closed, battery, gateway and value age. Angle and
gangform cards show X/Y values and a semantic accessible T-shaped status
indicator. Offline, unconfigured and fault-filtered evidence remains visible.

Selecting a row action or card opens a bounded detail drawer. History is
requested only for the selected node through the existing page-1/page-size-25
endpoint. The drawer renders an SVG history chart and recent readings with
door/battery or angle X/Y data and configured threshold reference guidance.
The fault-filter control remains in its existing dedicated tab and is
intentionally absent from the detail drawer.

No API or schema migration is required. The existing backend permission and
building-scope guards remain authoritative, and production telemetry
retention remains deferred.

## Accepted-reading heartbeat and derived offline presentation

Every accepted, unique and valid sensor reading is also the Node heartbeat. Its backend
`receivedAt` becomes `LatestNodeState.lastSeenAt`; duplicate MQTT deliveries and malformed or
rejected payloads do not refresh liveness. An operationally eligible Node whose last accepted
reading is exactly five minutes old or older transitions to `OFFLINE` during the bounded evaluator
sweep. The transition updates only `status` and `updatedAt`: the last values, classification
evidence, fault-filter evidence and `lastSeenAt` remain visible as historical context.

The existing `monitoring:node-state` event carries the derived offline state only after a
conditional database update wins. A new accepted reading immediately upserts the classified
non-offline state and emits through the same room. Admin and Company clients reject out-of-order
events and refetch current read models after a successful Socket.IO rejoin, so reconnects cannot
leave stale offline UI behind. The Node card disconnected icon follows the persisted status, while
generic inventory connectivity uses the same exact five-minute freshness boundary.
