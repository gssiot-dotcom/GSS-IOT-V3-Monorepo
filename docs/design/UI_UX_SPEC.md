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

Responsive acceptance covers 1440x900, 1280x800, 768x1024, 390x844 and 375x812 in light and dark
themes. Mobile keeps the theme-selected SVG, visible localized wordmark and burger available,
hides lower-priority route context when necessary, and shows the Company tenant brand when the
drawer opens. No viewport may introduce document-level horizontal overflow.

Admin Company Detail is full-width beneath a route-derived `WorkspaceTabs` bar. Overview, Sites,
Buildings, Users and Devices preserve their nested URLs and refresh/deep-link selection. Admin
Devices, Company Devices, Company Monitoring, Alarm Detail and nested Company Detail device lists
use the same visual/keyboard contract.

Reversible lifecycle actions show exactly one of Activate/Deactivate (or Enable/Disable). Permanent
Delete is separated by a divider, uses its own named confirmation and stays open on failure.
Server-derived blocker text is shown without treating it as authorization. List pagination appears
in the header as localized range/total, 50/100 selector and navigation; search/filter/size changes
reset page one.

## Building image and history controls

- Building PLAN and REAL images use one reusable preview-card manager in Admin and Company, with
  count/max tabs, overflow delete confirmation and full loading/empty/error/forbidden states.
- Node history defaults to Hour/12 and exposes Hour 1/12/24 plus Day date selection. Range changes
  refetch chart and table data and reset the table to page one.
- Dense chart ranges show sampled-data metadata rather than silently dropping points.
- Create Alarm Rule uses a large responsive modal, the shared two-column desktop form grid and a
  single column on small screens.

## Alarm configuration and bulk history workflow

Alarm Rule summaries remain row-based. The Policies collection is a columnar table showing Rule,
Target, Building, Severity, Required occurrences, Count interval seconds, Channel, Status and
no Actions column. Its complete keyboard-focusable row opens the Policy and ignores nested
interactive descendants. The open row has a visible selected state. Opening a Policy shows its
Rule, Company/Site/Building scope, target, severity, node type, channel, counter settings, lifecycle
status and counter/trigger/notification history counts in a responsive Drawer. The Drawer is the
only Policy mutation surface and owns permission-aware Edit, Activate/Deactivate and Delete actions.

Delete Rule/Policy means archive: the confirmation explains that evaluation and future delivery
stop while prior alarm, notification and audit evidence stays available. Operators never have to
delete immutable history to retire configuration.

Alarm and Notification lists provide row selection and Delete selected immediately left of the
shared pagination controls. Select all means selectable rows on the current loaded page. Unresolved
Alarm Events cannot be selected or archived; mixed invalid selections fail atomically rather than
partially disappearing. Every successful mutation clears selection and refreshes counts/list state.

## Construction Site and Building card workflow

Card view uses the shared domain-specific organization resource card. Construction Sites expose
location identity, code, address and status. Buildings expose the parent Site, building code,
address/status and one prominent Open monitoring footer action where monitoring is available.
Overflow menus contain secondary lifecycle and management actions and never activate the card.

## 13. Targeted Administrator, Company identity and monitoring media correction

`/admin/settings/admin-users` is a responsive operational list with search, 50/100 pagination,
loading/empty/search-empty/error/forbidden/session states and a readable row Drawer. Create/Edit use
one modal; role/status/password fields never echo stored credentials. Lifecycle confirmations keep
backend blocker/error text usable, and actions are absent when their exact `admin-users.*`
permission is absent.

The Admin Companies card view now leads with private Company logo/initials, code/name/status and
existing contact/location information. The full card opens Company detail with click, Enter or
Space; any overflow descendant is excluded from card activation. The existing table remains the
alternate view.

Realtime node workspaces add Building plan image and Real image `WorkspaceTabs` beside their
existing state/history/configuration tabs when `building-plans.view` is present. Each type resolves
its own ordered image/empty/loading/error state. Initial fit shows the complete image without crop;
zoom in/out, pointer-centered wheel zoom, pointer-capture drag pan, Reset and Fit remain touch and
keyboard accessible. The viewer contains overscroll and pan without introducing document overflow.

The Company Dashboard compact KPI set includes Company users, defined as active users in the
authenticated Company. The Company logo plate removes CSS padding and enlarges contained visible
content while retaining skeleton, initials, missing and error states in light/dark desktop/mobile.

## Archive and Sensor History

`/admin/archive` is permission-hidden unless `archive.view` is effective. It groups evidence by
Company and domain, supports backend filters/search/50-or-100 pagination, and exposes read-only
metadata/detail. Its permanent-delete modal shows backend counts, preserved global device counts,
irreversible DB/private-storage impact, exact-name confirmation, progress/error/retry and optional
evidence download. Company has no archive route or purge control.

`/admin/monitoring/history` and `/company/monitoring/history` use the documented hierarchy, date,
severity and fault-filter filters. Company scope derives from the session and backend access; GSS
adds Company selection. Export creates the existing `SENSOR_HISTORY` report job. GSS-only filtered
purge is permission-gated and must use a server-side filter snapshot, never browser-collected IDs.

## Archive Center and Sensor History completion

- `/admin/archive` supports entity type, Company/Site/Building, date, actor and search filters;
  parent-derived badges; subtree detail Drawer; CSV/XLSX job status/download; and purge
  preview/progress/failure/retry.
- `/admin/monitoring/history` uses Company → Site → Building → Node Type → Node selectors.
- `/company/monitoring/history` omits Company and physical-purge controls and applies
  Site → Building → Node Type → Node scope.
- Both history pages provide range, severity, fault, chart, table, 50/100 pagination, loading,
  empty and error states. Global route/session boundaries provide forbidden and inactive-session
  handling.

## Runtime language behavior

The protected Admin and Company shells expose a keyboard-accessible globe menu immediately before
the theme toggle. Korean is selected when no valid preference exists. Selecting 한국어 or English
updates every catalog-backed route, modal, drawer, table, state, validation summary and accessible
label in place; route, auth session, filters, pagination and color scheme are not reset. The choice
is stored under `gss-iot.locale.v1` and `html[lang]` is kept in sync.

Backend error `code` values are mapped to localized, actionable UI copy; unknown codes use a
localized HTTP-status category and raw backend text remains technical detail only. Notification
template snapshots and report-export locale snapshots keep system-generated content deterministic.
CSV/XLSX headers, semantic status values and filenames follow the requesting locale while IDs,
timestamps and audit evidence remain stable. Permission scope/action/module descriptions and the
three canonical node-type labels use key-driven display mappings.

Any new user-facing JSX literal, implicit browser-locale formatter, catalog-key mismatch or
placeholder mismatch must fail `pnpm i18n:audit`. Responsive acceptance covers Admin and Company in
both languages at 1440×900, 1280×800 and 390×844.
