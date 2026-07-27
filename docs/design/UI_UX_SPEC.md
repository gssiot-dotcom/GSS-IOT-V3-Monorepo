# GSS IoT V3 — UI/UX Specification

## 1. Product surfaces

Bitta React application ichida ikkita authorization surface mavjud:

```txt
/admin/*    GSS Admin Portal
/company/*  Company Dashboard
```

Ular shared UI package va auth primitivesdan foydalanadi, lekin navigation, landing page, permission catalog va scope contextlari ajratilgan.

## 2. Universal UX states

Har bir data sahifada quyidagilar explicit bo‘lishi shart:

- loading skeleton;
- empty state va keyingi action;
- recoverable API error;
- forbidden 403;
- inactive/session expired 401;
- partial data/provider failure;
- offline/reconnecting realtime status;
- destructive confirmation;
- successful mutation feedback.

## 3. GSS Admin Portal navigation

### Overview

- Welcome
- Dashboard
- Monitoring
- Alarms

### Organizations

- Companies
- Construction sites
- Buildings
- Company users/positions

### Devices

- Device inventory
- Gateways
- Nodes
- Assignments
- Gateway commands

### Operations

- Alarm levels
- Alarm rules
- Reports
- Audit logs

### Settings

- GSS admin users
- GSS roles
- Permission catalog
- System settings

Sidebar items permission bo‘yicha filter qilinadi. Deep link route ham `RequirePermission` bilan himoyalanadi.

## 4. Company Dashboard navigation

- Welcome
- Dashboard
- Construction sites
- Buildings
- Monitoring
- Alarms
- Reports
- Users
- Roles
- Permissions
- Settings

Platform manager company-wide ko‘radi. Site/building scoped users ro‘yxat va selectorsda faqat ruxsat etilgan resourcesni ko‘radi.

## 5. Main workflows

### GSS setup workflow

```txt
Create company
→ create/assign platform manager
→ register/import devices
→ assign devices to company
→ create construction site/building
→ assign gateway to building
→ connect nodes by MQTT command
→ verify acknowledgement
→ company user monitors nodes
```

UI bu flowda step status va missing prerequisitesni ko‘rsatadi. Invalid orderdagi actionlar backendda ham rad etiladi.

### Monitoring workflow

```txt
Select construction site
→ select building
→ view building overview
→ choose one of 3 legacy node type cards
→ view nodes and realtime values
→ open node detail/history
```

### Alarm configuration workflow

```txt
Select scope + node type
→ configure caution/warning/danger thresholds
→ create severity rule
→ choose company position or specific user
→ set required occurrence count (회수)
→ set count interval (지속시간)
→ choose channel
→ review policy matrix
→ save with audit note
```

The UI must explicitly label:

```txt
회수: valid sensor count
지속시간: minimum interval between counted values
```

Do not label `지속시간` as send delay.

### Alarm operations workflow

```txt
Alarm badge/list
→ open detail
→ inspect scope, node, severity and count evidence
→ inspect recipients/delivery result
→ acknowledge or resolve if permitted
```

## 6. Page composition rules

### List pages

```txt
PageHeader
FilterBar/Search
Summary badges optional
DataTable
Pagination
Create/Export action by permission
```

### Detail pages

```txt
Breadcrumb
Header with status/actions
Summary cards
Tabs: overview/history/assignments/audit
Danger zone only for authorized admin
```

### Monitoring pages

```txt
Scope header/selectors
Realtime connection status
Node-type selection or node grid
Status summary
Node readings/cards/table
Optional building plan visualization
```

### Settings pages

Use full-page forms for complex settings. Show last updated by/time and audit history link.

### Permission catalog pages

Admin `/admin/settings/permissions` and Company `/company/permissions` are
read-only catalogs. The Admin route and sidebar require `permissions.view`; the
Company route and sidebar require `company-permissions.view`. Admin receives
only GSS/BOTH records and Company receives only COMPANY/BOTH records from their
separate backend endpoints. Search covers key, module and API-supplied
description. Desktop uses a compact accessible table and mobile uses readable
cards. Neither route exposes checkboxes or create, edit, delete or save actions.

Both pages distinguish loading, empty, search-empty, recoverable API error,
forbidden and inactive-session states with the shared state components. Route
guards and backend permissions are independent; hiding a sidebar item is UX,
not the security boundary.

## 7. Realtime UX

- Show connected/reconnecting/offline state.
- Do not clear last known node value on temporary socket disconnect.
- Mark value age/lastSeenAt.
- Deduplicate toast/badge events by notification/event ID.
- Permissionless user must not subscribe or call protected notification endpoint.

## 8. Alarm policy matrix UI

Recommended columns:

```txt
Position/User
Caution: enabled, count, interval, channel
Warning: enabled, count, interval, channel
Danger: enabled, count, interval, channel
Scope
Status
Actions
```

For Korean display:

```txt
발송여부
회수(유효 센서값 횟수)
지속시간(카운트 최소 간격)
```

Validation:

- required count >= 1;
- interval >= 0;
- at least one recipient target and channel;
- position assignment must intersect rule scope;
- threshold order must be valid;
- duplicate policy combinations blocked or clearly merged.

## 9. i18n

- Primary supported locale begins with Korean based on the legacy product.
- Keep English fallback.
- No hardcoded user-facing strings.
- Domain terms use one normalized key across UI, API and docs.
- Korean UI title uses `건설현장`; code/DB may use `constructionSite` if the accepted blueprint naming is updated accordingly.

## 10. Task 12 final responsive and state contract

All active Admin and Company routes use the same shell and page composition contract:

```txt
PortalLayout
→ PageHeader (title, subtitle, permitted actions)
→ scope/filter region where applicable
→ summary/section surfaces
→ table, card grid or monitoring workspace
→ pagination/detail drawer where applicable
```

Page headers wrap their action group instead of allowing horizontal overflow. Data tables scroll horizontally at narrow widths and expose a mobile card or detail-drawer path for workflows where rows are not usable as a table. Compact icon actions require a tooltip and `aria-label`; destructive actions retain confirmation and mutation feedback.

Every data route must distinguish loading, empty, recoverable error, forbidden and inactive-session states. Realtime routes additionally preserve the last known value and show connecting, reconnecting or offline state as text plus status styling. Partial optional-provider failures stay local to the affected panel where the route already supports that behavior.

The active navigation inventory has a concrete route branch for every permission-filtered shell item; no approved nav item intentionally renders the generic placeholder. Detail URLs remain protected independently from their parent list route. Authenticated full-route browser coverage is intentionally deferred until a deterministic session/bootstrap fixture is available; permission and scope behavior remains covered by the existing focused tests and API E2E suites.

### Accessibility smoke contract

- keyboard focus is visible on links, buttons, form controls, tables and drawers;
- every meaningful image has alt text;
- status is never conveyed by color alone;
- mobile smoke checks verify no horizontal document overflow for the legacy node-type selection surface;
- login, protected-route redirect and no-placeholder behavior are covered by deterministic Playwright smoke tests.

### Targeted post-Wave-4 chart and responsive contract

- Dashboard KPI and realtime monitoring summary sets remain one row at
  1280x800 and 1440x900, then wrap deliberately at tablet/mobile widths.
- Telemetry volume means daily unique `SensorReading` count for the selected UTC
  range. Its KPI remains the exact total; the chart retains the documented
  bounded 10,000-timestamp source and labels that limitation when it affects the
  visible trend.
- Telemetry and node-history points are keyboard focusable and mouse-hoverable.
  Their styled portal tooltip gives full date/time and localized values/status,
  remains inside the viewport and clears on pointer exit or blur.
- Angle/gangform history keeps both X/Y series and reference/zero semantics;
  door history keeps its existing bounded history meaning. No chart adds an
  unbounded query or per-card request.
- `/company/monitoring` keeps the existing scoped buildings query and navigation
  path while presenting a three/two/one-column whole-card entry grid with one
  semantic Active/Inactive badge.

## 11. Intentionally deferred visual work

Theme switching, full-route authenticated screenshot baselines and production visual-regression tooling remain outside this pre-Phase-14 wave. These are presentation infrastructure decisions, not authorization, scope, MQTT, alarm or reports behavior.

## 12. Company logo workflow and shell branding

The authenticated shell presents one platform identity in the header and, for Company users, one
tenant identity in the sidebar. Route titles and breadcrumbs remain translated. Existing account,
theme, notification and realtime controls retain their behavior and priority.

`/company/settings` loads company metadata through `settings.company.view`. Every such viewer sees
the current logo or fallback. Only `settings.company.manage` exposes choose, upload/replace and
confirmed remove controls. Selecting a file shows a local preview and cancel action; successful
mutation refreshes the sidebar immediately. Invalid type/size, API denial and storage failure are
local recoverable errors and do not discard the contact form.

The Admin Company Detail edit dialog loads the logo with `companies.view` and exposes mutation only
with `companies.update`. Name/code PATCH and logo multipart/delete calls are deliberately separate:
a logo error does not prevent a valid name/code save, and a name/code error does not roll back an
already committed logo operation.

Responsive acceptance covers 1440x900, 768x1024 and 375x812 in light and dark themes. Mobile keeps
the brand mark and burger visible, hides lower-priority route context when necessary, and shows the
Company tenant brand when the drawer opens. No viewport may introduce document-level horizontal
overflow.
