# GSS IoT V3 Visual Refinement Verification

This document records the two verification passes for the focused visual refinement that starts from `093dc0ca135412a3c902d0f682683a20a4cce930`. It does not change implementation-phase statuses or the approved UI redesign status documents.

## Requirement matrix — Verification Pass 1

| Requirement | Changed component/file | Affected route | Light-mode evidence | Dark-mode evidence | Test evidence | Screenshot evidence | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| Rich controlled semantic palette with light/dark parity | `packages/ui/src/theme.ts`, `apps/web/src/styles/global.css` | All Admin/Company routes | `gssSemanticTokens` parity test; light captures | Dark token parity test; deep navy captures | UI theme unit tests; typecheck | `admin-companies-light-*`, `admin-companies-dark-*` | PASS | Brand families are blue, cyan, indigo, violet, teal; operational colors remain semantic. |
| Text hierarchy and readable Korean/English rendering | `packages/ui/src/theme.ts`, `global.css`, shared page/dashboard primitives | All shell, dashboard, monitoring, form routes | Light dashboard/company/workspace captures | Dark dashboard/company/workspace captures | Unit suite; lint; typecheck | Required-width dashboard/workspace captures | PASS | Heading/body/secondary/muted/disabled and status roles are shared; no feature-page color literals were introduced. |
| Modern button variants and interaction states | `packages/ui/src/button.tsx`, `packages/ui/src/index.ts`, `global.css`, `PortalLayout.tsx` | Shell actions, dashboard actions, workspace actions | Light shell/workspace/form captures | Dark shell/workspace captures | `packages/ui/test/button.spec.tsx`; unit suite | `admin-company-workspace-light-*`, dark equivalents | PASS | Primary is the only restrained gradient; secondary, outline, ghost, soft, danger and icon actions stay quiet. |
| Rich metric cards and section identity | `packages/ui/src/dashboard-primitives.tsx`, `DashboardPages.tsx` | `/admin/dashboard`, `/company/dashboard` | Dashboard captures at 1440 and 375 | Dark shell captures and dark dashboard verification | Web unit suite; lint; typecheck | `admin-dashboard-light-*`, `company-dashboard-light-*` plus dark shell captures | PASS | Accents are deterministic by category; no invented trends or analytics. |
| Rich monitoring header/summary presentation while preserving tabs | `AdminMonitoringPage.tsx`, `CompanyMonitoringPage.tsx`, shared dashboard primitives | Admin/company monitoring and node monitoring | Company monitoring and node captures at all five widths | Dark company monitoring/node captures at all five widths | Monitoring unit suite; web unit suite | `company-monitoring-selection-*`, `company-monitoring-door-node-*`, tab captures | PASS | Latest States, History, Alarm Levels and Fault Filters labels and route behavior are unchanged; realtime/socket and status logic were not changed. |
| Persistent route-backed Admin company inner workspace | `AdminCompanyDetailPage.tsx`, `router.tsx`, `auth-routing.spec.tsx`, `global.css` | `/admin/companies/:companyId` and approved child URLs | Overview/Sites/Buildings/Users/Devices captures at all five widths | Workspace dark captures at all five widths | Focused mount/request test; web unit suite; typecheck | `admin-company-workspace-*`, `admin-company-{sites,buildings,users,devices}-*` | PASS | Parent has Outlet child routes, stable mount marker, and guarded shared-load key. Existing URLs and permission guards remain unchanged. |
| Production light/dark mode with toggle, persistence, system fallback, no flash | `apps/web/index.html`, `main.tsx`, `PortalLayout.tsx`, `i18n.ts`, `shell-theme.spec.tsx` | Admin, Company, no-permission shell | Light captures and light persistence assertion | Dark captures, toggle assertion, system fallback test | Shell theme unit tests; e2e toggle/persistence | `admin-companies-dark-*`, `admin-company-workspace-dark-*`, company dark captures | PASS | Toggle is adjacent to notification bell, has tooltip/aria label, is permission-free, preserves route state, and prehydrates Mantine color scheme. |
| Responsive/accessibility/reduced-motion safety | `global.css`, `page-header.tsx`, shared primitives, shell | 375/768/1024/1280/1440 shell and workspace routes | Five-width light capture matrix | Five-width dark capture matrix | Full unit suite; lint; typecheck; e2e horizontal-overflow assertions | Required-width captures and no-permission 375 capture | PASS | Mobile company workspace uses a stacked header and contextual navigation; focus styles and reduced-motion rules remain active. |

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
