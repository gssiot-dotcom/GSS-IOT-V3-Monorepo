# CODEX TASK 05 — GSS Admin and Company dashboard analytics

Complete Tasks 02–04 first. Read the Parfumbox dashboard reference for composition only, then design metrics from actual GSS entities and permissions.

## Goal

Replace report-only dashboards with useful GSS-specific operational overviews, KPI statistics and charts while retaining recent report jobs as one section.

## Security design

Dashboard endpoints and sections must not become an authorization side channel.

- Base route requires `dashboard.view`.
- Company aggregates use authenticated company context and effective site/building scope.
- Never trust a frontend `companyId`.
- Admin device sections require the appropriate device-view permission.
- Monitoring charts require `monitoring.view`.
- Alarm sections require `alarms.view`.
- Report section requires `reports.view`.
- Omit or mark unavailable any section the user cannot access; do not leak its counts.

## Required backend design

Create bounded aggregate endpoints and shared contracts, for example:

```txt
GET /admin/dashboard/summary?range=7d|30d|90d
GET /company/dashboard/summary?range=7d|30d|90d
```

Names may follow existing conventions. Validate the range and use efficient aggregate/group-by queries; do not load unbounded raw histories into memory.

### GSS Admin dashboard candidates

Use actual available data and permissions to implement a coherent subset:

- companies: total/active/inactive;
- construction sites and buildings;
- gateways: total, online/offline, unassigned;
- nodes: total, assigned/unassigned, lifecycle;
- latest node-state severity distribution;
- open alarms by severity and recent trend;
- command status distribution/recent failures;
- telemetry reading volume over the selected period;
- recent report jobs.

### Company dashboard candidates

Apply the user's actual scope:

- accessible sites/buildings;
- scoped gateways/nodes;
- latest node-state severity distribution;
- open alarms by severity;
- telemetry volume/trend;
- buildings with danger/warning/offline states;
- recent report jobs.

Do not show global company totals to a building-scoped user unless the approved scope policy explicitly allows them.

## Required frontend design

Use the shared dashboard primitives and Mantine chart patterns. Add `@mantine/charts`/compatible chart dependencies only when needed and update the lockfile correctly.

Each portal dashboard should include:

- page header and bounded range selector;
- responsive KPI card grid;
- two or more meaningful charts when data supports them;
- recent/critical operational section;
- recent report jobs as a lower-priority section, not the whole dashboard;
- loading skeletons;
- empty-state charts with explanatory copy rather than fake values;
- partial-section error handling;
- responsive layout and accessible chart labels/tooltips.

Good chart candidates:

- area/line: telemetry readings over time;
- donut: node severity or gateway online status;
- bar: alarms by severity or buildings by status;
- stacked bar: command lifecycle when useful.

Avoid decorative charts that do not answer an operational question.

## Tests

API tests must verify:

- permissions per section;
- Company scope isolation for platform/site/building users;
- cross-company isolation;
- bounded date range validation;
- aggregate correctness with seeded fixtures;
- no data returned for inaccessible sections.

Frontend tests must verify:

- KPI/chart rendering from API data;
- permission-aware section visibility/request suppression;
- range changes;
- empty/error/loading states;
- report card still works;
- Admin and Company dashboards use correct endpoints.

Run focused dashboard tests, full API unit tests, relevant E2E, web unit tests, typecheck, lint, format, build and diff check.

## Documentation

Add a dashboard architecture/data-contract document or update an existing relevant document. Record metric definitions so numbers are not ambiguous.

## Out of scope

- production metrics infrastructure;
- long-term retention/partitioning;
- fake demo data;
- unrelated UI redesign.

## Definition of Done

- Both dashboards provide real, permission-safe GSS operational value.
- Charts and statistics derive from actual database aggregates.
- Company scope is enforced in backend queries.
- Report jobs remain integrated.
- Tests and manual browser acceptance pass.
