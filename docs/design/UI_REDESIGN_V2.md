# GSS IoT V2 — Wave 1 Visual Contract

## Product character

GSS IoT is a construction-safety operations workspace: calm, reliable, technical, compact, premium, and easy to scan during long sessions. The interface should communicate control and signal quality through hierarchy, spacing, semantic color, and predictable action placement.

Avoid generic empty templates, oversized cards, decorative gradients, heavy glassmorphism, rainbow status colors, and repeated destructive buttons.

## Color and surfaces

| Token          | Value                      | Use                                       |
| -------------- | -------------------------- | ----------------------------------------- |
| canvas         | `#F4F7FB`                  | application background                    |
| surface        | `#FFFFFF`                  | primary cards, dialogs, tables            |
| surface-subtle | `#F8FAFC`                  | nested fields, table stripe, quiet panels |
| text-primary   | `#172033`                  | headings and primary values               |
| text-secondary | `#667085`                  | descriptions and metadata                 |
| text-tertiary  | `#98A2B3`                  | tertiary labels and hints                 |
| border         | `#DCE4EE`                  | default surface and table borders         |
| border-strong  | `#C9D4E2`                  | selected/active boundaries                |
| primary        | `#0B80B7`                  | primary actions and safe GSS signal       |
| primary-hover  | `#08648F`                  | primary hover state                       |
| primary-soft   | `#E8F7FD`                  | selected/soft action surfaces             |
| accent         | `#2563EB`                  | secondary informational accent            |
| sidebar        | `#0E1B2B`                  | persistent navigation                     |
| sidebar-muted  | `#9FB0C3`                  | inactive sidebar text                     |
| sidebar-active | `rgba(21, 159, 222, 0.16)` | active navigation surface                 |
| focus          | `#159FDE`                  | visible keyboard focus                    |

Semantic status colors remain constrained to status meaning:

| Status       | Value     | Presentation                                   |
| ------------ | --------- | ---------------------------------------------- |
| safe         | `#0B80B7` | check icon + translated label                  |
| caution      | `#16A34A` | shield/check icon + translated label           |
| warning      | `#D18A00` | alert icon + translated label                  |
| danger       | `#DC2626` | warning icon + translated label                |
| offline      | `#7C8797` | disconnected icon + translated label           |
| unconfigured | `#64748B` | question/configuration icon + translated label |

## Type and density

- Header height: 64px.
- Sidebar width: 272px desktop; drawer on mobile.
- Desktop content padding: 24px, expanding to 32px on wide screens.
- Section gap: 20–24px.
- Card radius: 14px; control radius: 8px; pills use full radius.
- Controls: 38px default, 42px comfortable.
- Table rows: 48–54px.
- Page title: 28px/1.2, weight 650.
- Section title: 18px/1.3, weight 650.
- Body: 14px; captions/meta: 12–13px.
- Transitions: 120–180ms and reduced-motion safe.

## Shell contract

- Persistent dark navy sidebar contains a compact GSS mark, product name, portal context, permission-filtered grouped navigation, and a clear cyan active marker.
- Header remains light and quiet. It shows current portal/page context, realtime state only when connecting/reconnecting/offline, notification affordance only with `notifications.view`, and account/theme controls.
- The main canvas is soft gray-blue with a deliberate max width for management/detail pages. Monitoring remains allowed to use the full workspace width.
- Mobile navigation is a Mantine drawer; selecting a link closes it. No route or permission behavior changes.

## Shared primitive contract

### `PageHeader`

Supports title, subtitle, optional eyebrow/context, status/meta content, one dominant primary action, and a compact overflow action. Actions wrap below the title on narrow screens.

### `DataTable`

Supports accessible name/caption, compact or comfortable density, rich entity cell content, fixed narrow right-aligned actions, optional row/title navigation, skeleton rows, and controlled pagination metadata. It remains horizontally contained at a 640px minimum and exposes a mobile-friendly entity representation where page data needs it.

### Entity primitives

`EntityPrimaryCell` establishes title, identifier, and optional avatar/icon as the dominant table cell. `EntityStatusBadge` delegates to semantic `StatusBadge`. `EntityActionMenu` owns compact contextual actions and separates destructive items with a divider. `ConfirmActionModal` names the entity and explains reversible impact. `WorkspaceCard` groups filters/tables without making every section a hero card.

### Forms and states

`ModalFormFooter` renders Cancel first and Save/Create second. Table/loading surfaces use skeleton rows where appropriate. Universal loading, empty, error, forbidden, session-expired, offline, and reconnecting states remain localized and permission-safe.

## Action hierarchy

1. One visually dominant primary action per page or dialog.
2. At most one common secondary page-header action.
3. Rare, contextual, and destructive actions live in a compact overflow menu.
4. Deactivate is reversible business-state change, not Delete; use pause/power-off semantics.
5. In tables, the entity name or row is the navigation target. Keep no more than one visible row shortcut; Edit/Assign/Move/Deactivate/Delete stay in the menu.
6. Missing permission hides the action. Business-state blockers may disable it only with an explanation.

## Wave 1 page contracts

| Route                         | Primary action            | Contextual actions                                 | Destructive action                    |
| ----------------------------- | ------------------------- | -------------------------------------------------- | ------------------------------------- |
| `/admin/design-system`        | none; gallery is the task | examples only                                      | none                                  |
| `/admin/companies`            | Create company            | row open/navigation and permitted edit menu        | none on list                          |
| `/admin/companies/:companyId` | Edit company              | tabs/section navigation                            | Deactivate in overflow + confirmation |
| `/company/areas`              | Create site               | entity navigation and permitted edit menu          | Deactivate in overflow + confirmation |
| `/company/buildings`          | Create building           | entity navigation and optional monitoring shortcut | Deactivate in overflow + confirmation |
| `/company/users`              | Create user               | Edit/position actions in overflow                  | Deactivate in overflow + confirmation |

## Behavior boundary

The visual contract changes presentation only. Existing endpoint paths, request/response DTOs, route paths, authentication/session restore, permission checks, scope filtering, notification/realtime behavior, mutation semantics, and i18n requirement are preserved. Monitoring pages remain outside Wave 1 except for compatible shared primitives and the unchanged legacy node-type card.

## Visual QA contract

Capture baseline and after evidence at 1440x900, 1280x800, and 390x844 when the test-only fixture is available. Check no horizontal document overflow, visible focus, semantic status labels, one primary action, contextual menus, confirmation dialog copy, and modal footer order. Stop after this wave for review; Wave 2 begins only after visual feedback.
