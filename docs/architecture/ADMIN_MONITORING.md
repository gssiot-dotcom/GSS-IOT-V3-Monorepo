# GSS Admin monitoring workspace

The Admin monitoring landing page uses global GSS context and is guarded by
`monitoring.view`. It does not apply Company user building-scope guards. The
backend returns bounded selector data and aggregate read models for companies,
sites, buildings, latest severity, gateway freshness and recently updated
nodes; detailed building/node-type/history endpoints remain the existing
permission-guarded monitoring endpoints.

The frontend cascades company → site → building selection, shows operational
summary cards and severity counts, preserves the legacy node-type image cards,
and reuses the Company monitoring `TABLE`/`CARD`, node-state card and detail
drawer components. Admin realtime joins only the selected building/node-type
room and cleans up the socket when the selection changes. Raw MQTT payloads and
credentials are not exposed.

No schema migration is required. Five-minute gateway freshness matches the
existing dashboard device-summary convention for stale reporting. Long-term
telemetry retention remains deferred.

Node liveness is now represented by persisted `LatestNodeState.status`, not by a browser-only age
guess. An accepted unique reading sets `lastSeenAt`; at an exact five-minute age the bounded backend
evaluator conditionally changes an otherwise eligible state to `OFFLINE` while retaining the last
telemetry and evidence. The Admin severity distribution, building offline count, monitoring detail
and dashboard summary therefore read the same database truth. Live node-state events update the
selected state and summary counters, and a successful realtime rejoin refetches both detail and
summary read models before continuing.
