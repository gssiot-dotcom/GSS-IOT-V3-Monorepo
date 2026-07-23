# Target UI Codebase

## Shared layout

### `ContextSectionLayout`

Responsibilities:

- render desktop inner navigation and mobile section switcher;
- accept permission-filtered section items;
- render title, description, icon, optional badge, and route;
- expose a content region with predictable min-width and overflow behavior.

Suggested shape:

```ts
interface ContextSectionItem {
  key: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  to: string;
  permission?: string;
  badge?: ReactNode;
}
```

### `PageContainer`

Responsibilities:

- consistent full-width or bounded layouts;
- responsive page padding;
- vertical section rhythm;
- optional dense mode for operations pages.

### `SectionPanel`

Responsibilities:

- consistent title, description, action, border, surface, and spacing;
- no business logic.

## Entity components

### `EntityCard`

Responsibilities:

- clickable primary body;
- title, subtitle/context, status, metrics, metadata;
- overflow actions;
- keyboard and focus support;
- optional selected/disabled state.

### `EntityCardGrid`

Responsibilities:

- responsive 1/2/3/4-column layout;
- stable card height where comparable;
- loading skeleton grid;
- empty state slot.

## Data workspace components

### `DataToolbar`

Responsibilities:

- search;
- filters;
- sort;
- card/table toggle;
- selected count and bulk actions;
- responsive collapse.

### `DataTable`

Extend the current shared table with:

- optional sortable headers;
- row selection;
- empty/loading rendering;
- sticky header option;
- row click;
- mobile strategy;
- controlled pagination;
- consistent action column.

Do not embed API fetching inside the shared table.

## Form components

### `FormWorkspace`

Responsibilities:

- compose inner navigation, main content, and sticky actions;
- show dirty state and save state;
- support page or drawer container.

### `FormSection`

Responsibilities:

- title, description, optional status;
- one or two-column field layout;
- local validation summary slot.

### `StickyFormActions`

Responsibilities:

- save, cancel, optional preview;
- saving/disabled state;
- safe mobile stacking.

## Monitoring components

Keep domain-specific monitoring components in the web feature unless they are truly reusable across admin and company portals. Shared primitives may include status presentation, chart panels, and sensor-value formatting, but socket and API orchestration stays in feature code.

## Export strategy

Use folder-level barrel exports in `packages/ui/src/index.ts`. Migrate imports incrementally. Do not rewrite all imports in one unreviewed commit.
