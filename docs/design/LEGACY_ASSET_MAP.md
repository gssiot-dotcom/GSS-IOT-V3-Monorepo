# Legacy UI and Asset Map

## Source archives

- `reference/source-materials/GSS-web-dashboard-V.2.0ZIP.zip`
- `reference/source-materials/parfumbox-main.zip`

Do not modify these archives.

## Node type assets

| New path | Old path | Mapping |
|---|---|---|
| `assets/legacy-node-types/gangform.png` | `GSS-new-design/src/public/gangform.png` | `gangform_node` |
| `assets/legacy-node-types/angle-node.png` | `GSS-new-design/src/public/pikechondo.png` | `angle_node` |
| `assets/legacy-node-types/door-node.png` | `GSS-new-design/src/public/pikechondochuribmun.png` | `door_node` |

## Legacy card source

Old component:

```txt
GSS-new-design/src/components/NodeTypeCard.tsx
```

Reusable behavior:

- image-first card;
- 160px image area;
- object-contain;
- node count;
- hover scale and arrow;
- disabled lock badge;
- 3-column responsive grid.

Do not copy the old component’s dependency stack directly. Reimplement with Mantine and the new GSS theme.

## Parfumbox admin patterns

Relevant old paths:

```txt
apps/admin/src/app/theme.ts
apps/admin/src/layouts/AdminLayout.tsx
apps/admin/src/pages/DashboardPage.tsx
apps/admin/src/pages/settings/SettingsRolesPage.tsx
apps/admin/src/features/auth/RequirePermission.tsx
apps/admin/src/shared/ui/TablePaginationFooter.tsx
```

Reuse patterns:

- Mantine theme and app layout approach;
- page title/subtitle/action header;
- with-border cards;
- full permission-wrapped actions;
- table/pagination structure;
- modal forms;
- Tabler icons.

Do not reuse:

- Parfumbox green palette;
- perfume/ecommerce domain entities;
- unrelated page density or financial formatting.
