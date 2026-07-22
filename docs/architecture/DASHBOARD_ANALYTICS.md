# Dashboard analytics contract

Task 05 adds bounded, permission-aware operational summaries at:

```txt
GET /admin/dashboard/summary?range=7d|30d|90d
GET /company/dashboard/summary?range=7d|30d|90d
```

Both routes require `dashboard.view`. The API resolves the Company user's effective building/site scope from the authenticated principal; no company or resource identifier is accepted from the dashboard request. Admin aggregates are global only for sections the principal can view.

## Metric definitions

- `activeCompanies`, `activeSites`, and `activeBuildings` count active organization rows. Company users receive only active sites/buildings represented by their effective scope.
- `gateways` and `nodes` count devices visible to the principal through active company or building assignment. `online` means a gateway has a `lastSeenAt` within five minutes of query time; null or older gateways are `offline`.
- `unassigned` counts visible gateways/nodes with neither an active company assignment nor an active building/gateway assignment.
- `nodesByLifecycle` groups visible nodes by the persisted lifecycle status (`ACTIVE`, `INACTIVE`, `RETIRED`).
- `severityDistribution` groups the latest persisted node state by the canonical monitoring status. It is not inferred from raw readings.
- `openAlarmsBySeverity` counts `OPEN` and `ACKNOWLEDGED` alarm episodes only; resolved episodes are excluded.
- `telemetryReadings` counts unique `SensorReading` rows received in the selected UTC range. The trend uses a bounded 10,000-row timestamp sample for charting and never loads unbounded raw history.
- `commandStatus` and `recentCommandFailures` are returned only to GSS Admin principals with `mqtt-commands.view` and are limited to the selected range/five recent failures.

Sections whose permissions are absent are omitted from the response, so counts cannot be used as an authorization side channel. Existing report-job summaries remain a separate lower-priority dashboard section and preserve their existing `reports.view` permission and scope behavior.
