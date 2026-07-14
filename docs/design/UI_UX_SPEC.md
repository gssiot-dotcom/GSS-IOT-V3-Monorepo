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
