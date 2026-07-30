# GSS IoT V3 — Design System

## 1. Design direction

Yangi UI ikki mavjud source’dan foydalanadi:

- **Parfumbox admin**: button, card, table, modal, form, pagination, layout, RBAC route/action pattern va icon usage.
- **Eski GSS UI**: GSS ranglari, monitoring identity, node status semantics va 3 ta node-type image card.

Yangi loyiha eski ikki component kutubxonasini aralashtirmaydi. Primary UI library:

```txt
Mantine 7+
Tabler Icons
React/Vite/TypeScript
```

Old GSS Tailwind/shadcn code visual reference hisoblanadi; new shared components Mantine orqali yoziladi. Legacy node card uchun CSS Module yoki Mantine styles ishlatilishi mumkin.

## 2. Core tokens

Eski GSS source CSS’dan normalizatsiya qilingan asosiy light theme:

| Token        |           HSL | Taxminiy vazifa          |
| ------------ | ------------: | ------------------------ |
| `background` | `210 20% 97%` | app background           |
| `foreground` | `222 35% 12%` | primary text             |
| `surface`    |   `0 0% 100%` | cards, modals            |
| `primary`    | `199 89% 40%` | GSS cyan-blue action     |
| `secondary`  | `210 20% 92%` | secondary surfaces       |
| `border`     | `214 20% 88%` | neutral border           |
| `muted`      | `215 16% 47%` | secondary text           |
| `danger`     |   `0 72% 51%` | destructive/alarm danger |

Status tokens:

| Status    |           HSL | Rule                         |
| --------- | ------------: | ---------------------------- |
| `safe`    | `199 89% 38%` | normal/safe monitoring state |
| `caution` | `142 71% 42%` | caution                      |
| `warning` |  `45 93% 42%` | warning                      |
| `danger`  |   `0 72% 51%` | danger                       |
| `offline` | `215 14% 55%` | offline/unknown              |

Dark theme source tokens:

```txt
background 222 47% 6%
surface    222 40% 10%
primary    199 89% 48%
border     222 30% 18%
foreground 210 40% 96%
```

## 3. Mantine theme mapping

```ts
const gssBlue = [
  "#e8f7fd",
  "#d2effa",
  "#a7dff5",
  "#78ceef",
  "#48bdea",
  "#159fde",
  "#0b80b7",
  "#08648f",
  "#064c6d",
  "#03344a",
];
```

- `primaryColor = 'gss'`
- `defaultRadius = 'md'`
- default card radius: 12px
- default control height: 36–40px
- page section gap: 16–24px
- table row height: 44–52px
- modal body spacing: 16–24px

Final exact hex palette component implementation vaqtida HSL tokenlardan generate qilinadi va visual review bilan freeze qilinadi.

## 4. Typography

```txt
Latin: Inter
Korean: Noto Sans KR
Fallback: system-ui, sans-serif
```

- Page title: 28–32px, 600.
- Section title: 18–20px, 600.
- Card title: 15–17px, 600.
- Body: 14px.
- Helper/meta: 12–13px.
- Table header: 12–13px, 600.

## 5. Component rules from Parfumbox admin

### Page header

- `Group justify="space-between"`.
- Left: title + muted subtitle.
- Right: permission-wrapped primary action.
- No floating action buttons on desktop management pages.

### Cards

- `withBorder`, `padding="md"`, `radius="md"`.
- KPI cards use small uppercase muted label, prominent value, optional hint.
- Do not use decorative gradients on all cards. Monitoring hero/node card may use subtle GSS accent/glow.

### Buttons

- Primary create/save: GSS primary color, filled.
- Secondary: default/light/outline.
- Destructive: red, only for delete/deactivate.
- Icon-only action: `ActionIcon variant="subtle"` with tooltip and accessible label.
- Permission denied actions are hidden by default; read-only context may show disabled state only when it explains workflow.

### Forms

- Labels required for all inputs.
- Validation messages next to field.
- Save/cancel actions aligned consistently.
- Large forms use sections or tabs; do not create one long unstructured modal.

### Tables

- Striped/highlight-on-hover only where data density benefits.
- Pagination footer follows Parfumbox pattern: range text + page-size select + pagination.
- Server-side filtering and pagination for sensor, alarm, audit and command histories.

### Modals

- Create/edit quick forms can use modal.
- Complex role permissions, alarm rule configuration and device assignments use full page or large drawer.
- Confirm destructive actions with entity name and impact.

### Icons

Use Tabler icons consistently. Do not mix Lucide and Tabler without an approved exception.

## 6. Legacy node-type selection card — immutable behavior

Assets:

```txt
assets/legacy-node-types/gangform.png
assets/legacy-node-types/angle-node.png
assets/legacy-node-types/door-node.png
```

Mapping:

| Node type       | Asset            | Legacy source                 |
| --------------- | ---------------- | ----------------------------- |
| `gangform_node` | `gangform.png`   | old `gangform.png`            |
| `angle_node`    | `angle-node.png` | old `pikechondo.png`          |
| `door_node`     | `door-node.png`  | old `pikechondochuribmun.png` |

Required card structure:

1. Full-width clickable card.
2. Minimum height around 260px desktop.
3. Top image viewport around 160px.
4. Image uses `object-contain`, never cropped.
5. Label, short description, node count.
6. Hover: subtle lift/scale and arrow reveal.
7. Disabled type: reduced opacity + lock/coming-soon badge.
8. Grid: 1 column mobile, 3 columns from small/medium width.
9. Route and button access still require `monitoring.view` + building scope.

The legacy images may be optimized without visual alteration. Do not replace them with generic icons.

## 7. Layout

### Desktop

- Persistent left sidebar.
- Header with breadcrumb/context selector, notification bell, theme/language, profile.
- Main content max width only on form/detail pages; monitoring tables can use full width.

### Mobile/tablet

- Sidebar becomes drawer.
- Tables provide horizontal scroll or mobile card representation.
- Node-type cards remain image-first.
- Critical alarm badges and acknowledge actions remain visible without horizontal scrolling.

## 8. Status presentation

Never rely on color alone. Every status uses:

```txt
color + icon/shape + text label
```

Examples:

- `danger`: red badge + alert icon + “위험/Danger”.
- `offline`: gray badge + disconnected icon.
- command `failed`: red badge + failure reason.

## 9. Required shared components

```txt
AppShell
PageHeader
PermissionAction
DataTable
TablePaginationFooter
StatusBadge
EmptyState
ErrorState
ForbiddenState
SessionExpiredState
ConfirmActionModal
ScopeBreadcrumb
CompanySelector
ConstructionSiteSelector
BuildingSelector
NodeTypeSelectionCard
AlarmSeverityBadge
GatewayOnlineBadge
CommandStatusBadge
AuditDiffViewer
```

## 10. Accessibility

- Keyboard navigation for sidebar, tables, dialogs and node cards.
- Visible focus ring using GSS primary.
- Minimum AA contrast for text/actions.
- Images have meaningful alt text.
- Status is not color-only.
- Icon-only buttons have tooltip and `aria-label`.

## 11. Task 03 foundation decisions

The shared UI package now exports the following data-driven foundations for later dashboard and operations work:

```txt
DashboardKpiCard
DashboardSection
SectionHeader
ResponsiveContentGrid
CompactActionMenu
RealtimeStatusBadge
```

The frozen token exports are `gssSemanticTokens`, `gssLayoutTokens` and `gssTypographyScale`, alongside the existing `gssBlue`, `gssStatusColors` and `gssTheme`. They use the normalized GSS blue/status palette, light/dark semantic values, restrained card/elevated shadows, 12px card radius, 32/38/42px control heights, a 20px section gap and the documented Inter/Noto Sans KR scale. These are shared styling foundations only; Task 03 does not change realtime/account behavior or introduce a theme-switching UX.

The application shell now groups permission-filtered navigation under translated Overview, Organizations, Devices, Operations, People and Settings headings. Grouping is derived after the existing permission filter, so unauthorized items are never rendered. The mobile burger has an accessible translated label, and the shell keeps the existing notification unread API/socket and logout behavior unchanged.

## Task 04 account and realtime foundation

Welcome and profile surfaces use the authenticated session as their source of truth. They expose only safe identity metadata, render portal-specific copy, and reuse the same permission-filtered navigation source for quick links. Profile is view-only; credential mutation is outside this wave. The header account menu contains the profile link, role/company summary, effective permission count, active/super-admin indicators and sign-out action.

The notification bell is rendered only with `notifications.view`. Its unread count remains backed by the existing endpoint and notification room, while the status badge is shown only for connecting, reconnecting or offline states. Monitoring realtime remains a separate socket concern.

## Task 12 final consistency conventions

The final pre-Phase-14 UI pass freezes these cross-route conventions:

- `PageHeader` is the shared hierarchy boundary. Its title/subtitle block may shrink and action groups wrap below it on narrow screens; page actions remain in the existing permission-controlled components.
- `DataTable` keeps a 640px minimum content width inside Mantine scroll containment. New tables should provide an accessible `ariaLabel` and, where useful, a concise caption. Tables with dense actions must retain the existing mobile card or detail-drawer alternative.
- The portal shell uses a grouped permission-filtered drawer on mobile. Selecting a navigation item closes the drawer; the account menu, notification control and realtime state remain in the header.
- Focus-visible controls use a two-pixel GSS-primary outline. Status continues to use icon/shape plus text plus color, and legacy monitoring images remain unchanged.
- Shared surfaces, KPI cards, section headers, responsive grids, monitoring cards, drawers and state components are preferred over route-specific visual variants. Route-specific business behavior and permission checks are not moved into the design system.

The only implementation correction in this pass is package-boundary output: `packages/contracts` now emits ES modules to match its declared package type and Vite consumers. It changes no API or business behavior.

Intentionally deferred visual work is limited to a future design-system theme switcher, production visual-regression infrastructure, and authenticated multi-viewport browser capture for every protected route. The existing deterministic unit/API/E2E checks remain the automated evidence for protected permissions and scope behavior.

## Targeted post-Wave-4 operational corrections

This correction keeps the frozen Wave 4 system and adds the following narrow
contracts:

- Dashboard and monitoring metric surfaces use one neutral GSS panel/border
  family. Status color is limited to semantic icons, values and small
  indicators; rainbow card backgrounds and top rules are not differentiators.
- Compact KPI and operational-summary cards target 82–100px and 80–96px
  respectively. At 1280px and 1440px, the six-card dashboard and realtime
  summary sets stay on one row; smaller viewports wrap without document-level
  overflow.
- Operational SVG charts use a GSS-primary line, primary-soft area where
  applicable, light grid/ticks and visible focusable points. Shared tooltips are
  rendered through a portal so dashboard cards and monitoring drawers cannot
  clip them. Hover and keyboard focus expose the same localized reading detail.
- Company monitoring building entries are neutral whole-card links with one
  semantic status badge, a compact identity block and a visible open-monitoring
  cue. Their responsive grid is three, two and one columns.
- Permission catalogs are read-only information surfaces: compact accessible
  table on desktop, readable cards on mobile, technical keys in monospace and
  no create/edit/delete/save controls.

These corrections do not change legacy node-type selection cards, APIs,
realtime contracts, RBAC/scope enforcement or alarm semantics.

## Targeted platform and Company branding contract

- Admin and Company headers render the supplied public
  `/assets/gss-logos/Gss-logo-blue.svg` as an image with localized accessible alt text and
  `object-fit: contain`. No generated Activity mark or duplicate wordmark remains. Desktop height
  is 40–44px and compact/mobile height is 34–38px.
- Header order is mobile burger, platform brand, divider and translated current-route context.
  Header groups do not wrap or create document-level horizontal overflow.
- The Admin sidebar renders `/assets/gss-logos/GSS-logo.svg` above `GSS IoT V3` and the localized
  `GSS Admin Portal` line on the dark surface.
- The Company sidebar brand block is company-owned. It shows a private authenticated logo inside
  an always-light neutral plate with neutral border/shadow, 10–14px padding and
  `object-fit: contain`, then the company name at no more than two lines.
- Company logo loading uses a skeleton. Missing/error states use company initials in a semantic
  avatar. The name retains a title attribute for the full value.
- The shared logo editor preserves one primary upload action, selected-file preview/cancel,
  indeterminate progress, inline success/error feedback and a separate destructive confirmation
  for removal. Read-only users see the same preview without mutation controls.

`WorkspaceTabs` is the single compact tab treatment for route workspaces and nested operational
views. It has a visible active indicator/focus ring, scrolls horizontally on mobile and never causes
document-level overflow. `CollectionPagination` belongs in the list header and offers only 50/100.

## Global scrollbar contract

All intentional overflow surfaces use the shared light/dark blue-gray scrollbar tokens. Native
scrollbars use `scrollbar-width`, `scrollbar-color` and the WebKit track/thumb states; Mantine
ScrollArea uses the same tokens. The usable target is 8–10px with a rounded thumb and stronger hover
state. Drawers, modals, tables, tabs and permission lists keep this visible treatment whenever they
overflow. The main Admin/Company navigation sidebar is the sole product-approved exception: its
vertical scrollbar is visually hidden with the Mantine `type="never"` contract plus targeted
Firefox, legacy Edge/IE, WebKit and Mantine-scrollbar rules. Its viewport must retain overflow and
remain scrollable by wheel, trackpad, touch, keyboard and script.

## Date and calendar inputs

- Calendar dates use the Mantine Dates package at the same version as Mantine Core, including its
  application-level stylesheet. Native `input[type="date"]` is not the application date-picker
  primitive.
- Node history Day mode uses `DatePickerInput`, defaults to the browser-local current date, prevents
  future dates, closes after selection and portals its dropdown above drawers without clipping.
- A displayed calendar date remains a local `YYYY-MM-DD` value. API ranges are computed as local
  midnight through the next local midnight and converted to the UTC half-open `[from, to)` contract;
  presentation must never round-trip through a UTC date string that can shift the chosen day.
- Labels, placeholders and accessible calendar text use i18n keys. The full control and calendar
  trigger are keyboard/focus/touch operable.

## Organization resource cards

Construction Site and Building cards are domain-specific entry surfaces, not generic white boxes.
Both use the shared GSS border, radius, focus and elevation tokens, with a restrained visual identity
band and a large resource icon. Site cards emphasize location/context; Building cards emphasize the
built asset, show their parent Site where available and may expose one high-value footer action such
as Open monitoring. Status, identifier, parent and address remain readable without opening a menu.

The whole card may be keyboard/click navigable when a detail route exists. Overflow actions remain
independent and must not trigger card navigation. Grids collapse deliberately from three to two to
one column, keep equal-height content and introduce no document-level overflow in light or dark
themes.

## Alarm operations surfaces

- Alarm Rules keep their compact row presentation. Recipient Policies use a real table with Rule,
  Target, Building, Severity, Required occurrences, Count interval seconds, Channel and Status
  columns. There is no Actions column or Policy row menu.
- The complete keyboard-focusable Policy row opens a detail Drawer and uses the shared interactive-
  descendant guard. The open row has a visible selected state. Edit, activate/deactivate and archive
  actions live only in the Drawer and remain hidden without `alarm-rules.manage`.
- Alarm and Notification tables use leading checkboxes. Selection controls and Delete selected sit
  left of pagination so selection state and collection navigation read as one toolbar.
- Only resolved Alarm Events are selectable for archive. Disabled checkboxes include an accessible
  explanation; destructive bulk operations always use a named confirmation.

## Company identity, monitoring viewer and Administrator surfaces

- Admin Company cards use a company-identity layout rather than the Site/Building icon rail: a
  private logo or initials is primary, followed by code/name/status, existing contact/location and
  one Open company footer. Equal-height three/two/one-column cards use a whole-card focus target;
  the overflow menu remains an independent descendant and the table view is preserved.
- The Company sidebar neutral logo plate has no inner CSS padding. Its authenticated image uses the
  full 86px-high box with `object-fit: contain`; asset-internal transparent whitespace is never
  corrected by stretching or cropping.
- Realtime PLAN/REAL viewers use the shared bordered/checkerboard surface, a 420–760px responsive
  body (360px/56vh mobile), visible controls and `grab`/`grabbing` feedback. The transform preserves
  the fitted aspect ratio and clamps recoverable pan/zoom.
- Administrators, GSS roles and Permissions form one translated Admin sidebar section. The
  Administrator list uses bounded search/pagination, interactive row details and permission-limited
  mutation controls without exposing authentication internals.
- GSS Archive uses the existing Mantine shell/tokens: read-only evidence rows, actor/time/reason
  metadata, 50/100 header pagination, nested evidence detail and a red irreversible confirmation.
  Permanent purge controls never appear in Company navigation. Company Delete confirmations say
  that normal/operational visibility ends while GSS evidence remains; they never claim physical
  deletion. Sensor History uses the shared filter surface, semantic severity badges, table/chart
  states and responsive horizontal containment.

## Archive and Sensor History interaction surfaces

Archive destructive actions use the existing red danger treatment only inside GSS Archive Center,
after a red irreversible-impact alert and exact-name confirmation. Company portal Delete keeps the
ordinary archive confirmation copy and never says “permanently.” Job progress uses the shared
Alert/Progress/Code stack with explicit failed, retry and completed states. Sensor History uses
cascading native selectors, the shared bounded chart/table surfaces and a separate GSS-only filtered
purge modal. These layouts are verified at 1440×900, 1280×800 and 390×844.

## Korean and English localization

- Korean (`ko-KR`) is the deterministic default. Browser language is not an implicit product
  decision; a valid stored user choice may restore English (`en-US`).
- The globe language selector is always visible in the Admin and Company header immediately before
  the theme control. Changing it updates the current route without a reload, persists the choice and
  updates the root `html lang` attribute.
- UI copy uses the typed catalogs in `apps/web/src/app/i18n/locales`. Domain terminology follows
  `KOREAN_COPY_GLOSSARY.md`; user-visible Korean must not use 알람, 통지, 아카이브, 퍼지 or 회수.
- Dates, times, numbers, percentages, file sizes, durations and relative times use the shared
  explicit-locale formatters. System notifications retain a template key plus parameter snapshot so
  historical messages can render in the current language.
- Text growth must not hide header controls or introduce document-level horizontal overflow at
  1440×900, 1280×800 or 390×844. Machine identifiers, MQTT payload keys and immutable evidence are
  not translated.
