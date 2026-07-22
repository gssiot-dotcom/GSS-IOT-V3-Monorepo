# CODEX TASK 10 — Monitoring table/card toggle and node detail charts

Complete Tasks 02–09 first. Inspect the old GSS V2 card/T-shaped LED/detail modal files named in the source map and current Company monitoring code.

## Goal

Implement user Requirement 9 for Company monitoring and build reusable monitoring presentation components that Task 11 can reuse for GSS Admin monitoring.

## Required interaction

On the node-type monitoring page:

- keep current tabs and feature panels;
- place a table/card view selector in the available right side of the tab/header area;
- support `TABLE` and `CARD` latest-state views;
- preserve realtime updates in both views;
- clicking a node card or table row/action opens a modern node detail view with historical graphics;
- do not place a fault-filter action/button inside the node detail graphic.

The existing separate fault-filter tab may remain because the user only prohibited the action inside the new node graphic/detail.

## Shared component design

Extract reusable typed components/hooks rather than growing `CompanyMonitoringPage.tsx` further. Candidate structure:

```txt
features/monitoring/components/MonitoringViewToggle.tsx
features/monitoring/components/NodeStateCard.tsx
features/monitoring/components/DoorNodeCard.tsx
features/monitoring/components/AngleNodeCard.tsx
features/monitoring/components/TShapeStatusIndicator.tsx
features/monitoring/components/NodeDetailDrawer.tsx
features/monitoring/components/NodeHistoryChart.tsx
features/monitoring/hooks/*
```

Use repository conventions; exact names may differ.

## Door node card

Adapt V2 behavior with modern GSS/Mantine styling:

- prominent open/closed state with icon and text;
- current severity/status badge;
- battery level when present;
- gateway serial;
- last-seen/value age;
- offline/unconfigured/fault-filtered evidence where appropriate;
- no color-only state communication.

## Angle and gangform cards

- T-shaped LED/status visualization inspired by V2;
- display X and Y values clearly;
- show status/severity, gateway and last seen;
- use semantic GSS status colors and text/icons;
- make the T-shape accessible with an aria label/description;
- do not copy old Tailwind/shadcn implementation directly.

## Node detail and charts

Use the existing paginated history endpoint or add a bounded chart-specific query only when necessary.

### Door detail

Show:

- current open/closed and battery state;
- metadata and assignment context;
- time-based open/closed history visualization;
- battery trend when data exists;
- recent readings table or accessible summary.

### Angle/gangform detail

Show:

- current X/Y values and severity;
- X and Y time-series lines;
- configured caution/warning/danger reference thresholds when available;
- gateway/building/node metadata;
- recent readings.

The detail must explicitly **not** include a fault-filter toggle/button/action.

## Data/performance

- Do not fetch unbounded history.
- Use a bounded default chart range/point count.
- Preserve current history pagination.
- Avoid creating one history request per card.
- Fetch detail history only when a node is opened/selected.
- Handle missing/stale values and disconnects gracefully.

## View persistence

Persist table/card preference per portal/user or locally when cleanly possible. Do not store sensitive data. A stable local preference is acceptable.

## Tests

Cover:

- toggle switches table/card view;
- preference restoration;
- door open/closed/battery rendering;
- angle/gangform T-shape and X/Y rendering;
- safe/caution/warning/danger/offline/unconfigured statuses;
- realtime event updates the visible card/table;
- clicking node opens correct detail;
- chart receives bounded history data;
- fault-filter action is absent from detail;
- permission/scope and current alarm-level/fault-filter tabs do not regress;
- responsive card grid and accessible labels.

Run monitoring frontend tests, monitoring API/E2E regression, alarm regression, typecheck, lint, format, build and diff check.

## Manual acceptance

Record:

- table/card toggle on all three node types;
- door open/closed visual;
- T-shaped LED for angle/gangform;
- realtime change in both modes;
- node detail charts;
- no fault-filter button in detail;
- mobile/tablet behavior.

## Out of scope

- GSS Admin monitoring route completion (Task 11);
- changing alarm classification logic;
- production telemetry retention.

## Definition of Done

- Company monitoring supports both useful views.
- V2 behavior is preserved conceptually with V3 architecture/design.
- Detail charts are bounded, accessible and fault-filter-action-free.
- Tests and browser acceptance pass.
