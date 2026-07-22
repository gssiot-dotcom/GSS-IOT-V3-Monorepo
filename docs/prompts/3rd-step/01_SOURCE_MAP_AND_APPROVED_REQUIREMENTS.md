# Source map and approved product requirements

## Purpose

This file maps the user's ten approved product requirements to the current V3 code and the two legacy references. It is context, not an executable implementation task.

## Read-only source archives

The repository already contains the required references:

```txt
reference/source-materials/parfumbox-main.zip
reference/source-materials/GSS-web-dashboard-V.2.0ZIP.zip
reference/source-materials/parfumbox-rbac-reference.md
reference/source-materials/gss-iot-rbac-requirements-ai-ready-v2.md
```

Never edit these archives. Extract them to a temporary directory outside tracked source when inspection is needed.

## Parfumbox UI references

Use these as **interaction/component-style references only**, not as GSS data models or branding:

```txt
parfumbox-main/apps/admin/src/pages/WelcomePage.tsx
parfumbox-main/apps/admin/src/shared/ui/AdminProfileSummary.tsx
parfumbox-main/apps/admin/src/features/auth/AdminProfileMenu.tsx
parfumbox-main/apps/admin/src/layouts/AdminLayout.tsx
parfumbox-main/apps/admin/src/pages/DashboardPage.tsx
```

Approved patterns to reuse conceptually:

- profile summary on Welcome;
- permission-filtered quick-access cards;
- compact profile trigger and detailed account dropdown;
- notification bell plus profile menu in the header;
- KPI cards, bounded date ranges and meaningful charts;
- Mantine cards, tables, forms, menus and action icons.

Do not copy Parfumbox green colors or its business metrics.

## Old GSS V2 references

Use these as **business behavior and visual references only**. Rebuild them with V3 architecture, Mantine and GSS tokens:

```txt
GSS-new-design/src/features/admin/components/DevicesCreateForms.tsx
GSS-new-design/src/features/admin/utils/parse-node-numbers.ts
GSS-new-design/src/components/ScaffoldNodeCard.tsx
GSS-new-design/src/components/AngleNodeCard.tsx
GSS-new-design/src/components/GangformNodeCard.tsx
GSS-new-design/src/components/TShapeLed.tsx
GSS-new-design/src/components/NodegraphicModal.tsx
GSS-new-design/src/components/ScaffoldNodeDetailModal.tsx
```

Approved behavior to preserve:

- node number input supports easy single/range/list creation;
- door node card clearly shows open/closed state and battery;
- angle and gangform cards use a T-shaped LED/status visualization;
- clicking a node opens historical graphics/details;
- the new detail graphic must **not** contain a fault-filter action/button.

Do not copy old Express/Mongoose structure, hardcoded roles, shadcn/Tailwind component code or insecure endpoint behavior.

## Current V3 files already identified

Primary frontend files:

```txt
apps/web/src/features/shell/PortalLayout.tsx
apps/web/src/features/shell/navigation.ts
apps/web/src/app/router.tsx
apps/web/src/features/dashboard/DashboardPages.tsx
apps/web/src/features/devices/AdminDevicesPage.tsx
apps/web/src/features/monitoring/CompanyMonitoringPage.tsx
apps/web/src/features/company-management/CompanyRolesPage.tsx
apps/web/src/shared/auth/auth-context.tsx
apps/web/src/app/i18n.ts
packages/ui/src/theme.ts
packages/ui/src/*
```

Primary API/domain files:

```txt
apps/api/src/modules/auth/*
apps/api/src/modules/rbac/*
apps/api/src/modules/devices/*
apps/api/src/modules/gateway-commands/*
apps/api/src/modules/monitoring/*
apps/api/src/modules/company-management/*
apps/api/prisma/schema.prisma
apps/api/prisma/seed.ts
packages/contracts/src/index.ts
```

## Verified current gaps at prompt-authoring time

Codex must re-check these before implementation because the repository may evolve:

1. Admin and Company Welcome routes render `PlaceholderPage`.
2. Both dashboards contain only the recent report-jobs card.
3. `PortalLayout.tsx` always renders a yellow `Realtime reconnecting` badge, independent of actual socket state.
4. Header account information is plain text/avatar with a separate sign-out button; there is no profile dropdown or dedicated profile route.
5. Admin Monitoring, Admin Roles, Admin System Settings and Company Settings routes render placeholders.
6. Gateway/Node create and update APIs exist, but delete endpoints/actions do not.
7. Node creation accepts one node number at a time.
8. REGISTER_NODES currently sends only selected nodes and rejects every node that already has an active gateway assignment. There is no explicit append/replace mode.
9. Company node-type monitoring is table-only for latest states; history is a table and there is no V2-style node card/detail chart.
10. The design system is functional but the product needs a consistent modern dashboard polish across all pages.

## User-approved requirements

### Requirement 1 — Welcome pages

Build useful GSS Admin and Company Welcome pages following the Parfumbox pattern, adapted to each portal's session, role, company/scope context and available modules.

### Requirement 2 — Dashboards

Build real GSS-specific dashboard KPIs, overview data and charts. Do not fake values and do not force Parfumbox's data shape onto GSS.

### Requirement 3 — Header realtime badge

Remove the permanently yellow reconnecting badge. Any realtime status shown in the header must reflect an actual connection state and must not claim reconnecting when connected or when no realtime connection was attempted.

### Requirement 4 — Account dropdown

Clicking the account area next to the notification bell must open a Parfumbox-like dropdown with richer user information, a profile link and sign out.

### Requirement 5 — Empty portal modules

Complete meaningful implementations for:

- GSS Admin Monitoring;
- GSS Admin Roles;
- GSS Admin System Settings;
- Company Settings.

Do not create fake settings or unsafe controls merely to fill a page.

### Requirement 6 — Device edit/delete actions

A newly created gateway or node may be hard-deleted only when it is a pristine inventory record and has never been assigned or referenced. If it has history, hard delete must be rejected; lifecycle deactivation/retirement remains the safe path. Use compact icon actions with tooltips when table space is limited.

### Requirement 7 — Bulk node creation

Support easy bulk node creation based on V2 behavior: single values, ranges and comma-separated lists, with preview and validation.

### Requirement 8 — Append versus replace node provisioning

ESP32 treats every cmd 2 node list as the complete list it should remember for that node type. Therefore the UI/API must require an explicit provisioning mode:

- `REPLACE`: payload contains exactly the selected final nodes;
- `APPEND`: backend loads currently active nodes for the target gateway and node type, unions them with newly selected nodes, and sends the full combined list.

Database assignment changes happen only after strict successful ACK.

### Requirement 9 — Monitoring table/card/detail

Monitoring must support both table and V2-inspired card views. Door cards show open/closed. Angle/gangform cards use T-shaped LED visualization. Clicking a node opens modern historical graphics. No fault-filter button/action is allowed inside the node detail graphic.

### Requirement 10 — Modern UI/UX

Modernize the full application consistently using GSS design tokens, Mantine and Tabler. Preserve business behavior, RBAC, scope, accessibility and responsive states.

## Requirement-to-task map

| Requirement | Task prompt                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| 1           | `04_WELCOME_PROFILE_HEADER_AND_REALTIME_STATUS.md`                                                       |
| 2           | `05_GSS_AND_COMPANY_DASHBOARD_ANALYTICS.md`                                                              |
| 3           | `04_WELCOME_PROFILE_HEADER_AND_REALTIME_STATUS.md`                                                       |
| 4           | `04_WELCOME_PROFILE_HEADER_AND_REALTIME_STATUS.md`                                                       |
| 5           | `06_ADMIN_ROLES_AND_PORTAL_SETTINGS.md`, `11_ADMIN_MONITORING_COMPLETION.md`                             |
| 6           | `07_DEVICE_INVENTORY_EDIT_DELETE_AND_ACTION_UX.md`                                                       |
| 7           | `08_BULK_NODE_CREATION.md`                                                                               |
| 8           | `09_NODE_ASSIGNMENT_APPEND_REPLACE_PROTOCOL.md`                                                          |
| 9           | `10_MONITORING_CARD_TABLE_AND_NODE_DETAIL_CHARTS.md`                                                     |
| 10          | `03_DESIGN_SYSTEM_FOUNDATION_AND_APP_SHELL.md`, `12_GLOBAL_UI_UX_MODERNIZATION_AND_RESPONSIVE_POLISH.md` |
