# Phased Redesign Workflow

## Wave 0 - audit and baseline

1. Inspect current code, design documents, route inventory, permissions, and tests.
2. Create `docs/design/UI_REDESIGN_AUDIT.md` with file-specific findings grouped by shell, tokens, actions, tables, forms, states, responsive behavior, and accessibility.
3. Capture baseline screenshots at 1440x900, 1280x800, and 390x844 when the environment permits.
4. Define the revised visual contract in `docs/design/UI_REDESIGN_V2.md`.
5. Do not change business behavior.

## Wave 1 - foundations and the worst action-placement pages

Change shared foundations first:

```txt
packages/ui/src/theme.ts
packages/ui/src/page-header.tsx
packages/ui/src/data-table.tsx
packages/ui/src/dashboard-primitives.tsx
packages/ui/src/status-badge.tsx
packages/ui/src/app-states.tsx
packages/ui/src/index.ts
apps/web/src/styles/global.css
apps/web/src/features/shell/PortalLayout.tsx
apps/web/src/features/shell/DesignSystemDemoPage.tsx
```

Add or refine reusable primitives as justified:

```txt
EntityPrimaryCell
EntityStatusBadge
EntityActionMenu
ConfirmActionModal
FilterToolbar
ModalFormFooter
Surface/WorkspaceCard
SkeletonTable
ResponsiveEntityList
```

Then refactor representative problem pages:

```txt
apps/web/src/features/organizations/CompaniesPage.tsx
apps/web/src/features/organizations/AdminCompanyDetailPage.tsx
apps/web/src/features/organizations/CompanyResourcesPage.tsx
apps/web/src/features/company-management/CompanyUsersPage.tsx
```

Stop after visual review of Wave 1.

## Wave 2 - devices and organization details

Refactor:

```txt
apps/web/src/features/devices/AdminDevicesPage.tsx
apps/web/src/features/devices/CompanyDevicesPage.tsx
apps/web/src/features/gateway-commands/GatewayCommandsPage.tsx
apps/web/src/features/organizations/CompanyResourceDetailPages.tsx
apps/web/src/features/company-management/CompanyRolesPage.tsx
```

Focus on inventory density, lifecycle status, assignment history, contextual actions, drawers, and confirmation flows.

## Wave 3 - operations

Refactor:

```txt
apps/web/src/features/dashboard/DashboardPages.tsx
apps/web/src/features/monitoring/AdminMonitoringPage.tsx
apps/web/src/features/monitoring/CompanyMonitoringPage.tsx
apps/web/src/features/monitoring/components/*
apps/web/src/features/alarms/AlarmOperationsPages.tsx
apps/web/src/features/reports/ReportsPage.tsx
apps/web/src/features/settings/SettingsPages.tsx
```

Preserve monitoring constraints:

- three legacy image-first type cards;
- compact node cards;
- five cards per row on large desktop where the current monitoring contract expects it;
- status top line, tint, and shadow semantics;
- table/card switch and detail drawer;
- realtime and permission behavior.

## Wave 4 - visual QA and hardening

1. Remove route-specific visual drift and duplicated inline styles.
2. Verify all loading, empty, error, forbidden, expired-session, offline, reconnecting, and no-permission states.
3. Verify responsive behavior and action discoverability.
4. Add or update unit tests for action menus, confirmation dialogs, status labels, and permission visibility.
5. Capture after screenshots and compare against the baseline.
6. Run the full quality gates.

## Quality commands

Use actual repository scripts. Expected commands include:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter web test:e2e
git diff --check
```

If authenticated E2E fixtures are unavailable, use test-only API/session fixtures. Do not weaken production authentication to obtain screenshots.
