---
name: gss-iot-modern-dashboard
description: Redesign and implement the GSS IoT V3 React/Mantine admin and company portals as a modern industrial operations dashboard. Use for UI/UX audits, design-system work, shell/sidebar redesign, dashboard pages, entity card grids, data tables, forms, nested section navigation, realtime monitoring, alarms, reports, responsive behavior, accessibility, and visual QA in the GSS IoT V3 repository. Preserve the existing React 19, Vite, TypeScript, Mantine 9, Tabler Icons, shared @gss-iot/ui package, RBAC route/action guards, company scope rules, i18n, MQTT/realtime behavior, and approved business architecture.
---

# GSS IoT Modern Dashboard

## Mission

Transform the existing GSS IoT V3 frontend into a polished, modern, dense-but-readable industrial IoT dashboard without changing approved business behavior, API contracts, RBAC semantics, scope enforcement, alarm logic, or MQTT flows.

Use the current repository as the source of truth. Treat the bundled visual references as design direction, not as code to copy.

## Mandatory context

Before planning or editing, read these repository files in order:

1. `AGENTS.md`
2. `docs/architecture/gss_iot_rbac_architecture_blueprint.md`
3. `docs/design/DESIGN_SYSTEM.md`
4. `docs/design/UI_UX_SPEC.md`
5. `docs/design/PAGE_INVENTORY.md`
6. `docs/planning/PROJECT_STATE.md`
7. `docs/planning/TODO.md`
8. `docs/planning/DECISION_LOG.md`

Then inspect the current implementation, at minimum:

- `packages/ui/src/`
- `apps/web/src/app/router.tsx`
- `apps/web/src/features/shell/PortalLayout.tsx`
- `apps/web/src/features/shell/navigation.ts`
- the feature files relevant to the requested page
- existing tests for that feature

Run `scripts/audit_ui.sh` from the repository root when a broad UI audit is needed.

## Non-negotiable architecture rules

- Keep React, Vite, TypeScript, Mantine, Mantine hooks, and Tabler Icons.
- Do not add Tailwind, shadcn, Material UI, Ant Design, Chakra, or a second competing component system.
- Put reusable primitives and tokens in `packages/ui/src/`.
- Put domain-specific composition in `apps/web/src/features/<feature>/`.
- Preserve `RequireAuth`, `RequirePermission`, `Can`, `hasPermission`, and sidebar filtering.
- Never treat hidden frontend controls as security. Backend permission and scope checks remain authoritative.
- Preserve company, construction-site, and building scope semantics.
- Preserve i18n. Do not hardcode user-facing Korean or English text inside components.
- Preserve realtime Socket.IO behavior, alarm rules, command status flows, and API contracts unless the task explicitly changes them.
- Do not redesign backend modules during a frontend task.
- Do not mark a phase complete when required checks fail or are skipped.

Read `references/rbac-and-scope-safety.md` before changing navigation, routes, action controls, notifications, or scoped pages.

## Visual direction

Use a modern industrial operations dashboard language derived from the supplied SnowUI and Dashboard X references:

- compact permanent desktop sidebar;
- slim contextual top bar;
- dark benchmark with full light-token parity;
- deep navy or charcoal surfaces, restrained blue/cyan primary accents;
- magenta/purple only as a secondary analytical accent, not the GSS primary brand color;
- clear hierarchy through spacing, typography, surface elevation, and alignment;
- compact KPI tiles;
- large analytical blocks with quiet borders;
- dense tables with strong row scanning;
- card-based entity browsing where spatial recognition is more useful than row comparison;
- structured full-page forms with an inner section navigator;
- subtle motion only for hover, focus, collapse, loading, and status transitions;
- no decorative gradients on every card;
- no glassmorphism that reduces legibility;
- no excessive rounded-card mosaic.

Use GSS semantic status colors only for actual state meaning: safe, caution, warning, danger, offline, command failure, or lifecycle status.

Read `references/visual-direction.md` for the detailed visual analysis.

## Page pattern decision rules

Choose the presentation according to the user's task, not according to a single global preference.

### Use entity cards by default for

- construction sites;
- buildings;
- company summaries;
- node-type selection;
- scope selection;
- small device groups where status and location matter more than bulk comparison.

Each entity card should expose the minimum useful scan data:

- title and code/identifier;
- company/site/building context;
- lifecycle or operational status;
- compact counts such as buildings, gateways, nodes, users, or active alarms;
- last activity or update time when meaningful;
- primary open action;
- permission-aware overflow actions.

Provide search, filter, sort, empty state, and responsive behavior. Add a card/table toggle only when both modes provide real value.

### Keep tables for

- audit logs;
- gateway command history;
- report jobs and exports;
- alarm history with many filters;
- user and role administration when bulk comparison or actions are central;
- device inventory with many technical columns;
- sensor history.

Do not convert every data table into cards.

### Use nested section navigation instead of top tabs when

- a detail or settings workspace has four or more independent sections;
- sections have long forms or distinct routes;
- the user needs stable orientation while scrolling;
- the page resembles company detail, building detail, user editing, settings, or alarm rule configuration.

Use a reusable `ContextSectionLayout` with:

- a 200-240px inner sidebar on desktop;
- route-backed section state;
- permission-filtered entries;
- compact title, description, icon, and optional completion/status marker;
- a select, segmented control, or drawer replacement on small screens;
- sticky behavior only when it does not hide content or break keyboard navigation.

### Keep tabs when

- users frequently switch between tightly related views in one operational context;
- switching must preserve live state;
- the sections are short and peer-level.

Keep the realtime monitoring tabs for latest states, history, alarm levels, and fault filters unless a focused task proves a better interaction. Do not replace those tabs merely for visual consistency.

Read `references/page-patterns.md` and `references/page-migration-matrix.md` before redesigning a whole section.

## Target shared UI codebase

Build toward the following shared component families under `packages/ui/src/`:

```txt
layout/
  portal-shell-primitives.tsx
  context-section-layout.tsx
  page-container.tsx
  section-panel.tsx

navigation/
  sidebar-section.tsx
  breadcrumb-bar.tsx
  mobile-section-switcher.tsx

data/
  data-toolbar.tsx
  data-view-toggle.tsx
  data-table.tsx
  table-pagination-footer.tsx
  filter-chip-row.tsx

entities/
  entity-card.tsx
  entity-card-grid.tsx
  entity-metric.tsx
  entity-status-row.tsx

forms/
  form-workspace.tsx
  form-section.tsx
  form-field-grid.tsx
  sticky-form-actions.tsx
  destructive-action-zone.tsx

feedback/
  status-badge.tsx
  realtime-status-badge.tsx
  app-states.tsx
  skeletons.tsx

monitoring/
  node-state-card.tsx
  node-detail-drawer.tsx
  monitoring-view-toggle.tsx
  sensor-value-display.tsx

charts/
  chart-panel.tsx
  metric-trend.tsx
  status-distribution.tsx
```

Do not move feature-specific API calls or business logic into `packages/ui`.

Read `references/target-codebase.md` for component responsibilities and suggested APIs.

## Form UX rules

For small create/edit actions with no more than roughly six simple fields, use a modal.

For complex users, roles, building configuration, alarm rules, device assignment, or settings:

- use a full page or large drawer;
- place a section navigator on the left for desktop;
- group fields into named `FormSection` surfaces;
- use one- or two-column responsive field grids;
- show helper text and validation near fields;
- keep save/cancel actions consistently placed;
- use sticky actions only when the form is long;
- show unsaved-change protection;
- separate destructive actions in a danger zone;
- avoid one very long modal with many dividers and unrelated controls.

For company-user editing, separate at least:

1. identity and status;
2. role;
3. direct allow/deny permissions;
4. construction-site/building scope;
5. position assignments;
6. effective-access preview.

## Shell and navigation rules

- Keep one primary portal sidebar for global navigation.
- Group items by Overview, Organizations, Devices, Operations, People, and Settings after permission filtering.
- Do not render unauthorized groups or empty group labels.
- Provide a clear active state with shape, contrast, icon, and text, not color alone.
- Place brand/portal identity at the top and user/account controls at the bottom or top bar according to viewport.
- Keep the sidebar visually quiet; use status colors only where they communicate live state.
- Hide the scrollbar visually but preserve scrolling and keyboard access.
- Use a mobile drawer below the chosen breakpoint.
- Keep the header focused on breadcrumb/context, search when useful, theme/language, notifications when permitted, realtime health, and account.

## Theme rules

- Treat the dark references as the main visual benchmark.
- Implement both light and dark semantic tokens; do not hardcode dark colors in feature components.
- Do not make dark mode the only mode unless explicitly requested.
- Extend `gssSemanticTokens`, `gssLayoutTokens`, and `gssTypographyScale` rather than scattering magic values.
- Freeze token changes through visual review before mass page migration.
- Use 12-16px card radii, restrained shadows, compact controls, and consistent 4/8px spacing multiples.
- Preserve AA contrast, visible focus rings, and status labels.

## Workflow for a redesign task

1. Read mandatory context and inspect the current page implementation.
2. State the current UX problems with concrete file references.
3. Select the correct page pattern: dashboard, entity cards, table workspace, nested section layout, realtime workspace, or form workspace.
4. List shared primitives to add or extend before feature code.
5. Define the permission and scope contract for every route and action.
6. Implement one coherent vertical slice.
7. Add or update unit tests and relevant Playwright coverage.
8. Test light and dark tokens where supported.
9. Test desktop, tablet, and mobile widths.
10. Run the repository quality gates.
11. Update design/planning docs when the design contract changes.
12. Report changed files, preserved behavior, checks run, screenshots reviewed, and remaining risks.

For whole-project redesigns, use the phased sequence in `references/implementation-workflow.md`. Do not attempt an unreviewed one-shot rewrite of every page.

## Quality gates

Run the actual available commands, normally:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter web test:e2e
```

Also verify:

- no unauthorized route, sidebar item, action, notification request, or socket join appears;
- no company scope behavior changed;
- no new horizontal overflow at 1280, 1024, 768, and 375 widths;
- keyboard navigation and focus remain visible;
- loading, empty, error, forbidden, session-expired, offline, and partial-failure states exist;
- card and table modes render the same allowed data;
- i18n keys exist for all new copy;
- dark and light surfaces meet contrast requirements;
- long Korean, English, identifiers, and serial numbers do not break layouts.

Read `references/qa-checklist.md` for the final review checklist.

## Output contract

For a planning request, provide:

- current-state audit;
- target visual direction;
- proposed shared component changes;
- page-by-page migration plan;
- RBAC/scope risks;
- phased implementation order;
- acceptance criteria.

For an implementation request, provide:

- files changed;
- concise behavior summary;
- preserved security/business behavior;
- commands run and results;
- screenshots or visual checks performed;
- remaining risks and next phase.
