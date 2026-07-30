# GSS IoT V3 — Korean/English i18n audit

Date: 2026-07-30

## Scope and protected behavior

This audit covers all user-visible text in `apps/web`, `packages/ui`, frontend-visible API errors,
alarm notifications, permission descriptions, report/export content, accessibility labels and
locale-sensitive formatting. It does not translate user-created names, email addresses, device
identifiers, UUIDs, permission keys, API routes, MQTT topics/payloads, protocol values or audit
action codes.

The existing GSS/Company RBAC split, permission and scope guards, MQTT command outbox, alarm
occurrence semantics and two-tier Archive/Purge/Retention behavior are unchanged.

## Baseline findings

| Surface                         |                          Baseline | Required correction                                                  |
| ------------------------------- | --------------------------------: | -------------------------------------------------------------------- |
| Web translation catalog         |             938 English-only keys | Typed Korean and English catalogs with exact key parity              |
| Runtime locale                  |                              None | Korean default, persisted runtime switch, `html lang` update         |
| Dynamic key safety bypasses     |               30 `as never` calls | Typed dynamic-key helpers and audit coverage                         |
| Frontend-visible API exceptions |         272 sites in 32 API files | Stable-code/status localization; never prefer raw backend English    |
| DTO validation decorators       |                               508 | Localized frontend validation/fallback without exposing internals    |
| Report/export headers           |               125 English headers | Request-locale snapshot and localized headers/display enums          |
| Permission catalog              |           92 English descriptions | Localized display metadata; permission keys remain raw               |
| Implicit locale formatting      | 18 direct calls; 22 total matches | Explicit `ko-KR` / `en-US` formatters                                |
| Existing web tests              |                   90 Vitest tests | Deterministic locale provider plus bilingual representative coverage |
| Existing browser tests          |               23 Playwright tests | Korean/English route, persistence, keyboard and viewport matrix      |

## High-risk file inventory

- Catalog/runtime: `apps/web/src/app/i18n.ts`, `apps/web/src/main.tsx`, `apps/web/index.html`.
- Header controls: `apps/web/src/features/shell/PortalLayout.tsx`.
- Raw API errors: `apps/web/src/shared/api/api-client.ts`,
  `apps/web/src/shared/auth/auth-api.ts`, plus Archive, Alarm, Company management, Organization,
  Report, Sensor History and Administrator mutation pages.
- System notifications: `apps/api/src/modules/alarms/alarm-notification-dispatch.service.ts` and
  `apps/web/src/features/alarms/AlarmOperationsPages.tsx`.
- Report/export content: `apps/api/src/modules/reports/report-data-query.service.ts`,
  `report-job-processor.service.ts`, `report-formatters.service.ts`, report controllers/service and
  `apps/web/src/features/reports/ReportsPage.tsx`.
- Permission display: `apps/api/prisma/seed.ts` and
  `apps/web/src/features/permissions/PermissionCatalogPage.tsx`.
- Raw node-type display names: device, monitoring, alarm, report and organization page families;
  display must map the stable `door_node`, `angle_node`, `gangform_node` keys.
- Locale-less dates: Dashboard, Reports, Gateway Commands, Archive, Sensor History, monitoring
  charts/drawers, building images, profile and Administrator surfaces.

## Page-family inventory

The catalog and visual verification matrix includes:

- shared login, session, Admin/Company shell, navigation, account, notification and theme controls;
- dashboard KPIs, charts, summaries and recent reports;
- companies, sites, buildings, images, users, roles, positions, permissions and confirmations;
- device inventory, assignments, provisioning and gateway-command lifecycle;
- Admin/Company monitoring, realtime states, node cards, Sensor History and media viewers;
- alarm levels, rules, recipient policies, occurrence evidence, events and notifications;
- reports, Archive Center, purge/retention jobs and downloads;
- GSS administrators, settings, provider/readiness states and universal UI states.

## Responsive and accessibility risks

The 390×844 header already contains the burger/brand plus notification, theme and account controls.
The language selector must be adjacent to and immediately before theme, while lower-priority route
or realtime text may collapse to prevent overlap. Tests must verify visible focus, keyboard menu
operation, localized tooltip/accessible names, selected state, in-viewport menus and no horizontal
document overflow at 1440×900, 1280×800 and 390×844.

## Regression-prevention contract

The repository i18n audit must fail on catalog key mismatch, missing keys, visible translation-key
leakage, suspicious TSX text/placeholder/accessibility literals, raw enum presentation and
user-facing implicit-locale formatting. The allowlist is intentionally small and limited to product,
protocol, file-extension, hardware/test-id and developer-log values.

## Completion evidence

- Korean and English catalogs contain 1,026 identical typed keys with placeholder parity.
- Dynamic display keys use the checked `tx()` boundary; no translation call uses an `as never` cast.
- Application code has no implicit browser-locale date/time/number formatter.
- `pnpm i18n:audit`, workspace typecheck, zero-warning lint, changed-file Prettier check and the
  production build pass.
- Workspace unit tests pass 180/180; API E2E passes 86/86 on the isolated schema; Web Playwright
  passes 24/24.
- Twelve bilingual Admin/Company screenshots cover 1440×900, 1280×800 and 390×844 with
  programmatic horizontal-overflow assertions.
