# GSS IoT V3 Visual Refinement Verification

This document records the two verification passes for the focused visual refinement that starts from `093dc0ca135412a3c902d0f682683a20a4cce930`. It does not change implementation-phase statuses or the approved UI redesign status documents.

## Requirement matrix — Verification Pass 1

| Requirement                                                                    | Changed component/file                                                                     | Affected route                                        | Light-mode evidence                                                | Dark-mode evidence                                       | Test evidence                                                        | Screenshot evidence                                                               | Result | Notes                                                                                                                                              |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rich controlled semantic palette with light/dark parity                        | `packages/ui/src/theme.ts`, `apps/web/src/styles/global.css`                               | All Admin/Company routes                              | `gssSemanticTokens` parity test; light captures                    | Dark token parity test; deep navy captures               | UI theme unit tests; typecheck                                       | `admin-companies-light-*`, `admin-companies-dark-*`                               | PASS   | Brand families are blue, cyan, indigo, violet, teal; operational colors remain semantic.                                                           |
| Text hierarchy and readable Korean/English rendering                           | `packages/ui/src/theme.ts`, `global.css`, shared page/dashboard primitives                 | All shell, dashboard, monitoring, form routes         | Light dashboard/company/workspace captures                         | Dark dashboard/company/workspace captures                | Unit suite; lint; typecheck                                          | Required-width dashboard/workspace captures                                       | PASS   | Heading/body/secondary/muted/disabled and status roles are shared; no feature-page color literals were introduced.                                 |
| Modern button variants and interaction states                                  | `packages/ui/src/button.tsx`, `packages/ui/src/index.ts`, `global.css`, `PortalLayout.tsx` | Shell actions, dashboard actions, workspace actions   | Light shell/workspace/form captures                                | Dark shell/workspace captures                            | `packages/ui/test/button.spec.tsx`; unit suite                       | `admin-company-workspace-light-*`, dark equivalents                               | PASS   | Primary is the only restrained gradient; secondary, outline, ghost, soft, danger and icon actions stay quiet.                                      |
| Rich metric cards and section identity                                         | `packages/ui/src/dashboard-primitives.tsx`, `DashboardPages.tsx`                           | `/admin/dashboard`, `/company/dashboard`              | Dashboard captures at 1440 and 375                                 | Dark shell captures and dark dashboard verification      | Web unit suite; lint; typecheck                                      | `admin-dashboard-light-*`, `company-dashboard-light-*` plus dark shell captures   | PASS   | Accents are deterministic by category; no invented trends or analytics.                                                                            |
| Rich monitoring header/summary presentation while preserving tabs              | `AdminMonitoringPage.tsx`, `CompanyMonitoringPage.tsx`, shared dashboard primitives        | Admin/company monitoring and node monitoring          | Company monitoring and node captures at all five widths            | Dark company monitoring/node captures at all five widths | Monitoring unit suite; web unit suite                                | `company-monitoring-selection-*`, `company-monitoring-door-node-*`, tab captures  | PASS   | Latest States, History, Alarm Levels and Fault Filters labels and route behavior are unchanged; realtime/socket and status logic were not changed. |
| Persistent route-backed Admin company inner workspace                          | `AdminCompanyDetailPage.tsx`, `router.tsx`, `auth-routing.spec.tsx`, `global.css`          | `/admin/companies/:companyId` and approved child URLs | Overview/Sites/Buildings/Users/Devices captures at all five widths | Workspace dark captures at all five widths               | Focused mount/request test; web unit suite; typecheck                | `admin-company-workspace-*`, `admin-company-{sites,buildings,users,devices}-*`    | PASS   | Parent has Outlet child routes, stable mount marker, and guarded shared-load key. Existing URLs and permission guards remain unchanged.            |
| Production light/dark mode with toggle, persistence, system fallback, no flash | `apps/web/index.html`, `main.tsx`, `PortalLayout.tsx`, `i18n.ts`, `shell-theme.spec.tsx`   | Admin, Company, no-permission shell                   | Light captures and light persistence assertion                     | Dark captures, toggle assertion, system fallback test    | Shell theme unit tests; e2e toggle/persistence                       | `admin-companies-dark-*`, `admin-company-workspace-dark-*`, company dark captures | PASS   | Toggle is adjacent to notification bell, has tooltip/aria label, is permission-free, preserves route state, and prehydrates Mantine color scheme.  |
| Responsive/accessibility/reduced-motion safety                                 | `global.css`, `page-header.tsx`, shared primitives, shell                                  | 375/768/1024/1280/1440 shell and workspace routes     | Five-width light capture matrix                                    | Five-width dark capture matrix                           | Full unit suite; lint; typecheck; e2e horizontal-overflow assertions | Required-width captures and no-permission 375 capture                             | PASS   | Mobile company workspace uses a stacked header and contextual navigation; focus styles and reduced-motion rules remain active.                     |

## Verification Pass 1 findings and fixes

1. The first dark capture still inherited Mantine’s default body color through inline `var(--mantine-color-body)` shell styles. The shell now uses the GSS semantic app background and surface variables.
2. The first mobile workspace capture showed the company title collapsing to one character per line. The shared `PageHeader` now switches to a block layout below 600px, with actions below the title.
3. The browser initially consumed the built `@gss-iot/ui` entrypoint, so the shared package was rebuilt before visual review.
4. The deterministic monitoring fixture omitted `batteryLevel`; the fixture now supplies a real-shaped value so screenshots do not contain `undefined%`.
5. The expanded visual fixture initially lacked report-list and alarm-rule option response envelopes. It now returns the existing empty-list contracts and does not alter production code or API contracts.

## Verification Pass 2

Pass 2 independently reviewed the complete diff from `093dc0ca135412a3c902d0f682683a20a4cce930`, the light/dark visual captures, route/layout behavior, and shared-token usage.

- Hardcoded color search: PASS. New feature pages consume shared semantic classes/tokens; remaining hex values are centralized token definitions in `packages/ui/src/theme.ts` and `apps/web/src/styles/global.css`.
- Gradient search: PASS. One restrained primary-button gradient remains; no page-wide decorative gradient was added.
- Shadow search: PASS. Shared Mantine/card shadows remain restrained; the contextual inner sidebar explicitly removes floating-card shadow.
- Status-color review: PASS. Safe/caution/warning/danger/offline colors are used for real statuses or status counts; metric identity accents do not reuse alarm severity colors.
- Button review: PASS. Primary, secondary, outline, ghost, soft, danger, icon, hover, pressed, disabled, focus, touch-target and reduced-motion rules are covered by shared primitives/styles.
- Dashboard/monitoring review: PASS. Section headers and summary cards have identity; no fake trend data or charts were introduced.
- Table/form review: PASS. Light and dark surfaces, borders, inputs, table headers and row separation remain readable in captured routes and the full web unit suite.
- Theme review: PASS. Header toggle works without navigation reset; persistence and system fallback are covered; Admin, Company, and no-permission shell paths retain the same theme controls.
- Workspace review: PASS. Child navigation uses nested Outlet routes; the mount/request test proves the parent instance remains stable and the shared company request is not duplicated during inner navigation.
- Route/security review: PASS. Existing route URLs, `RequireAuth`, `RequirePermission`, `Can`, `hasPermission`, sidebar filtering, context separation, and scope-aware API call behavior were preserved.

## Commands and results

- `pnpm format:check` — PASS
- `pnpm lint` — PASS
- `pnpm typecheck` — PASS
- `pnpm --filter ui test:unit` — PASS, 4 files / 11 tests
- `pnpm --filter web test:unit` — PASS, 15 files / 65 tests
- `pnpm build` — PASS; Vite emitted only the existing chunk-size warning
- `git diff --check` — PASS
- `pnpm --filter web test:e2e` — PASS, 7 tests; final run 4.2 minutes. This includes the expanded light/dark visual matrix, monitoring tab captures, theme persistence, no-permission shell, and bootstrap regression checks.

## Visual evidence locations

Screenshots are in the Playwright output folders under `test-results/`, including:

- `ui-redesign.visual-capture-e952f-gn-pages-at-required-widths/` — light Admin/Company route matrix;
- `ui-redesign.visual-capture-a58dd-nd-theme-toggle-interaction/` — dark Admin/Company route matrix and theme toggle assertions.

The matrix includes the five required widths for the core shell, Admin company workspace and monitoring routes, with desktop/mobile evidence for dashboard, alarms, reports and form workspaces. Monitoring tab captures cover Latest States, History, Alarm Levels and Fault Filters in both schemes.

## Reference limitation

No accessible old GSS V2 dark-mode implementation or visual bundle was found in the repository or the installed dashboard skill. The dark palette was derived from the current GSS semantic system and the bundled SnowUI/Dashboard X visual references, without copying their implementation.

## Dark Surface Color Correction

This focused correction starts from `35cfaf258f8562808c4520d01ac7b98ec85b42d0` and addresses the remaining warm neutral surfaces in dark mode without changing the completed redesign architecture.

### Root cause

The audit found that Mantine defaults were bypassing the GSS semantic surface system. Profile menus, sidebar hover states, and striped tables resolved to Mantine `--mantine-color-dark-6` (`#2e2e2e`), while table hover resolved to `--mantine-color-dark-5` (`#3b3b3b`). Those roles were not represented by GSS tokens, so unrelated dark surfaces collapsed into a warm neutral gray despite the navy application background.

### Correction

The fix adds shared semantic roles and maps the affected Mantine/shared selectors to cool layered navy values:

| Role                                 | Light     | Dark      |
| ------------------------------------ | --------- | --------- |
| `elevatedSurface` / `popoverSurface` | `#ffffff` | `#1b3049` |
| `interactiveSurface`                 | `#f8fafd` | `#1a2e47` |
| `hoverSurface` / `tableHover`        | `#f0f7ff` | `#1d3855` |
| `selectedSurface` / `tableSelected`  | `#e5f1ff` | `#20486c` |
| `tableStripe`                        | `#f8fafd` | `#14283e` |

The affected shared components are Mantine menus, popovers, comboboxes, hover cards and tooltips; the PortalLayout shell and contextual navigation; shared and raw Mantine tables; gateway-command, alarm, report and user table surfaces; command drawers/modals; secondary/ghost button surfaces; and disabled Mantine/GSS buttons. Light values retain the prior visual roles. Operational status colors and their meanings are unchanged.

### Verification Pass 1

- Confirmed the clean baseline and captured computed styles before the change.
- Added semantic token parity and status-preservation assertions in `packages/ui/test/theme.spec.ts`.
- Added browser assertions proving the menu, menu text/label, sidebar hover, table stripe, table hover and selected row use the cool GSS roles rather than Mantine warm defaults.
- Added deterministic gateway-command, alarm, report and user fixture rows so table and drawer evidence is inspectable without inventing production data.
- Added dark and light evidence capture coverage for profile dropdowns, sidebar/mobile navigation, alarms, gateway commands, reports and a command drawer at 1440, 768 and 375 widths.

### Verification Pass 2

- Independently reviewed the complete focused diff from `35cfaf258f8562808c4520d01ac7b98ec85b42d0`.
- Confirmed the only `#2e2e2e`/`#3b3b3b` references are audit/rejection assertions; production selectors consume semantic variables.
- Confirmed no new broad gradients, muddy shadows, decorative status colors, backend/API/RBAC/route/business-logic changes or planning-status edits.
- Re-inspected dark and light profile, sidebar, table and drawer evidence, including mobile contextual navigation. Final command, visual and documentation gates are recorded with the task handoff.

### Focused evidence

The focused Playwright output is retained under `apps/web/test-results/ui-redesign.visual-surface-dark-correction/` after the final capture run, including `surface-profile-dropdown-*`, `surface-sidebar-hover-*`, `surface-mobile-sidebar-*`, `surface-alarms-table-*`, `surface-gateway-commands-*`, `surface-reports-table-*`, and `surface-command-drawer-*` for both schemes and all three widths. Earlier light/dark route-matrix evidence remains under `test-results/ui-redesign.visual-capture-e952f-gn-pages-at-required-widths/` and `test-results/ui-redesign.visual-capture-a58dd-nd-theme-toggle-interaction/`.

### Focused correction gate results

- `pnpm format:check` — PASS
- `pnpm lint` — PASS
- `pnpm typecheck` — PASS
- `pnpm --filter ui test:unit` — PASS, 4 files / 12 tests
- `pnpm --filter web test:unit` — PASS, 15 files / 65 tests
- `pnpm --filter ui build` — PASS
- `pnpm build` — PASS; only the existing Vite chunk-size warning was emitted
- `pnpm --filter web test:e2e` — PASS, 9 tests in 4.9 minutes
- `git diff --check` — PASS

The initial parallel unit invocation was discarded because unrelated existing device tests hit their 5-second timeout under concurrent repository load; the authoritative serial web-unit rerun passed 65/65.

### Verification Pass 3 — Wave 4 final QA

Pass 3 reviewed the final Admin and Company route inventory, exact responsive
viewports, mobile table/card fallbacks, semantic status consistency, realtime
indicator duplication, report/dashboard overflow, action reachability, and
existing loading/empty/error/forbidden/session states. The concrete findings
and fixes are recorded in `WAVE4_FINAL_VERIFICATION.md`.

Focused production checks pass. The aggregate web E2E runner still times out
inside the pre-existing dark shared-surface multi-route evidence helper, so
overall redesign release readiness remains conditional until that harness
issue is resolved or explicitly accepted.
