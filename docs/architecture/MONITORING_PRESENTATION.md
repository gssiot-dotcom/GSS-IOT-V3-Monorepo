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
