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

## Current post-Wave-4 audit hotspots

Use these as audit starting points and verify them against the current branch before editing:

- `CompaniesPage.tsx` reads `event.currentTarget.value` inside functional state updaters in the
  card/table Edit modal. Snapshot input values synchronously before calling `setState`; React may
  clear `currentTarget` after dispatch.
- `GssPlatformBrand` always renders the blue SVG. The shared header needs the approved blue asset in
  light mode, white asset in dark mode, and a responsive `Global Smart Solutions` wordmark before
  the existing route context.
- `SensorHistoryPage.tsx` and `ArchivePage.tsx` still use native `datetime-local` fields, while the
  Node detail Drawer already establishes the Mantine `DatePickerInput` calendar language.
- `CompanyResourceDetailPages.tsx` puts Buildings/Assigned Users and Assigned Users/Gateways into
  equal half-width table columns. It also fetches only the first 100 global records and filters them
  client-side, so relationship counts and lists can be incomplete.
- Resource detail pages need backend-scoped summary/read models, compact KPI/context cards, and
  full-width vertical relationship sections with deliberate desktop/tablet/mobile composition.

## Existing advantages to reuse

- Permission filtering and route guards already exist.
- Shared UI package already exists.
- `/admin/design-system` already exists and can become the code-first living style guide.
- The application already has unit tests and Playwright infrastructure.
- Legacy node-type image assets already exist.
- Current pages already define much of the real data and business behavior that must be preserved.
- Approved public platform logo assets already exist at
  `apps/web/public/assets/gss-logos/Gss-logo-blue.svg` and
  `apps/web/public/assets/gss-logos/GSS-logo.svg`; do not generate replacements.
