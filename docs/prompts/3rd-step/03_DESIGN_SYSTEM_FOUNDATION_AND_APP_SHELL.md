# CODEX TASK 03 — Modern design-system foundation and application shell

Complete Task 02 first. Read the design documents and inspect the Parfumbox layout/dashboard component patterns named in the source map.

## Goal

Strengthen the shared GSS visual foundation so later feature tasks can produce one consistent modern dashboard instead of page-specific styling.

This task addresses the foundation of user Requirement 10. It must not perform the final all-page polish yet.

## Current areas to inspect

```txt
packages/ui/src/theme.ts
packages/ui/src/index.ts
packages/ui/src/app-states.tsx
packages/ui/src/data-table.tsx
packages/ui/src/page-header.tsx
apps/web/src/features/shell/PortalLayout.tsx
apps/web/src/features/shell/navigation.ts
docs/design/DESIGN_SYSTEM.md
docs/design/UI_UX_SPEC.md
```

## Required implementation

### 1. Freeze coherent GSS tokens

Refine and document:

- GSS primary palette;
- semantic background/surface/border/text tokens;
- safe/caution/warning/danger/offline colors;
- typography scale;
- spacing, radius and shadow levels;
- focus rings and accessible contrast;
- light/dark-safe token usage even if a theme switch is not introduced now.

Do not use Parfumbox green.

### 2. Build reusable dashboard primitives

Add well-typed shared components where they reduce duplication, for example:

```txt
DashboardKpiCard
DashboardSection
SectionHeader
CompactActionMenu
ProfileSummaryCard foundation
RealtimeStatusBadge foundation
ResponsiveContentGrid
```

Names may differ when repository conventions suggest better names. Export them from `@gss-iot/ui` when they are truly cross-feature.

### 3. Modernize shell structure without changing account/realtime behavior yet

Improve the visual structure of `PortalLayout` and navigation:

- modern but restrained sidebar/header surfaces;
- clear active navigation state;
- grouped navigation sections when compatible with current permission filtering;
- responsive mobile behavior;
- consistent content background and spacing;
- no decorative gradient overload;
- keyboard/focus accessibility;
- icon-only controls use tooltips and labels.

The actual profile dropdown and truthful realtime state are Task 04. Do not duplicate that work here.

### 4. Keep behavior stable

- preserve routes and permissions;
- preserve notification unread behavior;
- preserve logout behavior until Task 04 replaces its presentation;
- preserve i18n;
- preserve test selectors relied on by current tests unless intentionally migrated with test updates.

## Tests

Add/update focused UI-package and shell tests for:

- token/theme creation;
- shared primitives rendering;
- sidebar permission filtering remains intact;
- mobile/desktop shell controls remain accessible;
- no unauthorized nav item appears.

Run:

```bash
pnpm --filter @gss-iot/ui test:unit
pnpm --filter web test:unit
pnpm typecheck
pnpm lint
pnpm format:check
git diff --check
```

Use actual package names/scripts if they differ.

## Documentation

Update design docs with the final token/component decisions. Record no business behavior change.

## Out of scope

- dashboard data endpoints/charts;
- Welcome/Profile implementation;
- device workflows;
- monitoring cards;
- production/deployment work.

## Definition of Done

- Later tasks can build pages from a coherent shared visual foundation.
- Existing authorization/navigation behavior is unchanged.
- Tests pass.
- `EXECUTION_STATE.md` is updated.
