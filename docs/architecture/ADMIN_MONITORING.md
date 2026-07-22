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
