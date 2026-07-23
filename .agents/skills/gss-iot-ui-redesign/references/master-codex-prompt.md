# GSS IoT V3 Code-First UI Redesign Prompts

## Prompt 1 - audit, foundations, shell, and immediate action-placement fixes

Paste this at the repository root:

```text
Read AGENTS.md first and follow its mandatory context-loading order.

You are redesigning the current GSS IoT V3 frontend directly in code. The current UI is functionally useful but visually sparse, inconsistent, and uncomfortable. Several cards and tables expose actions in the wrong place, especially Deactivate/Delete buttons. The goal is not to preserve the current visual pattern at all costs. Preserve product behavior and security, but create a much more modern, polished, compact, and pleasant enterprise IoT dashboard.

This run is Wave 1 only:
1. audit the current UI;
2. define the revised visual contract;
3. redesign shared tokens/primitives and the application shell;
4. refactor the worst organization/user action-placement pages;
5. capture screenshots and stop for review.

Do not redesign devices, monitoring, alarms, reports, or settings in this run unless a shared primitive requires a compatibility change.

Non-negotiable behavior constraints:
- Do not change backend APIs, endpoint paths, request/response DTOs, routes, authentication, RBAC permission keys, scope behavior, data fetching, realtime behavior, or business logic.
- Keep backend authorization as the real security layer.
- Keep all existing frontend permission guards and sidebar filtering.
- Keep Mantine and Tabler icons. Do not add a competing UI framework.
- Keep all UI strings in i18n; do not hardcode visible text.
- Preserve current tests unless visual behavior intentionally requires compatible updates.
- Preserve the three legacy node-type images and monitoring flow, although monitoring pages are not part of this wave.
- Inspect git status before editing and do not overwrite unrelated user changes.
- Do not commit unless explicitly asked.

First inspect these files:
- packages/ui/src/theme.ts
- packages/ui/src/dashboard-primitives.tsx
- packages/ui/src/page-header.tsx
- packages/ui/src/data-table.tsx
- packages/ui/src/status-badge.tsx
- packages/ui/src/realtime-status-badge.tsx
- packages/ui/src/app-states.tsx
- packages/ui/src/node-type-card.tsx
- packages/ui/src/index.ts
- apps/web/src/styles/global.css
- apps/web/src/features/shell/PortalLayout.tsx
- apps/web/src/features/shell/DesignSystemDemoPage.tsx
- apps/web/src/features/shell/navigation.ts
- apps/web/src/features/organizations/CompaniesPage.tsx
- apps/web/src/features/organizations/AdminCompanyDetailPage.tsx
- apps/web/src/features/organizations/CompanyResourcesPage.tsx
- apps/web/src/features/company-management/CompanyUsersPage.tsx
- relevant unit tests and E2E infrastructure

Known UX problems that must be fixed, not preserved:
- CompanyResourcesPage stacks Open, Monitoring, and a red Deactivate button vertically in every table row.
- AdminCompanyDetailPage exposes Deactivate directly in the page header beside Edit.
- CompanyUsersPage shows full Edit and Deactivate buttons in every row and exposes Deactivate directly in the position table.
- CompaniesPage shows raw status strings and repeated Open buttons with weak row hierarchy.
- Current create/edit modals often place a single Save/Create button directly below fields with no standard footer or Cancel action.
- DataTable has no opinionated action column, rich primary entity cell, density, skeleton, row navigation, or mobile fallback.
- The shell and cards look close to unstyled Mantine defaults and lack a strong GSS product identity.

Before implementation, create:
- docs/design/UI_REDESIGN_AUDIT.md
- docs/design/UI_REDESIGN_V2.md

The audit must be file-specific and group findings by:
- product shell and navigation;
- typography and spacing;
- color and surface hierarchy;
- cards and KPI density;
- tables and filters;
- row/card action placement;
- destructive action semantics;
- forms, modals, and drawers;
- loading/empty/error/forbidden/session states;
- responsive behavior;
- accessibility;
- visual consistency and duplicated inline styling.

Design direction:
- Modern enterprise IoT operations dashboard for construction safety.
- Calm, reliable, technical, compact, premium, and easy to scan for long sessions.
- Use a dark navy sidebar, quiet light header, soft gray-blue canvas, white surfaces, GSS cyan-blue primary, and restrained semantic status colors.
- Avoid generic empty templates, oversized cards, excessive gradients, heavy glassmorphism, rainbow colors, and decorative clutter.
- Preserve GSS identity; improve it rather than replacing it with a random SaaS theme.

Suggested visual tokens to implement or refine:
- canvas: #F4F7FB
- surface: #FFFFFF
- surface-subtle: #F8FAFC
- text-primary: #172033
- text-secondary: #667085
- text-tertiary: #98A2B3
- border: #DCE4EE
- border-strong: #C9D4E2
- primary: #0B80B7
- primary-hover: #08648F
- primary-soft: #E8F7FD
- accent: #2563EB
- sidebar: #0E1B2B
- sidebar-muted: #9FB0C3
- focus: #159FDE
- safe: #0B80B7
- caution: #16A34A
- warning: #D18A00
- danger: #DC2626
- offline: #7C8797
- unconfigured: #64748B

Density and sizing target:
- header height: about 64px
- sidebar width: 264-280px
- desktop content padding: 24-32px
- section gap: 20-24px
- card radius: 14-16px
- control height: 38-42px
- table row height: 48-54px
- restrained shadows; rely primarily on border, spacing, and surface contrast
- transitions: 120-180ms and reduced-motion safe

Action hierarchy rules:
1. Each page or dialog gets one visually dominant primary action.
2. Page headers may contain one primary and at most one common secondary action.
3. Rare, contextual, and destructive actions go into an overflow menu.
4. Never expose Deactivate/Delete as a dominant red button in a page header, card, or table row.
5. In tables, make the entity name or row the navigation target. Keep at most one visible row action; put Edit, Assign, Move, Deactivate, Delete, and similar actions in a compact kebab menu.
6. Separate destructive menu items with a divider.
7. Deactivate is reversible and is not Delete. Use pause/ban/power-off semantics, not a trash icon.
8. Missing permission means the action is not rendered. A business-state blocker may render disabled only with a tooltip or reason.
9. Confirm destructive actions with the entity name, impact, and reversible/irreversible wording.
10. Modal/footer order is Cancel first and Save/Create/Deactivate second. Do not place the only submit button inline under the last field.

Shared component work:
- Refine theme tokens, typography, component defaults, focus, surface, dark sidebar, and responsive spacing.
- Redesign PageHeader to support eyebrow/breadcrumb/context, title, subtitle, status/meta, primary action, and overflow action without becoming oversized.
- Redesign DataTable into a reusable operational table with:
  - rich primary entity cell support;
  - fixed narrow right-aligned actions column;
  - row or title navigation;
  - compact/comfortable density;
  - skeleton rows;
  - caption/result count;
  - search/filter toolbar integration;
  - complete pagination API, not a hardcoded page-size display;
  - horizontal containment and a mobile-friendly fallback or documented card alternative;
  - accessible labels and keyboard behavior.
- Add reusable primitives only when they remove real duplication. Likely candidates:
  - EntityPrimaryCell
  - EntityStatusBadge
  - EntityActionMenu
  - ConfirmActionModal
  - FilterToolbar
  - ModalFormFooter
  - WorkspaceCard or Surface
  - SkeletonTable
  - ResponsiveEntityList
- Turn /admin/design-system into the living code-first UI gallery. It must display tokens, typography, buttons, badges, status states, entity rows/cards, action menus, filters, modal footers, loading/empty/error/forbidden/session states, and responsive examples.

Shell redesign:
- Use a polished dark navy sidebar with GSS mark/product name and current portal context.
- Keep current permission-filtered sections and routes.
- Give active navigation a clear soft-cyan state and visible marker.
- Make the scrollbar unobtrusive but keep navigation usable.
- Keep the header visually quiet: page context, realtime state only when needed, notification bell, account control.
- Keep mobile navigation as a drawer and close it after navigation.
- Use a subtle canvas background and intentional content width.

Page-specific Wave 1 requirements:

CompaniesPage:
- Replace raw status text with a semantic status badge.
- Make company name/code the strong primary cell and navigation target.
- Remove repeated full-size Open buttons where row/title navigation is clearer.
- Put contextual actions in a narrow right-side menu.
- Give the create-company dialog a structured layout and footer.

AdminCompanyDetailPage:
- Build a stronger detail header with status and compact metadata.
- Keep Edit visible only if it is the main task.
- Move Deactivate into an overflow menu and confirm it.
- Improve tabs and overview hierarchy without changing routes or data.
- Do not make every subsection a visually identical large card.

CompanyResourcesPage:
- Remove the vertical Stack of Open, Monitoring, and Deactivate buttons from table cells.
- Use entity/title navigation, status badge, metadata, one optional monitoring shortcut, and an overflow menu.
- Deactivate must be contextual, confirmed, and visually separated.
- Make desktop and mobile behavior deliberate.

CompanyUsersPage:
- Use avatar/name/email as the primary user cell.
- Render role, scope, and active state as compact badges/chips.
- Replace visible Edit and Deactivate buttons with one action menu.
- Use the same action pattern for positions.
- Preserve permission-based rendering and self-lockout/business blockers.
- Refine the large user editor and position manager with clear sections and consistent footers.

Testing and visual QA:
- Add/update unit tests for action-menu visibility, permission filtering, Deactivate confirmation, dialog footers, status labels, and row navigation.
- Capture baseline and after screenshots when possible at:
  - 1440x900
  - 1280x800
  - 390x844
- Prioritize these routes:
  - /admin/design-system
  - /admin/companies
  - /admin/companies/:companyId
  - /company/areas
  - /company/buildings
  - /company/users
- If authenticated E2E state is unavailable, use test-only API/session fixtures. Do not weaken production authentication or add a production bypass.

Run:
- pnpm format:check
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm build
- relevant web E2E tests
- git diff --check

At the end, report:
- exact files changed;
- audit findings addressed;
- visual system decisions;
- action-placement changes, especially Deactivate/Delete;
- preserved APIs/routes/RBAC/scope behavior;
- screenshots created and their paths;
- commands run and exact results;
- remaining risks;
- routes I should inspect manually;
- recommended Wave 2 scope.

Do not proceed to Wave 2 in this run. Stop after Wave 1 and wait for visual feedback.
```

## Prompt 2 - devices, assignments, and organization details

```text
Read AGENTS.md, docs/design/UI_REDESIGN_AUDIT.md, docs/design/UI_REDESIGN_V2.md, and the Wave 1 diff first.

Continue the GSS IoT V3 code-first redesign with Wave 2 only. Reuse the shared visual system and action hierarchy implemented in Wave 1. Do not invent a second visual pattern.

Refactor:
- apps/web/src/features/devices/AdminDevicesPage.tsx
- apps/web/src/features/devices/CompanyDevicesPage.tsx
- apps/web/src/features/gateway-commands/GatewayCommandsPage.tsx
- apps/web/src/features/organizations/CompanyResourceDetailPages.tsx
- apps/web/src/features/company-management/CompanyRolesPage.tsx
- related tests

Goals:
- compact inventory density;
- strong device identity cells;
- semantic lifecycle and online/offline status;
- assignment history and current assignment clarity;
- one visible row action maximum;
- contextual edit/assign/move/retire/delete actions in overflow menus;
- explicit disabled reasons for history blockers;
- consistent drawers/modals and confirmation footers;
- responsive card/list fallback;
- no API, route, RBAC, scope, MQTT, or business logic changes.

Use Playwright screenshots at the same viewports, run all relevant checks, report exact files/results, and stop for review before Wave 3.
```

## Prompt 3 - dashboards, monitoring, alarms, reports, and settings

```text
Read AGENTS.md, docs/design/UI_REDESIGN_AUDIT.md, docs/design/UI_REDESIGN_V2.md, and the completed Wave 1-2 implementation first.

Continue with Wave 3 only. Reuse the established tokens, shell, tables, cards, menus, filters, drawers, and states.

Refactor:
- apps/web/src/features/dashboard/DashboardPages.tsx
- apps/web/src/features/monitoring/AdminMonitoringPage.tsx
- apps/web/src/features/monitoring/CompanyMonitoringPage.tsx
- apps/web/src/features/monitoring/components/*
- apps/web/src/features/alarms/AlarmOperationsPages.tsx
- apps/web/src/features/reports/ReportsPage.tsx
- apps/web/src/features/settings/SettingsPages.tsx
- related tests

Monitoring constraints:
- preserve the three legacy image-first node-type selection cards and assets;
- preserve node type selection behavior and routes;
- keep NodeStateCard compact;
- preserve five node cards per row on large desktop where the current contract expects it;
- preserve status top line, subtle tinted background, and semantic status shadow;
- preserve table/card switch, realtime behavior, detail drawer, and history chart behavior;
- do not make monitoring cards large or decorative;
- keep critical values immediately scannable;
- show offline/reconnecting states clearly without continuous distracting animation.

Dashboard goals:
- reduce empty card space;
- improve KPI hierarchy and trend context;
- use a useful operations summary rather than decorative charts;
- make filters compact and consistent.

Alarm goals:
- make severity, scope, count/interval evidence, and state easy to scan;
- keep acknowledge/resolve permission logic;
- put workflow actions in the detail context rather than exposing many buttons in the list.

Report goals:
- make report type, filters, job state, progress, download, and failure reason clear;
- keep view/export permissions separate.

Settings goals:
- use clear sections, descriptions, safe defaults, and consistent save footers;
- keep dangerous global actions separated and confirmed.

Capture screenshots, run relevant checks, report exact results, and stop before final QA.
```

## Prompt 4 - final visual QA and consistency pass

```text
Read AGENTS.md and all redesign documents. Perform Wave 4 only: a final visual QA, responsive, accessibility, and consistency pass across the completed GSS IoT V3 redesign.

Do not introduce a new visual direction. Fix drift and defects in the established system.

Audit every active route for:
- page hierarchy;
- action hierarchy;
- exposed destructive actions;
- raw statuses;
- inconsistent modal/drawer footers;
- loading/empty/error/forbidden/session states;
- mobile overflow;
- keyboard navigation and focus;
- color-only status;
- duplicated route-specific styles;
- large empty cards;
- inconsistent table density;
- missing permission hiding;
- missing business-blocker explanations.

Capture final screenshots at 1440x900, 1280x800, and 390x844. Add focused visual smoke tests where stable. Run the full repository quality gates and git diff --check.

At the end provide a route-by-route QA matrix, exact commands/results, remaining issues, and a concise release-readiness recommendation.
```
