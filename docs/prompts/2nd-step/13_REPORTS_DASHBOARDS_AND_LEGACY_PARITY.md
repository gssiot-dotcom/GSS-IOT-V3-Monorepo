# CODEX PROMPT - Phase 13: Reports, dashboards and approved legacy parity

Read `AGENTS.md`, completed Phase 7-12 docs, legacy feature inventory and approved decisions.

Confirm Phase 12 is complete. Start only Phase 13.

Read `docs/prompts/2nd-step/03_PHASE_8_MQTT_PROTOCOL_BASELINE.md`. MQTT command reports and dashboard aggregates must reflect the deterministic requestId protocol rather than infer completion from publish success.

## Goal

Implement scoped dashboards and report/export capabilities, then close only the legacy feature gaps explicitly approved as still required by GSS business.

## Reports

Implement report jobs and exports for approved types:

- company summary;
- site summary;
- building summary;
- device inventory;
- device assignment history;
- gateway status/last seen;
- node status/latest;
- sensor history;
- alarm history with count/interval evidence;
- MQTT command history, including requestId, cmd, correlation mode, sent/acknowledged timestamps, ACK latency, response/failure and terminal status;
- user activity/audit log.

Use separate permissions for view and export.

Company reports must always be backend filtered by company/site/building scope. Frontend filters are not security.

For large reports:

- create ReportJob;
- process asynchronously;
- persist status/error/progress;
- create ReportExport with storage key, format, expiry and createdBy;
- audit downloads.

Support CSV and XLSX first. Add PDF/HWPX only if explicitly approved and covered by stable generation tests.

## Dashboards

Replace admin/company dashboard placeholders with real aggregate APIs and pages.

GSS dashboard examples:

- companies/sites/buildings;
- gateways/nodes by lifecycle and assignment;
- online/offline or last-seen health;
- command status;
- active alarms;
- recent critical audit actions.

Company dashboard examples:

- scoped sites/buildings;
- assigned devices;
- latest node status counts;
- active alarms;
- recent readings/events.

Avoid expensive unbounded queries. Add indexes and time windows.

## Approved legacy parity decisions

Before coding, read `99_OPEN_DECISIONS.md` and current `DECISION_LOG.md`. Implement only decisions marked approved.

Potential parity candidates:

- angle calibration;
- building plan node placement/coordinates;
- weather/typhoon integration;
- asset upload/S3 storage;
- HWPX reports;
- gateway online/offline history;
- legacy charts/statistics.

For every candidate, either:

- implement with new architecture and tests, or
- explicitly mark not required/deferred with rationale.

Do not copy old mixed services/routes.

## Storage

Use a storage abstraction for building images and report exports. Local filesystem may be dev-only; production must support S3-compatible storage. Store keys, not trusted public URLs, as source of truth.

## Tests

- report permission vs export permission;
- company scope and cross-company denial;
- report job state transitions;
- large dataset pagination/streaming where applicable;
- download authorization and expiry;
- dashboard aggregate correctness;
- approved legacy feature tests;
- audit logs.

## Out of scope

- Production migration/deployment hardening belongs to Phase 14.
- Do not start Phase 14.

## Definition of Done

- Admin and Company dashboards are no longer placeholders.
- Approved report types generate scoped downloadable files.
- Approved legacy parity items are closed or explicitly rejected/deferred.
- Performance-sensitive queries have indexes and bounded filters.
- All previous phases remain green.
