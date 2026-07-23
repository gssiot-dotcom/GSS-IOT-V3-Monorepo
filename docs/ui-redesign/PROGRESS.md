# GSS IoT V3 UI Redesign Progress

This document tracks the UI redesign requested in the attached task. It is intentionally separate from `docs/planning/PROJECT_STATE.md`, `TODO.md`, and `EXECUTION_STATE.md`; those project phase statuses are not changed by this work.

The durable Phase 0 reference is `docs/ui-redesign/PHASE0_AUDIT.md`.

## Baseline

- Starting commit: `5b47a60cd7501e3ac1eea305029db8e7135042a8`
- Branch: `refactor/pre-phase-14`
- Baseline working tree: clean
- Protected fixes confirmed in baseline: monitoring status/card layout and visual diagnostics, sidebar scroll behavior, gateway-command loading behavior, i18n additions, and related tests.
- Existing production stack: React 19, Vite, TypeScript, Mantine 9, Tabler Icons, React Router, `@gss-iot/ui`.
- Scope protection: no backend, Prisma, contracts, RBAC, company scope, MQTT, alarm, notification, report, or global project-phase behavior changes are allowed.

## Phase status

| Phase                               | Status                                  | Evidence / notes                                                                                                                                                                                                                                                                              |
| ----------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — audit                           | Complete before this implementation run | Current frontend/page-pattern audit and visual baseline were captured in the preceding task.                                                                                                                                                                                                  |
| 1 — foundations                     | Complete                                | Semantic light/dark tokens, focus/interaction tokens, status parity, and global responsive/reduced-motion CSS are implemented.                                                                                                                                                                |
| 2 — application shell               | Complete                                | Redesigned Admin/Company shell with branded portal context, breadcrumb-like page context, responsive drawer behavior, preserved hidden-scrollbar viewport, active states, notification gating, account menu, and permission-filtered navigation.                                              |
| 3 — shared primitives               | Complete                                | Reusable layout, entity, form, data, chart, and status primitives are exported from `@gss-iot/ui`; package tests cover their public shape.                                                                                                                                                    |
| 4 — entity collections              | Complete                                | Companies, company sites, company buildings, Admin company-detail site/building sections, and Company monitoring building selection are card-first; same records and permission-gated actions are preserved.                                                                                  |
| 5 — contextual workspaces/forms     | Complete                                | Admin company detail uses route-backed inner navigation; user, role, and alarm-rule editors use shared structured form sections and sticky actions while retaining current routes and modal contracts.                                                                                        |
| 6 — devices/commands                | Complete                                | Device inventories and gateway command history remain dense tables; shared table hierarchy, command status summary, polling behavior, requestId/cmd drawer details, and existing permission-gated retry/cancel actions are preserved.                                                         |
| 7 — monitoring                      | Complete                                | Existing five-node-card target, status tint/top line/shadow, card/table toggle, detail drawer, Socket.IO behavior, and latest/history/alarm-level/fault-filter tabs remain protected; the toggle now reuses the shared data-view primitive and node cards expose semantic status data for QA. |
| 8 — alarms/notifications/reports    | Complete                                | Alarm, notification, report, and command histories remain dense tables with permission-aware actions; alarm-rule creation uses structured form sections and occurrence/count-interval evidence remains in current detail surfaces.                                                            |
| 9 — responsive/accessibility/polish | Complete                                | Shared responsive/reduced-motion/focus styling, semantic status data, no-overflow assertions, and deterministic protected visual capture are implemented; final verification passes remain.                                                                                                   |
| Verification Pass 1                 | Complete                                | Full route/permission/visual/quality audit documented in `VERIFICATION.md`; all required checks passed.                                                                                                                                                                                       |
| Verification Pass 2                 | Complete                                | Independent diff, UX, RBAC/scope, realtime, responsive, and protected-fixture audit completed with no additional defect.                                                                                                                                                                      |

## Phase file plans

### Phase 1–3

- `packages/ui/src/theme.ts`
- `packages/ui/src/layout-primitives.tsx`
- `packages/ui/src/entity-primitives.tsx`
- `packages/ui/src/form-primitives.tsx`
- `packages/ui/src/data-table.tsx`
- `packages/ui/src/index.ts`
- `apps/web/src/styles/global.css`
- `apps/web/src/features/shell/DesignSystemDemoPage.tsx`
- related UI/web unit tests

### Phase 4–8

The exact page files are recorded before each phase is implemented and updated here after the phase commit. Current approved targets are:

- `apps/web/src/features/organizations/CompaniesPage.tsx`
- `apps/web/src/features/organizations/CompanyResourcesPage.tsx`
- `apps/web/src/features/organizations/AdminCompanyDetailPage.tsx`
- `apps/web/src/features/organizations/CompanyResourceDetailPages.tsx`
- `apps/web/src/features/company-management/CompanyUsersPage.tsx`
- `apps/web/src/features/company-management/CompanyRolesPage.tsx`
- `apps/web/src/features/devices/AdminDevicesPage.tsx`
- `apps/web/src/features/devices/CompanyDevicesPage.tsx`
- `apps/web/src/features/gateway-commands/GatewayCommandsPage.tsx`
- `apps/web/src/features/alarms/AlarmOperationsPages.tsx`

Implemented in Phase 6:

- `packages/ui/src/data-table.tsx`
- `packages/ui/src/status-badge.tsx`
- `apps/web/src/styles/global.css`
- `apps/web/src/features/gateway-commands/GatewayCommandsPage.tsx`
- `apps/web/src/features/reports/ReportsPage.tsx`
- `apps/web/src/features/settings/SettingsPages.tsx`
- `apps/web/src/features/shell/PortalLayout.tsx`

Monitoring feature files are protected from interaction-model changes; only visual/shared primitive integration is permitted there.

Implemented in Phases 4–5:

- `apps/web/src/app/i18n.ts`
- `apps/web/src/features/organizations/CompaniesPage.tsx`
- `apps/web/src/features/organizations/CompanyResourcesPage.tsx`
- `apps/web/src/features/organizations/AdminCompanyDetailPage.tsx`
- `apps/web/src/features/monitoring/CompanyMonitoringPage.tsx`
- `apps/web/src/features/company-management/CompanyUsersPage.tsx`
- `apps/web/src/features/company-management/CompanyRolesPage.tsx`
- `apps/web/src/features/alarms/AlarmOperationsPages.tsx`

## Verification log

Detailed command output, screenshot paths, traceability, and independent audit findings are maintained in `VERIFICATION.md` and `REQUIREMENTS_TRACEABILITY.md`.
