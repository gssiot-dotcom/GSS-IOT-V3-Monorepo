# GSS IoT V3 — Implementation Plan

## Delivery principle

Yangi loyiha eski repositoryni in-place refactor qilish orqali emas, yangi monorepoda vertical slice usulida quriladi. Eski loyiha business flow, MQTT contract, rasmlar va foydali UX behavior uchun reference bo‘ladi.

> Current execution note: the post-Phase-6 execution order in `docs/prompts/2nd-step/00_README_EXECUTION_ORDER.md` supersedes the older alarm-oriented numbering below. In the current repository state, Phase 7 is route/session stabilization and Phase 8 is MQTT-backed device provisioning. Alarm levels, fault filters, classification, occurrence counting, notifications and reports start only in later second-step phases.

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

## Later second-step phases — Alarm levels, occurrence count, operations and reports

### Ishlar

- AlarmLevel: caution/warning/danger thresholds.
- AlarmRule va AlarmRecipientPolicy.
- CompanyPosition + scope recipient resolver.
- AlarmCounterState transaction logic.
- `requiredOccurrenceCount` (`회수`) va `countIntervalSeconds` (`지속시간`).
- Safe/severity transition reset.
- AlarmEvent, AlarmNotification, AlarmDeliveryLog.
- In-app va selected external provider adapter.

### Exit criteria

- `회수=3`, `지속시간=3분` timeline testlari o‘tadi.
- Interval ichidagi readings historyga yoziladi, counter oshmaydi.
- Triggerdan keyingi eligible reading yangi cycle boshlaydi.
- Duplicate MQTT reading counter yoki notificationni takrorlamaydi.

## Phase 9+ — Reports va audit

### Ishlar

- ReportJob va ReportExport queue.
- Company, device, monitoring, sensor, alarm, MQTT va audit reports.
- View/export permission separation.
- Company/site/building scope filtering.
- File expiration va download audit.

### Exit criteria

- Company user scope tashqarisidagi report data chiqarmaydi.
- Katta export request lifecycle orqali ishlaydi.

## Phase 10 — Migration, hardening va deployment

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
