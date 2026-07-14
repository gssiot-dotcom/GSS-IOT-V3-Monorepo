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
