# GSS IoT V3 — Implementation Plan

## Delivery principle

Yangi loyiha eski repositoryni in-place refactor qilish orqali emas, yangi monorepoda vertical slice usulida quriladi. Eski loyiha business flow, MQTT contract, rasmlar va foydali UX behavior uchun reference bo‘ladi.

> Current execution note: the post-Phase-6 execution order in `docs/prompts/2nd-step/00_README_EXECUTION_ORDER.md` supersedes the older alarm-oriented numbering below. The approved order is Phase 9 alarm levels/fault filters/classification, Phase 10 company portal scope and management completion, Phase 11 occurrence engine, Phase 12 notifications and alarm operations UI, Phase 13 reports/dashboards/legacy parity and Phase 14 retention/migration/hardening/deployment.

## Phase 0 — Repository bootstrap va discovery freeze

### Maqsad

Codex ishni boshlashidan oldin source-of-truth, loyiha struktura va quality gate’larni tayyorlash.

### Ishlar

- pnpm workspace va Git repository yaratish.
- `apps/api`, `apps/web`, `packages/ui`, `packages/contracts`, `packages/config` scaffold qilish.
- TypeScript strict, ESLint, Prettier, Vitest/Jest, Playwright va CI bazasini o‘rnatish.
- Source material ZIPlarni faqat o‘qib, legacy inventory report yaratish.
- Exact MQTT topics, commands, node payloadlari va 3 ta node image mappingini tekshirish.
- Architecture conflict/open questionlarni `DECISION_LOG.md`ga yozish.

### Exit criteria

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` ishlaydi.
- Empty app health checks ishlaydi.
- Docs va source-material manifest mavjud.
- Production feature hali yozilmagan.

## Phase 1 — Database, auth va RBAC foundation

### Ishlar

- Prisma schema: users, roles, permissions, direct permissions, companies, construction sites/buildings.
- GSS admin va company auth contextlarini ajratish.
- `JwtAuthGuard`, `ActiveUserGuard`, `PermissionsGuard`, company/site/building scope guards.
- Super admin bypass va safe-admin policy.
- Permission catalog, default roles va initial super admin seed.
- Frontend `RequireAuth`, `RequirePermission`, `Can`, sidebar filtering.

### Exit criteria

- Super admin explicit permission rowsiz protected endpointga kira oladi.
- No-permission user login qiladi, lekin protected API 403 qaytaradi.
- Inactive user login va existing token orqali bloklanadi.
- Company user boshqa company/building scopeiga kira olmaydi.

## Phase 2 — Design system va application shells

### Ishlar

- `packages/ui`da GSS theme va reusable componentlar.
- Mantine + Tabler icons, Parfumbox component patterns.
- Admin va Company layout, sidebar, header, breadcrumb, profile, notification bell.
- Loading, empty, error, forbidden, session-expired komponentlari.
- Node type selection cardni legacy images bilan qayta qurish.
- i18n skeleton va route-permission mapping.

### Exit criteria

- Story/demo route orqali barcha base componentlar ko‘rinadi.
- Light/dark tokenlar consistent.
- Node type card visual regression screenshot testdan o‘tadi.

## Phase 3 — Organization va company user management

### Ishlar

- Company CRUD.
- Construction site va building CRUD.
- Building plan/real image upload.
- Company users, roles, permissions, direct permissions.
- Company positions/lavozim catalogi va scoped position assignments.
- Assignment va role changes audit log.

### Exit criteria

- GSS admin company va platform manager yaratadi.
- Company platform manager faqat o‘z companysi ichida user/role/scope boshqaradi.
- Last platform manager self-lockout bloklanadi.

## Phase 4 — Device inventory va assignment history

### Ishlar

- NodeType, Gateway, Node inventory.
- CompanyDeviceAssignment, GatewayBuildingAssignment, NodeGatewayAssignment.
- Active assignment unique constraints.
- Device lifecycle va assignment audit.
- Admin/device manager UI.

### Exit criteria

- Bir gateway bir vaqtning o‘zida faqat bitta active buildingga biriktiriladi.
- Bir node bir vaqtning o‘zida faqat bitta active gatewayga biriktiriladi.
- Move/unassign tarixi saqlanadi.

## Phase 5 — MQTT va GatewayCommand outbox

### Ishlar

- MQTT client, topic resolver, parser va response handler.
- Legacy commands `cmd 2/3/4/5` contractlarini typed adapterga o‘tkazish.
- GatewayCommand outbox, ack, retry, expire va reconnect processing.
- Raw log retention va secret redaction.
- Command status Admin UI.

### Exit criteria

- Online gateway command `sent -> acknowledged` bo‘ladi.
- Offline gateway command `pending` bo‘lib reconnectdan keyin yuboriladi.
- Duplicate ack yoki retry state buzmaydi.

## Phase 6 — Monitoring va realtime

### Ishlar

- SensorReading insert, LatestNodeState upsert.
- MQTT message deduplication.
- Building/nodeType scoped monitoring endpoints.
- Socket.IO room auth: permission + scope.
- Door, angle va gangform monitoring pages.
- Sensor history pagination/retention strategy.

### Exit criteria

- UI 3 ta legacy node-type card orqali monitoringga kiradi.
- Faqat selected building gatewaylaridagi nodes qaytadi.
- Unauthorized room join rad etiladi.

## Phase 7 — Route/session stabilization and company setup completion

### Ishlar

- Restore GSS Admin and Company auth sessions from stored bearer token and `/me` endpoints.
- Add context-aware NotFound behavior for authenticated `/admin/*` and `/company/*` routes.
- Add explicit Admin company detail/setup routes for overview, sites, buildings, users and devices.
- Improve company create/edit/deactivate UX without weakening backend permissions.

### Exit criteria

- Admin Company Open no longer falls through to login.
- Direct links and browser refresh restore valid sessions.
- Unknown authenticated routes render NotFound or Forbidden correctly.
- Phase 7 route/session tests and full verification pass.

## Phase 8 — Device provisioning and MQTT-backed node assignment

### Ishlar

- Link `REGISTER_NODES` GatewayCommand (`cmd: 2`) to a relational provisioning request with selected company, building, gateway, node type and node IDs.
- Require strict successful gateway acknowledgement before creating active `NodeGatewayAssignment` rows.
- Reject cross-company, wrong-building, mixed-type and already-assigned node selections.
- Preserve pending, sent, failed, expired, cancelled, retry, duplicate and late-ACK behavior through the GatewayCommand outbox.
- Stamp `requestId = GatewayCommand.id` into final outbound cmd 2/3/4/5 payloads after command persistence, reuse it on retry and prefer exact requestId response correlation before strict legacy gateway/cmd fallback.
- Preserve legacy MQTT node-number wire compatibility by publishing cmd 2/cmd 5 node arrays as JSON numbers while retaining string node numbers in database/domain state.
- Replace raw UUID node-to-gateway UI with guided company/building/gateway/node-type/node selectors.
- Document DB-only unassign until hardware unregister/sync protocol is confirmed.

### Exit criteria

- Successful cmd 2 acknowledgement atomically creates active assignments.
- Failed, expired, cancelled, timeout, negative, duplicate or late responses do not create false assignments.
- Fast ACK before `SENT` does not regress acknowledged/failed terminal state.
- Admin UI does not require manual UUID entry for provisioning.
- Existing Phase 5 command and Phase 6 monitoring behavior remains green.
- Real hardware live gateway acknowledgement check is completed before Phase 8 is declared complete.
- Phase 8 closure records one explicitly selected live-test gateway for the run; the gateway serial is evidence, not a permanent architectural constant. The acknowledged `cmd=2` command must belong to that selected gateway, use `requestId = GatewayCommand.id`, correlate the ACK to the same command, create exactly one active assignment for each requested node, point every assignment to the same selected gateway and keep duplicate/audit side effects idempotent.

## Phase 9 — Alarm levels, fault filters and authoritative classification

### Ishlar

- Building + node-type alarm-level desired configuration and version history.
- Per-gateway desired/applied cmd 4 application state through existing GatewayCommand outbox.
- Gateway + node-type + node fault-filter desired/applied state through existing cmd 5 outbox.
- Door classification from `doorChk`.
- Angle/gangform classification from `max(abs(angleX), abs(angleY))`.
- Explicit `UNCONFIGURED` state for missing angle/gangform configuration.
- Monitoring UI controls from building monitoring without raw UUID entry.

### Exit criteria

- Desired/applied state links to exact GatewayCommand/requestId.
- cmd 4 and cmd 5 use existing requestId correlation and lifecycle.
- Backend classification is authoritative and payload status is diagnostic only.
- Automated checks pass.
- Live cmd 4 and cmd 5 hardware verification passes before Phase 9 is marked complete.

## Phase 10 — Company portal scope and management completion

### Ishlar

- Complete company user/role/scope/position management UI.
- Complete role permission editor, scope assignment and position assignment.
- Keep backend permission + company/site/building scope as the security boundary.
- Add safe custom-role edit/delete rules without changing default/system roles.
- Add read-only effective permission and resource-scope preview.
- Complete Company area detail, building detail and building-plan metadata routes.
- Keep building-plan binary upload/provider integration deferred until the storage-provider decision is approved.

### Exit criteria

- Company portal management workflows work without raw IDs.
- Scope and permission denial paths are covered.
- `PHASE_10_IMPLEMENTED_AUTOMATED_VERIFIED_MANUAL_UI_PENDING` is the correct status until the manual browser checklist is completed.

## Phase 11 — Alarm occurrence count engine

### Ishlar

- AlarmRule va AlarmRecipientPolicy.
- CompanyPosition + scope recipient resolver.
- AlarmCounterState transaction logic.
- `requiredOccurrenceCount` (`회수`) va `countIntervalSeconds` (`지속시간`).
- Safe/severity transition reset.
- AlarmEvent evidence model without notification delivery side effects leaking into counting.

### Exit criteria

- `회수=3`, `지속시간=3분` timeline testlari o‘tadi.
- Interval ichidagi readings historyga yoziladi, counter oshmaydi.
- Triggerdan keyingi eligible reading yangi cycle boshlaydi.
- Duplicate MQTT reading counter yoki notificationni takrorlamaydi.

## Phase 12 — Notifications and alarm operations UI

### Ishlar

- AlarmNotification, AlarmDeliveryLog and provider retry.
- In-app va selected external provider adapter.
- Alarm list/detail/ack/resolve UI.

### Exit criteria

- Recipients resolve from CompanyPosition + scope.
- Alarm operations remain permission and scope guarded.

## Phase 13 — Reports, dashboards and legacy parity

### Ishlar

- ReportJob va ReportExport queue.
- Company, device, monitoring, sensor, alarm, MQTT va audit reports.
- View/export permission separation.
- Company/site/building scope filtering.
- File expiration va download audit.

### Exit criteria

- Company user scope tashqarisidagi report data chiqarmaydi.
- Katta export request lifecycle orqali ishlaydi.

## Phase 14 — Retention, migration, hardening and deployment

### Ishlar

- Legacy Mongo export/transform/import scripts.
- Naming normalization: `gangform/vertical`, snake/camel variants.
- Performance indexes, sensor partitioning/retention.
- Security review, dependency scan, rate limit va provider failure drills.
- Docker, staging, production CI/CD, backup/restore runbook.
- User acceptance test va rollback plan.

### Exit criteria

- Migration rehearsal va reconciliation report tayyor.
- Staging smoke/E2E/security checks o‘tadi.
- Production deployment va rollback runbook sinovdan o‘tgan.
