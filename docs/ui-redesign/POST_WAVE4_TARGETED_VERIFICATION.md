# Targeted post-Wave-4 correction verification

Date: 2026-07-25

## Scope and boundary

This handoff covers only the feedback-driven dashboard/monitoring corrections
and the read-only Permission Catalog vertical slice. It does not start Wave 5 or
Phase 14 and does not change MQTT, alarm occurrence logic, production storage,
deployment or retention behavior.

The worktree was already dirty at preflight. Existing Wave 4 edits in dashboard,
monitoring, reports, settings, visual E2E, planning and UI-redesign documents
were preserved; no reset, checkout, revert or migration-history rewrite was
used. The targeted changes were layered onto the overlapping dashboard,
monitoring, visual-E2E and planning files.

## Implemented files

Shared visual/chart work:

- `packages/ui/src/dashboard-primitives.tsx`
- `apps/web/src/styles/global.css`
- `apps/web/src/shared/ui/ChartTooltip.tsx`
- `apps/web/src/features/dashboard/DashboardPages.tsx`
- `apps/web/src/features/monitoring/AdminMonitoringPage.tsx`
- `apps/web/src/features/monitoring/CompanyMonitoringPage.tsx`
- `apps/web/src/features/monitoring/components/NodeHistoryChart.tsx`

Permission Catalog work:

- `apps/api/src/modules/settings/settings-admin.controller.ts`
- `apps/api/prisma/seed.ts`
- `apps/web/src/features/permissions/PermissionCatalogPage.tsx`
- `apps/web/src/features/shell/navigation.ts`
- `apps/web/src/app/router.tsx`
- `apps/web/src/app/i18n.ts`

Focused verification and supporting strict-TypeScript correction:

- `apps/api/test/e2e/rbac.e2e-spec.ts`
- `apps/web/e2e/ui-redesign.visual.spec.ts`
- `apps/web/src/test/auth-routing.spec.tsx`
- `apps/web/src/test/dashboard.spec.tsx`
- `apps/web/src/test/monitoring.spec.tsx`
- `apps/web/src/test/permission-catalog.spec.tsx`
- `apps/web/src/test/rbac.spec.ts`
- `apps/web/src/test/reports.spec.tsx`

Documentation:

- `docs/design/DESIGN_SYSTEM.md`
- `docs/design/UI_UX_SPEC.md`
- `docs/design/PAGE_INVENTORY.md`
- `docs/planning/PROJECT_STATE.md`
- `docs/planning/TODO.md`
- `docs/planning/DECISION_LOG.md`
- `docs/ui-redesign/POST_WAVE4_TARGETED_VERIFICATION.md`

## Visual decisions

- Dashboard KPI and monitoring summary cards share compact neutral GSS
  surfaces. Six cards are one row at 1280 and 1440; tablet/mobile wrap without
  document overflow.
- Telemetry uses daily UTC count axes, grid, visible/focusable data points,
  primary-soft area and a portal tooltip. The exact KPI remains separate from
  the bounded 10,000-timestamp trend and the UI explains a bounded difference.
- Node-history tooltips are also portal-based and expose full reading metadata
  from either angle series or the door series without changing the bounded
  25-reading request.
- Company monitoring buildings use neutral three/two/one-column whole-card
  entries with one semantic status badge and explicit open-monitoring cue.
- Permission catalogs use a compact desktop table and mobile cards. Technical
  keys are monospace, scope badges remain readable, and there are no mutation
  controls.

## Permission security mapping

| Context   | UI route                      | API                        | Required permission        | Allowed scope types |
| --------- | ----------------------------- | -------------------------- | -------------------------- | ------------------- |
| GSS Admin | `/admin/settings/permissions` | `GET /admin/permissions`   | `permissions.view`         | `GSS`, `BOTH`       |
| Company   | `/company/permissions`        | `GET /company/permissions` | `company-permissions.view` | `COMPANY`, `BOTH`   |

`GET /admin/roles/permissions` remains unchanged for the Admin role editor and
still uses `admin-roles.view`. Navigation hiding is UX only; route guards and
backend permission/context checks are covered independently. No permission
create/update/delete endpoint or UI was added.

## Seed and migration note

`Permission.description` already exists, so no migration was created. The seed
upsert now writes the description on both create and update. Two consecutive
seed runs passed. A read-only Prisma verification of the 89 seeded catalog rows
reported zero empty descriptions, zero descriptions over 120 characters and a
maximum length of 119 characters.

## Visual evidence

The focused visual test produced 42 screenshots under:

`test-results/ui-redesign.visual-capture-95a40--exact-responsive-viewports`

It covers 1440x900, 1280x800, 1024x768 and 390x844 for the required dashboard,
monitoring and Permission Catalog routes, plus open telemetry and angle-history
tooltips. Automated assertions verify one-row desktop KPI/summary layout,
document overflow and tooltip viewport bounds. Representative desktop/mobile
screenshots were also inspected manually.

## Command results

- Relevant web Vitest: passed, 5 files / 27 tests.
- Focused RBAC API E2E: passed, 1 file / 15 tests.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed, 31 files / 120 tests across workspace packages.
- `pnpm build`: passed; Vite retained the existing >500kB chunk-size warning.
- `pnpm --filter api test:e2e`: passed, 7 files / 65 tests; Prisma printed its
  existing package-configuration deprecation warning.
- Focused Playwright exact-viewport visual test: passed, 1/1 in 2.4 minutes.
- Permission seed: passed twice consecutively; 89/89 seeded descriptions are
  non-empty and at most 119 characters.
- `git diff --check`: passed; Git printed line-ending conversion warnings only.
- `pnpm format:check`: failed because 107 pre-existing/out-of-slice repository
  files do not match the current Prettier version. Targeted files were formatted
  directly and checked separately; unrelated files were not bulk-rewritten.
- `pnpm --filter web test:e2e`: did not complete and hit the 604.1-second outer
  timeout in the previously documented aggregate/dark shared-surface harness.
  The remaining Playwright child-process tree was terminated after verifying its
  command line and parent chain. The focused new visual flow remains green.

## Remaining risks

The overall UI redesign is not release-ready while the aggregate web E2E helper
still hangs and the repository-wide Prettier baseline is red. These are recorded
without broadening this targeted correction into a harness or formatting
refactor. Production Phase 14 work remains deferred.
