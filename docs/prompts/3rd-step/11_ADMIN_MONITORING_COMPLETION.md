# CODEX TASK 11 — Complete GSS Admin Monitoring

Complete Tasks 02–10 first so the shared monitoring cards/detail/chart components already exist.

## Goal

Replace the `/admin/monitoring` placeholder with a useful global GSS operations monitoring workspace, satisfying the remaining Monitoring part of user Requirement 5.

## Authorization

- Route and all endpoints require GSS Admin `monitoring.view`.
- Realtime room access continues to require `monitoring.realtime` when that separate permission is enforced by current architecture.
- GSS Admin is global but still permission-controlled.
- Do not reuse Company scope guards for GSS context.
- Do not leak raw unrestricted MQTT payloads or secrets.

## Required backend/read models

Current Admin monitoring supports building/node-type detail endpoints but lacks a global landing/index flow. Add efficient, bounded read models needed for:

- company/site/building selector data;
- global counts by latest state severity;
- gateways online/offline and stale summaries;
- buildings with warning/danger/offline nodes;
- recently updated nodes/buildings;
- selected building overview and node-type drilldown.

Use aggregate queries and pagination where required. Do not fetch every SensorReading.

Keep detailed building/node-type/history endpoints compatible and reuse them.

## Required frontend

Build `/admin/monitoring` with:

1. global operational summary cards;
2. company → site → building filters/selectors;
3. clear empty state when prerequisites/assignments are missing;
4. building node-type cards using preserved legacy images;
5. selected node-type latest states using the shared table/card views from Task 10;
6. shared node detail charts;
7. truthful realtime status for the selected room;
8. links to relevant device/company/building detail or command pages when permissions permit;
9. responsive layout and all universal states.

Do not duplicate Company monitoring code by copy/paste. Extract a context-aware shared monitoring workspace where clean, while keeping API base paths and authorization contexts explicit.

## Realtime

- Join only the selected building/node-type room.
- Clean up when filters change.
- Do not display reconnecting unless a real room connection is reconnecting.
- Preserve last known values while disconnected and mark stale/offline honestly.
- Admin notification socket and monitoring socket remain conceptually separate.

## Tests

API/E2E:

- monitoring.view required;
- monitoring.realtime join behavior;
- aggregate correctness;
- building/node-type drilldown;
- bounded queries/pagination;
- no Company authorization-context confusion.

Frontend:

- placeholder removed;
- selector cascade;
- global summary;
- node-type cards;
- shared table/card/detail behavior;
- request suppression without permission;
- realtime room switching/cleanup;
- empty/error/loading states.

Run monitoring, auth/RBAC and alarm regression suites plus typecheck, lint, format, build and diff check.

## Out of scope

- production observability stack;
- retention/partitioning;
- altering sensor classification;
- arbitrary cross-module redesign.

## Definition of Done

- `/admin/monitoring` is a complete operations page, not a placeholder.
- It reuses shared monitoring components and current backend truth.
- Permission and realtime behavior are correct.
- Tests and manual browser acceptance pass.
