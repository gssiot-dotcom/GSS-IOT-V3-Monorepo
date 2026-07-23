# Current GSS IoT V3 UI Context

## Repository shape

The current frontend is a React, Vite, TypeScript and Mantine application with shared components in `packages/ui` and portal pages in `apps/web`.

Important files:

```txt
packages/ui/src/theme.ts
packages/ui/src/dashboard-primitives.tsx
packages/ui/src/page-header.tsx
packages/ui/src/data-table.tsx
packages/ui/src/status-badge.tsx
packages/ui/src/realtime-status-badge.tsx
packages/ui/src/app-states.tsx
packages/ui/src/node-type-card.tsx
apps/web/src/styles/global.css
apps/web/src/features/shell/PortalLayout.tsx
apps/web/src/features/shell/DesignSystemDemoPage.tsx
apps/web/src/features/shell/navigation.ts
```

Page families:

```txt
apps/web/src/features/dashboard/
apps/web/src/features/organizations/
apps/web/src/features/company-management/
apps/web/src/features/devices/
apps/web/src/features/gateway-commands/
apps/web/src/features/monitoring/
apps/web/src/features/alarms/
apps/web/src/features/reports/
apps/web/src/features/settings/
```

## Known visual and UX weaknesses in the current implementation

Use these as audit starting points, not as an exhaustive defect list:

- `CompanyResourcesPage.tsx` stacks Open, Monitoring, and a red Deactivate button vertically inside each table action cell.
- `AdminCompanyDetailPage.tsx` exposes Deactivate directly in the page header beside Edit.
- `CompanyUsersPage.tsx` renders full text Edit and Deactivate buttons in every row and exposes Deactivate directly in the position table.
- `CompaniesPage.tsx` displays raw status strings and a repeated Open button instead of a stronger row hierarchy.
- `DataTable` is intentionally minimal and lacks a standardized actions column, row navigation, sort/filter affordances, mobile fallback, density options, and complete pagination behavior.
- Create/edit modals often place a single Save/Create button directly below fields with no consistent footer or Cancel action.
- Several detail sections are plain stacks of tables with weak grouping and little visual hierarchy.
- `PortalLayout` is functional but visually close to Mantine defaults, with little product identity.
- The theme contains useful base tokens but does not yet produce a distinctive, cohesive premium application.
- Status, destructive actions, disabled reasons, and row interaction patterns are inconsistent across page families.

## Existing advantages to reuse

- Permission filtering and route guards already exist.
- Shared UI package already exists.
- `/admin/design-system` already exists and can become the code-first living style guide.
- The application already has unit tests and Playwright infrastructure.
- Legacy node-type image assets already exist.
- Current pages already define much of the real data and business behavior that must be preserved.
