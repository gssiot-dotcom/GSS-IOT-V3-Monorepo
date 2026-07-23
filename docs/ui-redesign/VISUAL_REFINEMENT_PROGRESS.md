# GSS IoT V3 Visual Refinement Progress

## Scope and baseline

This refinement wave starts from the accepted UI-redesign commit
`093dc0ca135412a3c902d0f682683a20a4cce930`. The working tree was clean at audit
time and the repository implementation statuses remain unchanged. This document
records the audit that preceded the refinement and the file-level plan used for
implementation. It does not change the project phase state, API contracts, or
business behavior.

## Phase 0 audit — 2026-07-23

### Working-tree and verification baseline

- `git rev-parse HEAD`: `093dc0ca135412a3c902d0f682683a20a4cce930`
- `git status --short`: clean
- Existing web E2E visual fixture: `apps/web/e2e/ui-redesign.visual.spec.ts`
- Baseline capture run: `pnpm --filter web test:e2e` — PASS, 6 tests
- Baseline capture output: `test-results/ui-redesign.visual-capture-e952f-gn-pages-at-required-widths/`
- Baseline no-permission output: `test-results/ui-redesign.visual-capture-d6550-a-test-only-session-fixture/`

The current baseline is light-only. The protected captures show a readable but
very white shell, a single cyan-blue accent, plain summary surfaces, and a
floating-card treatment for the Admin company context navigation. The 375px
company workspace capture also exposes a title/action wrapping defect: the long
company name collapses to one character per line because the header title block
and actions do not establish a mobile min-width relationship.

### Exact current findings and root causes

| Area                        | Evidence                                                                                        | Root cause                                                                                                                                                                | Refinement direction                                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Semantic color system       | `packages/ui/src/theme.ts`, `apps/web/src/styles/global.css`                                    | Only `gss` blue plus status colors are defined; page/surface/text roles are incomplete and feature CSS repeats raw light/dark values.                                     | Add light/dark parity for brand, neutral, operational, typography, border, focus, and surface roles; expose accent families from `@gss-iot/ui`.   |
| Forced light mode           | `apps/web/src/styles/global.css:2`                                                              | `:root { color-scheme: light; }` is unconditional; `MantineProvider` has no `defaultColorScheme` or pre-render color-scheme initialization.                               | Use Mantine color-scheme persistence with `auto` fallback and an early initialization script.                                                     |
| Buttons                     | `apps/web/src/features/**`, `packages/ui/src/theme.ts`                                          | Most actions use Mantine defaults or `light`; there is no shared semantic button API, pressed state, or consistent quiet/primary hierarchy.                               | Add a small `GssButton` wrapper and shared transitions/focus/disabled treatment.                                                                  |
| Text hierarchy              | `packages/ui/src/dashboard-primitives.tsx`, feature pages                                       | Most labels use `dimmed`, while important metadata and section identity are not distinguished.                                                                            | Add shared heading/body/meta/accent conventions and consume them from dashboard/monitoring compositions.                                          |
| Dashboard metrics           | `apps/web/src/features/dashboard/DashboardPages.tsx`                                            | KPI cards use the same `DashboardKpiCard` treatment and repeated icons; operational sections are plain text groups or generic papers.                                     | Extend shared metric/section primitives with deterministic accent identity and meaningful Tabler icons.                                           |
| Monitoring summary          | `apps/web/src/features/monitoring/AdminMonitoringPage.tsx`, `CompanyMonitoringPage.tsx`         | Summary cards are plain `Paper` blocks; severity summary badges do not distinguish real operational concepts; connection state is a single header badge.                  | Add reusable operational summary cards while preserving all tabs, state classifications, sockets, and card/table behavior.                        |
| Admin company workspace     | `apps/web/src/features/organizations/AdminCompanyDetailPage.tsx`, `apps/web/src/app/router.tsx` | Each section URL mounts the same page element as a separate top-level route. The inner nav is a bordered `Paper`, and shared company data is loaded by the page instance. | Use one nested `AdminCompanyWorkspaceLayout` parent with `Outlet`; keep section URLs and child permission guards unchanged.                       |
| Admin company mobile layout | `AdminCompanyDetailPage.tsx`, global layout CSS                                                 | `PageHeader` title/actions compete for the narrow width; inner navigation remains a card instead of a full-height contextual column.                                      | Make the workspace shell persistent, use full-height bordered desktop navigation, and switch to a compact mobile section selector/drawer pattern. |
| Color-scheme integration    | `apps/web/src/main.tsx`, `apps/web/index.html`                                                  | No theme toggle, no persisted explicit preference, and no system fallback before React renders.                                                                           | Add a header icon button beside notifications and Mantine-supported `auto`/localStorage behavior without route reload.                            |
| Visual test coverage        | `apps/web/e2e/ui-redesign.visual.spec.ts`                                                       | Protected fixture covers light screenshots and representative routes but no dark mode, toggle persistence, system fallback, or nested-layout remount/request assertions.  | Extend deterministic fixtures for both schemes and add focused shell/workspace tests.                                                             |

### Current page-to-layout map

| Route/page family                 | Current pattern                                                   | Current data presentation                                          | Refinement decision                                                                                |
| --------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Login                             | Auth form surface                                                 | Form                                                               | Keep; theme bootstrap must not alter unauthenticated flow.                                         |
| Admin/Company Welcome and Profile | Portal shell + summary sections                                   | Cards/lists                                                        | Keep; theme and shell controls apply globally.                                                     |
| Admin/Company Dashboard           | Page header + KPI grid + operational sections                     | Metric cards, compact tables, SVG/bar summaries                    | Enrich shared metrics and section headers; no invented trends.                                     |
| Admin Companies                   | Entity collection workspace + card/table toggle                   | Company entity cards or comparison table                           | Keep cards as default; keep table toggle for comparison.                                           |
| Company Sites                     | Scoped entity collection                                          | Site entity cards/table where available                            | Keep entity cards; preserve backend scope filtering.                                               |
| Company Buildings                 | Scoped entity collection                                          | Building entity cards/table where available                        | Keep entity cards; preserve backend scope filtering.                                               |
| Admin Company Overview            | Detail workspace with inner nav                                   | Summary cards and profile panels                                   | Convert to persistent nested workspace parent + Outlet child.                                      |
| Admin Company Sites               | Detail workspace section                                          | Entity cards                                                       | Render as nested child; remain cards.                                                              |
| Admin Company Buildings           | Detail workspace section                                          | Entity cards                                                       | Render as nested child; remain cards.                                                              |
| Admin Company Users               | Detail workspace section                                          | DataTable                                                          | Keep table: role/status/email comparison and management actions are dense.                         |
| Admin Company Devices             | Detail workspace section with small tabs                          | Gateway/node DataTables                                            | Keep short peer tabs; do not promote to a global sidebar.                                          |
| Admin Devices                     | Inventory workspace with gateway/node tabs                        | Dense technical tables                                             | Keep tables and tabs; technical comparison and actions dominate.                                   |
| Company Devices                   | Scoped gateway/node tabs                                          | Dense scoped tables                                                | Keep tables and tabs; no card conversion without a small-scope condition.                          |
| Admin Gateway Commands            | Operations table + detail drawer                                  | Dense lifecycle table                                              | Keep table; add status identity only.                                                              |
| Admin/Company Alarms              | History table + detail/form surfaces                              | Dense event/policy tables                                          | Keep tables; alarm severity remains semantic only.                                                 |
| Alarm Detail                      | Detail workspace with Triggers/Notifications tabs                 | Event evidence and notification tables                             | Keep tabs: tightly related live episode views, not independent workspace sections.                 |
| Alarm Rules                       | Structured form workspace and policy table                        | Form/table                                                         | Keep form workspace and dense policy table.                                                        |
| Admin/Company Notifications       | History table                                                     | Dense notification records                                         | Keep table.                                                                                        |
| Admin/Company Reports             | Filter/job table workspace                                        | Dense report jobs/exports                                          | Keep table.                                                                                        |
| Company Users                     | Collection table + form workspace                                 | Dense user table                                                   | Keep table and form sections.                                                                      |
| Company Roles                     | Role table + permission editor workspace                          | Dense role table/form                                              | Keep table and form workspace.                                                                     |
| Admin Settings                    | Settings/role table and form surfaces                             | Dense table/form                                                   | Keep current form/table pattern; no unrelated route-tree refactor.                                 |
| Company Settings                  | Form workspace                                                    | Structured form                                                    | Keep; theme surfaces and text hierarchy only.                                                      |
| Admin Monitoring                  | Selector + summary + node-type selection + card/table node states | Summary cards, legacy node cards, table/card state views           | Enrich header/summary identity; preserve realtime mechanics and current interaction model.         |
| Company Monitoring selection      | Building/node-type selection                                      | Legacy image-first entity cards                                    | Keep exact images and image-first behavior; use controlled accent identity.                        |
| Company Monitoring node view      | Realtime workspace                                                | Four Mantine tabs, card/table toggle, detail drawer, history table | Keep exactly: Latest States, History, Alarm Levels, Fault Filters, realtime and card/table toggle. |

### Tables that should remain tables vs. entity-card candidates

The previous redesign already converted the approved organization collections to
entity cards. No broad table-to-card rewrite is justified in this refinement.

Keep as tables: gateway command history, alarm history, notification history,
report jobs/exports, audit-style records, device inventory, sensor history,
company users, company roles, and dense gateway/node administration. These require
column alignment, scanning, pagination, or row actions.

Entity-card candidates: companies, construction sites, buildings, company
summaries, node-type selection, and small scoped device groups where status and
location matter more than column comparison. Those candidates are already card
first where approved; the refinement only adds metric/icon identity and better
surfaces.

### Tabs that should become route-backed inner sidebars

- Admin company Overview/Sites/Buildings/Users/Devices: qualifies because the
  sections are independent, route-backed, and share stable company context. This
  is the one confirmed remount/refetch problem in the current route tree.
- Admin/Company devices Gateway/Node tabs: remain short peer tabs; no confirmed
  remount problem and no need to change their URLs.
- Alarm detail Triggers/Notifications tabs: remain tightly related episode tabs.
- Company realtime monitoring Latest States/History/Alarm Levels/Fault Filters:
  explicitly unchanged because they share one live context and must preserve state.

### Route/remount/refetch audit

The current Admin company routes are five separate top-level `<Route>` elements
that each render `AdminCompanyDetailPage`. React Router therefore creates a new
page instance on section navigation. The page effect loads the company plus every
permission-allowed shared collection on each mount. The current route transition
is a remount, not merely a benign rerender, and can reset loading state and issue
duplicate shared-data requests. The replacement nested route parent will own one
effect and expose stable detail data/actions to child sections through
`useOutletContext`.

## Exact implementation file plan

### Phase 1 — semantic palette and shared interaction primitives

- `packages/ui/src/theme.ts` — brand/accent families, neutral/semantic light and dark roles, typography roles, component defaults.
- `packages/ui/src/button.tsx` — shared `GssButton` variants and icon-button helper.
- `packages/ui/src/dashboard-primitives.tsx` — `MetricIcon`, `TintedIconBox`, `MetricCard`, `OperationalSummaryCard`, `SectionIcon`, `StatusMetric`, `SectionAction`, enriched `SectionHeader`/`DashboardKpiCard`.
- `packages/ui/src/index.ts` — exports for the shared primitives and tokens.
- `apps/web/src/styles/global.css` — semantic CSS variables, dark surfaces, button states, workspace surfaces, reduced motion, no forced light mode.
- `apps/web/src/main.tsx` and `apps/web/index.html` — Mantine color-scheme provider and no-flash initialization.
- `apps/web/src/app/i18n.ts` — theme-toggle labels/tooltips and any required shared visual copy.

### Phase 2 — dashboard and monitoring composition

- `apps/web/src/features/dashboard/DashboardPages.tsx` — deterministic metric tones/icons and section identities using actual summary data.
- `apps/web/src/features/monitoring/AdminMonitoringPage.tsx` — operational summary cards, filters/header identity, and connection metadata.
- `apps/web/src/features/monitoring/CompanyMonitoringPage.tsx` — monitoring header/summary presentation only; tabs and live behavior remain intact.
- `packages/ui/src/page-header.tsx` — responsive shared page-header title/action layout.

### Phase 3 — persistent workspace and shell theme control

- `apps/web/src/features/organizations/AdminCompanyDetailPage.tsx` — split stable parent layout from child section rendering without changing API calls or URLs.
- `apps/web/src/features/organizations/AdminCompanyDetailPage.tsx` — persistent header/sidebar/Outlet context and shared modal actions; no duplicate layout file was introduced.
- `apps/web/src/app/router.tsx` — nested Admin company routes with the existing URL paths and child permission guards.
- `apps/web/src/features/shell/PortalLayout.tsx` — theme toggle beside notification bell; preserve notification API/socket gating.
- `apps/web/src/styles/global.css` — full-height contextual navigation and mobile replacement treatment.

### Phase 4 — focused tests and visual evidence

- `packages/ui/test/theme.spec.ts` — light/dark semantic parity.
- `packages/ui/test/button.spec.tsx` — button variants, focus/disabled states, reduced-motion CSS contract.
- `apps/web/src/test/dashboard.spec.tsx` — dashboard section/metric presentation.
- `apps/web/src/test/monitoring.spec.tsx` — monitoring summary presentation and unchanged tabs.
- `apps/web/src/test/shell-theme.spec.tsx` — persistence, system fallback, accessibility, Admin/Company/no-permission availability.
- `apps/web/src/test/auth-routing.spec.tsx` — nested navigation, stable parent instance, one shared company request, preserved URLs/permissions.
- `apps/web/e2e/ui-redesign.visual.spec.ts` — light/dark captures and required protected route fixtures at 1440/1280/1024/768/375.
- `docs/ui-redesign/VISUAL_REFINEMENT_VERIFICATION.md` — independent Pass 1 and Pass 2 matrices/evidence.

## Preserved behavior contract

No backend or contract file is in the implementation plan. RBAC helpers, scoped
API fetching, request IDs, MQTT behavior, Socket.IO rooms, alarm semantics,
notification/report behavior, route URLs, and project implementation statuses
remain protected regression surfaces.
