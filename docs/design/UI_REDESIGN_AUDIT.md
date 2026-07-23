# GSS IoT V3 — Wave 1 UI Redesign Audit

## Scope and constraints

This audit covers the shared frontend foundation, application shell, GSS Admin organization pages, Company resource pages, and Company users/positions. Wave 1 preserves API paths, DTOs, routes, authentication, permission keys, backend scope enforcement, data fetching, realtime behavior, i18n, and the three legacy monitoring images. Devices, monitoring, alarms, reports, and settings remain outside this redesign except where a shared primitive must remain compatible.

The audit was performed against the current implementation on 2026-07-23. The current worktree also contains unrelated user changes to the legacy skill directory; those files are intentionally excluded from this wave.

## Product shell and navigation

- `apps/web/src/features/shell/PortalLayout.tsx` uses a functional Mantine `AppShell`, but the sidebar is a light surface and does not create the requested dark navy product anchor. The brand treatment is a generic single-letter avatar, while the portal label, current route context, account menu, notifications, and theme control compete at the same visual level.
- Permission-filtered navigation and mobile drawer behavior already exist and must remain intact. The redesign should change only hierarchy, active-state treatment, width, spacing, and mobile close behavior.
- The header needs a quieter 64px context bar with a compact breadcrumb/context line. Realtime status should appear only when connecting, reconnecting, or offline, as already intended by the current state logic.

## Typography and spacing

- `packages/ui/src/theme.ts` has useful semantic exports, but the blue tuple and typography are more generic than the V2 GSS direction. The shared theme should freeze the navy/cyan palette, 28–30px page titles, 18px section titles, 14px body text, 12–13px metadata, 38–42px controls, and 14–16px cards.
- `apps/web/src/styles/global.css` uses several page-specific spacing values and a 4px `PageContainer` padding that weakens the desktop content frame. Shared page padding and section gaps should be expressed through the design tokens.
- Several pages use `Stack gap="lg"` and large bordered surfaces for every section, producing a sparse screen with repeated visual containers rather than a clear hierarchy.

## Color and surface hierarchy

- The current light palette is close to the desired direction, but `gssBlue` is a more saturated blue scale and `gss-button-primary` adds a gradient. The V2 contract calls for a calm cyan-blue primary, quiet light header, soft gray-blue canvas, white surfaces, and restrained shadows.
- `global.css` styles dark mode broadly but does not establish a dark navy sidebar in either color mode. Surfaces should rely on border contrast and one restrained elevation level; gradients should be reserved for no shared surface.
- Status colors are mostly semantic already, but page-specific status rendering bypasses `StatusBadge` and exposes raw enum values. Status needs icon, label, and color consistently.

## Cards and KPI density

- `packages/ui/src/dashboard-primitives.tsx` adds useful KPI and section primitives, but the `::before` accent strip and `shadow="md"` on nearly every card make cards visually repetitive. KPI cards should be compact, with a clear label/value/meta relationship and only a restrained accent treatment.
- `packages/ui/src/entity-primitives.tsx` renders cards with a title and optional action, but the action area does not establish a standard overflow location or a whole-card/title navigation pattern. `EntityCard` should remain compatible while page families move contextual actions into a menu.
- `AdminCompanyDetailPage.tsx` presents four identical summary cards plus two equally weighted profile cards. The detail header and summary should carry the hierarchy; subsections should use workspace surfaces and compact metadata rather than identical large cards.

## Tables and filters

- `packages/ui/src/data-table.tsx` only accepts columns and rows. It has no explicit actions column, primary entity cell, row/title navigation, density, loading skeleton, result caption API, controlled pagination, or mobile fallback contract.
- The current minimum width containment is useful and should remain, but table headers, row height, action alignment, and empty/loading content need shared defaults.
- `CompaniesPage.tsx`, `CompanyResourcesPage.tsx`, and `CompanyUsersPage.tsx` use `DataToolbar` only for a count/view toggle and do not expose a consistent entity-first row hierarchy. Wave 1 adds the reusable pieces needed by these routes without introducing new server filtering behavior.

## Row and card action placement

- `CompaniesPage.tsx` repeats a full “Open” button in card and table rows. The company name/code should be the primary navigation target; one compact overflow menu can hold permitted contextual actions.
- `CompanyResourcesPage.tsx` stacks Open, Monitoring, and Deactivate vertically in table cells and stacks monitoring/deactivate beneath the card content. This is the most visible action-placement defect. The entity/title becomes navigation, monitoring remains the one optional visible shortcut, and deactivate moves into a menu.
- `CompanyUsersPage.tsx` renders full Edit and Deactivate buttons in every user row and a full Deactivate button for every position. Both become one right-aligned action menu with permission-filtered items.
- `AdminCompanyDetailPage.tsx` renders Edit and a red Deactivate action side by side in the page header. Edit remains the common action; deactivate moves to a separated destructive menu item and a confirmation dialog.

## Destructive action semantics

- Deactivate is currently an unconfirmed `DELETE` request in all affected pages. The existing backend behavior and endpoint remain unchanged, but the UI must explain that this changes active state, name the entity, prevent duplicate submission, and separate the destructive action visually.
- Deactivate must use pause/power-off semantics rather than a trash icon. Delete semantics remain reserved for the existing pristine-device flows outside Wave 1.
- Missing permission must remove the action entirely. A disabled state is appropriate only when the record is already inactive or a business-state blocker is known.

## Forms, modals, and drawers

- `CompaniesPage.tsx` places the only Create action directly below the last password field.
- `AdminCompanyDetailPage.tsx` places Save/Create buttons inline beneath the last field in all four modals.
- `CompanyUsersPage.tsx` has a strong sectioned editor, but its footer contains only Save and its position modal mixes table, creation fields, and a direct destructive button without a consistent action footer.
- A shared `ModalFormFooter` should standardize Cancel first and Save/Create second. Complex user editing can keep its existing section structure and move to a deliberate footer; short company/resource forms can remain modals.

## Loading, empty, error, forbidden, and session states

- Shared state primitives exist in `packages/ui/src/app-states.tsx`, but table routes generally show a centered generic loader rather than skeleton rows and do not differentiate table empty content from page-level failure.
- Error states expose retry only when callers pass it. Affected pages should retain their current retry/data behavior while using consistent surfaces and localized messages.
- Forbidden and inactive-session states exist and must remain available in the design-system gallery. Notification and realtime permission gates must not change.

## Responsive behavior

- `DataTable` has a 640px minimum width, which is appropriate for dense operational data but makes an unstructured action cell unusable on narrow screens. A fixed, narrow actions column and a deliberate card/entity fallback are needed.
- Page header wrapping is already present; the redesigned shell must preserve it and keep touch targets at least 36–38px.
- Cards should collapse to one column on mobile. Menus must remain portal-safe and keyboard accessible. The 390x844 legacy node-card surface must remain free of document overflow.

## Accessibility

- Icon-only action controls use Tabler icons and tooltips in existing shared menus, but each affected row needs an entity-specific accessible label.
- Status must never be color-only. Semantic `StatusBadge` use should provide an icon and translated text.
- Cards used as navigation must have keyboard activation and visible focus. Data-table navigation must not turn an action menu click into row navigation.
- Modal confirmation and form footers must preserve focus management through Mantine and expose explicit Cancel/primary labels.

## Visual consistency and duplicated inline styling

- `PageHeader`, `EntityCard`, `DataTable`, and route-level `Paper`/`Stack` combinations duplicate hierarchy decisions in multiple places.
- Inline style objects in `node-type-card.tsx`, `PageHeader`, and `PortalLayout` make shared spacing and surface changes harder to audit. Wave 1 centralizes the new contract in theme classes and keeps inline styling only for values that are data-dependent or required by Mantine layout.
- Existing `packages/ui/src/data-primitives.tsx`, `entity-primitives.tsx`, `form-primitives.tsx`, and `layout-primitives.tsx` are useful compatibility surfaces. New primitives should remove duplication rather than add another competing component family.

## Wave 1 acceptance focus

1. A dark navy, permission-filtered shell with quiet header hierarchy.
2. A living `/admin/design-system` gallery showing tokens, typography, status, entity rows, action menus, form footers, and all universal states.
3. Entity-first Companies and Company Resources rows/cards with semantic status badges and contextual menus.
4. Admin company deactivate confirmation and Company user/position contextual menus with preserved permission guards.
5. Consistent modal footers and focused tests for permissions, confirmation, status labels, and row navigation.
6. Baseline/after screenshots for `/admin/design-system`, `/admin/companies`, `/admin/companies/:companyId`, `/company/areas`, `/company/buildings`, and `/company/users` at desktop and mobile sizes when the fixture is available.
