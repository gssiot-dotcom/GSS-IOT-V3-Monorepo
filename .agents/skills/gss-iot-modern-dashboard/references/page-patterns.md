# Page Patterns

## 1. Entity browsing workspace

Use for companies, construction sites, and buildings.

Structure:

```txt
PageHeader
FilterToolbar
Summary strip (optional)
EntityCardGrid
Pagination or infinite paging
Empty/Error/Loading states
```

Entity card content:

```txt
Title + status
Code/location/context
2-4 compact metrics
Last activity/update
Primary open action
Permission-aware overflow menu
```

Do not bury the primary open action inside an overflow menu.

## 2. Dense table workspace

Use for users, roles, devices, commands, alarms, reports, and audit data when comparison and bulk action matter.

Structure:

```txt
PageHeader
DataToolbar
Active filter chips
Table surface
Pagination footer
Row detail drawer or routed detail
```

Support sticky header only when tested with the shell. Keep row action icons aligned and labeled with tooltips.

## 3. Context section layout

Use for company detail, building detail, settings, long forms, and multi-section configuration.

Desktop:

```txt
Context header
[inner section nav 220px] [content region]
```

Mobile:

```txt
Context header
section select/drawer
content region
```

Use route-backed sections. Filter section links by permission before rendering.

## 4. Form workspace

Use for complex create/edit flows.

```txt
Page header or drawer header
Context section nav
FormSection: identity
FormSection: role/status
FormSection: permission overrides
FormSection: scope
FormSection: positions
Effective access preview
Sticky save/cancel
Danger zone
```

Small forms remain modal-based.

## 5. Realtime monitoring workspace

Keep the current operational tabs because they share one building/node-type context and live state.

```txt
PageHeader + realtime state
Node view toggle
Tabs: latest states / history / alarm levels / fault filters
Card grid or table
Node detail drawer
```

Do not replace realtime tabs with inner sidebar unless user testing shows a real orientation problem.

## 6. Dashboard overview

Use KPI cards, status distribution, recent alarms, command health, gateway/node availability, and recent operational activity. Every block must answer an operational question. Avoid decorative charts with no GSS decision value.
