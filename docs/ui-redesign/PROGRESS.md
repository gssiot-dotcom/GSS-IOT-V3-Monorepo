# GSS IoT V3 UI Redesign Progress

This document tracks the UI redesign requested in the attached task. It is intentionally separate from `docs/planning/PROJECT_STATE.md`, `TODO.md`, and `EXECUTION_STATE.md`; those project phase statuses are not changed by this work.

## Baseline

- Starting commit: `5b47a60cd7501e3ac1eea305029db8e7135042a8`
- Branch: `refactor/pre-phase-14`
- Baseline working tree: clean
- Protected fixes confirmed in baseline: monitoring status/card layout and visual diagnostics, sidebar scroll behavior, gateway-command loading behavior, i18n additions, and related tests.
- Existing production stack: React 19, Vite, TypeScript, Mantine 9, Tabler Icons, React Router, `@gss-iot/ui`.
- Scope protection: no backend, Prisma, contracts, RBAC, company scope, MQTT, alarm, notification, report, or global project-phase behavior changes are allowed.

## Phase status

| Phase | Status | Evidence / notes |
| --- | --- | --- |
| 0 — audit | Complete before this implementation run | Current frontend/page-pattern audit and visual baseline were captured in the preceding task. |
| 1 — foundations | Complete | Semantic light/dark tokens, focus/interaction tokens, status parity, and global responsive/reduced-motion CSS are implemented. |
| 2 — application shell | Pending | Permission-filtered navigation and active route contracts remain protected. |
| 3 — shared primitives | In progress | Reusable layout, entity, form, data, chart, and status primitives are being added. |
| 4 — entity collections | Pending | Companies, sites, buildings, and building-selection collections are card-first candidates. |
| 5 — contextual workspaces/forms | Pending | Admin company workspace and complex editors are the primary candidates. |
| 6 — devices/commands | Pending | Dense inventories and command histories remain tables. |
| 7 — monitoring | Pending | Latest/history/alarm-level/fault-filter tabs remain unchanged. |
| 8 — alarms/notifications/reports | Pending | Histories remain dense tables; complex editors use structured workspace patterns. |
| 9 — responsive/accessibility/polish | Pending | Required viewport and keyboard/contrast checks are tracked in `VERIFICATION.md`. |
| Verification Pass 1 | Pending | |
| Verification Pass 2 | Pending | |

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
- `apps/web/src/features/reports/ReportsPage.tsx`
- `apps/web/src/features/settings/SettingsPages.tsx`
- `apps/web/src/features/shell/PortalLayout.tsx`

Monitoring feature files are protected from interaction-model changes; only visual/shared primitive integration is permitted there.

## Verification log

Detailed command output, screenshot paths, traceability, and independent audit findings are maintained in `VERIFICATION.md` and `REQUIREMENTS_TRACEABILITY.md`.
