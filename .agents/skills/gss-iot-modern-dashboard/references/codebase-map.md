# Current GSS IoT V3 Frontend Map

## Snapshot inspected

The uploaded 2026-07-23 archive was inspected on branch `refactor/pre-phase-14` at HEAD `fdf48c3` (`refactor: complete pre-phase-14 tasks 02-13`). The archive also contains working-tree changes in monitoring, gateway commands, the portal shell, global CSS, i18n, and related tests. Always inspect `git status` before redesign work and do not overwrite unrelated changes.

## Stack

- React 19
- TypeScript 5.9
- Vite 8
- Mantine 9
- Tabler Icons
- React Router 7
- Socket.IO client
- pnpm monorepo

## Repository boundaries

```txt
apps/web
  Application routing, auth context, feature composition, API calls, i18n, tests.

packages/ui
  Shared Mantine components, tokens, cards, data table, status badges, app states.

packages/contracts
  Shared contracts and DTO types.
```

## Current shared UI files

```txt
packages/ui/src/theme.ts
packages/ui/src/page-header.tsx
packages/ui/src/data-table.tsx
packages/ui/src/dashboard-primitives.tsx
packages/ui/src/node-type-card.tsx
packages/ui/src/status-badge.tsx
packages/ui/src/realtime-status-badge.tsx
packages/ui/src/app-states.tsx
```

These are a good foundation but are too small for a consistent whole-project redesign. Extend them into explicit layout, navigation, data, entity, form, feedback, monitoring, and chart families.

## Current shell

`apps/web/src/features/shell/PortalLayout.tsx` uses Mantine `AppShell` with:

- 60px header;
- 272px desktop navbar;
- permission-filtered grouped navigation;
- hidden visual scrollbar;
- notification unread count and socket;
- realtime connection badge;
- account menu.

Preserve its behavior while replacing default-looking Mantine composition with a more deliberate GSS shell.

## Current route and permission pattern

`apps/web/src/app/router.tsx` maps navigation items to `ProtectedPage`, `RequireAuth`, and `RequirePermission`. Company detail routes and monitoring routes are explicit. Preserve route permissions and do not infer scope from UI state.

## Current high-impact UX targets

- `features/organizations/CompaniesPage.tsx`: table-only company list.
- `features/organizations/CompanyResourcesPage.tsx`: table-only site/building lists.
- `features/organizations/AdminCompanyDetailPage.tsx`: route-backed top tabs for overview, sites, buildings, users, devices.
- `features/company-management/CompanyUsersPage.tsx`: very large modal with identity, role, direct permissions, scope, positions, and preview.
- `features/devices/AdminDevicesPage.tsx`: gateway/node top tabs and dense management workspace.
- `features/devices/CompanyDevicesPage.tsx`: gateway/node top tabs.
- `features/monitoring/CompanyMonitoringPage.tsx`: node-type cards and realtime tabs; keep the realtime tab model.
- `features/alarms/AlarmOperationsPages.tsx`: alarm detail and rule tabs.
- `features/settings/SettingsPages.tsx`: candidates for nested section navigation.

## Current theme gap

`packages/ui/src/theme.ts` already defines light/dark semantic tokens, but `apps/web/src/styles/global.css` currently sets `color-scheme: light`. Implement a proper Mantine color-scheme strategy before claiming full dark-mode support.
