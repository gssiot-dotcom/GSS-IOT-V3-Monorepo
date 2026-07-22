# CODEX TASK 12 — Global modern dashboard UI/UX consistency pass

Complete Tasks 02–11 first. This task is the final implementation pass for user Requirement 10, after all major page behaviors exist.

## Goal

Apply one coherent modern GSS dashboard experience across the whole application without changing approved business rules.

## Audit every active route

At minimum review:

### GSS Admin

```txt
/admin/welcome
/admin/profile
/admin/dashboard
/admin/companies and detail routes
/admin/devices
/admin/gateway-commands
/admin/monitoring
/admin/alarms and details
/admin/alarm-rules
/admin/notifications
/admin/reports
/admin/settings/roles
/admin/settings/system
```

### Company

```txt
/company/welcome
/company/profile
/company/dashboard
/company/areas and details
/company/buildings and details/plan
/company/devices
/company/monitoring and building/node-type routes
/company/alarms and details
/company/alarm-rules
/company/notifications
/company/reports
/company/users
/company/roles
/company/settings
```

## Required consistency improvements

### Layout and hierarchy

- consistent page headers, subtitles, breadcrumbs and primary actions;
- consistent content widths and full-width data pages;
- clear section grouping and whitespace;
- responsive grid breakpoints;
- avoid huge empty regions and cramped dense forms.

### Cards and dashboards

- consistent surfaces, borders, radius and shadows;
- KPI cards use shared components;
- avoid decorative gradients on every card;
- status cards use icon + text + color.

### Tables and actions

- consistent row density and horizontal scroll;
- compact icon/action menus with tooltips where space is limited;
- visible destructive confirmation;
- consistent filter/search/pagination placement;
- mobile representation where a table becomes unusable.

### Forms/modals/drawers

- consistent labels, helper text and validation;
- complex workflows use large drawer/page rather than tiny modal;
- predictable save/cancel order;
- mutation loading and success/error feedback;
- no hardcoded UI strings.

### Universal states

Every data route must have explicit:

- loading;
- empty;
- recoverable error;
- forbidden;
- inactive/session expired;
- partial provider/realtime failure where applicable.

### Shell/navigation

- grouped, readable navigation;
- selected state and context are obvious;
- mobile drawer works;
- header controls do not overflow;
- notification/account controls remain accessible.

### Accessibility

- keyboard navigation;
- visible focus;
- meaningful image alt text;
- icon-only aria labels;
- status not communicated by color alone;
- reasonable contrast.

## Guardrails

- Do not change backend business logic in this task except a small bug fix required by the polish, and document any such fix.
- Do not change permission names or scope semantics without an explicit architecture reason.
- Do not replace Mantine with another system.
- Do not copy Parfumbox branding.
- Preserve legacy node images and approved monitoring behavior.
- Do not start Phase 14.

## Tests and visual smoke

Update affected component tests. Add/extend Playwright smoke coverage for representative desktop and mobile flows:

- login and shell;
- Welcome/profile menu;
- dashboards;
- device inventory actions;
- Company monitoring card/detail;
- Admin monitoring;
- roles/settings;
- no-permission route behavior.

Use deterministic assertions; do not create brittle pixel-perfect tests unless a visual regression framework already exists.

Run web unit/E2E, relevant API regression, lint, typecheck, format, build and diff check.

## Documentation

Update:

```txt
docs/design/DESIGN_SYSTEM.md
docs/design/UI_UX_SPEC.md
docs/design/PAGE_INVENTORY.md
```

Freeze the final component/token conventions and list any intentionally deferred visual work.

## Definition of Done

- Active routes feel like one modern product rather than disconnected phase outputs.
- No approved nav route remains an unexplained placeholder.
- Responsive/accessibility checks pass.
- Business, RBAC, MQTT, alarm and report behavior remains intact.
- Manual visual acceptance is recorded.
