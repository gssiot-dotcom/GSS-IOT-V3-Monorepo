# GSS IoT V3 — Decision Log

## Format

```txt
DEC-YYYY-NNN
Status: proposed | accepted | superseded
Context:
Decision:
Consequences:
Files affected:
```

## DEC-2026-001

**Status:** accepted

**Context:** Eski GSS loyihada Express/Mongoose modul va route responsibilitylari aralash.

**Decision:** Yangi greenfield pnpm monorepo quriladi. Eski code production architecture sifatida ko‘chirilmaydi.

**Consequences:** Legacy business flow, MQTT contracts va assets extraction qilinadi; implementation NestJS/Prisma orqali qayta yoziladi.

## DEC-2026-002

**Status:** accepted

**Context:** Parfumbox admin componentlari izchil, eski GSS rang va node cardlari domain identityni saqlaydi.

**Decision:** UI component system Mantine + Tabler icons va Parfumbox admin patterns bo‘ladi. Ranglar GSS palette’dan olinadi. Old GSS node-type card rasmlari va image-first layout saqlanadi.

**Consequences:** Yangi loyihada Mantine va shadcn parallel primary systems sifatida ishlatilmaydi.

## DEC-2026-003

**Status:** accepted

**Context:** Alarm manualidagi `회수` notification send count deb noto‘g‘ri talqin qilinishi mumkin.

**Decision:** `회수 = requiredOccurrenceCount`; `지속시간 = countIntervalSeconds`, ya’ni eligible sensor counts orasidagi minimal interval.

**Consequences:** Counting PostgreSQL transaction state bilan yuritiladi; BullMQ timing source-of-truth emas.

## DEC-2026-004

**Status:** accepted

**Context:** Alarm manualidagi lavozimlar RBAC role emas.

**Decision:** `CompanyRole`, `CompanyPosition` va resource scope alohida modellardir. Position + scope notification recipientni, role permissions esa UI/API accessni boshqaradi.

## DEC-2026-005

**Status:** accepted

**Context:** Counter history sensor history bilan birga tez o‘sishi xavfi.

**Decision:** `alarm_counter_states` har node-policy uchun bitta mutable row bo‘ladi. Eligible reading IDs faqat event evidence sifatida kerakli darajada saqlanadi.

## DEC-2026-006

**Status:** accepted

**Context:** Phase 0 initially resolved Prisma 7.8.0 while the repository schema used the Prisma 6 datasource configuration with `url` in `schema.prisma`.

**Decision:** Pin `prisma` and `@prisma/client` to the same explicit version, `6.19.0`, and keep the existing environment-backed PostgreSQL datasource configuration.

**Consequences:** Prisma validation remains compatible with the Phase 0 schema and does not introduce Prisma 7 configuration or business schema changes. Future Prisma upgrades require a separate documented decision and validation pass.

**Files affected:** `apps/api/package.json`, `apps/api/prisma/schema.prisma`, `pnpm-lock.yaml`.

## DEC-2026-007

**Status:** accepted

**Context:** Workspace source aliases caused app builds to compile arbitrary files outside their configured projects and broke project-reference checks.

**Decision:** Use a root TypeScript solution that references buildable workspace projects. Shared packages publish their compiled `dist` declarations and runtime entry points through package exports; apps import workspace package names rather than source-relative paths.

**Consequences:** `pnpm typecheck` and `pnpm build` have one consistent dependency order, while package boundaries remain explicit for later feature work.

**Files affected:** `tsconfig.json`, `tsconfig.base.json`, `apps/api/tsconfig.build.json`, `apps/web/tsconfig.build.json`, `packages/*/package.json`.

## DEC-2026-008

**Status:** accepted

**Context:** The blueprint migration appendix labels inventory extraction as Phase 1, while the repository delivery plan and approved Phase 1 prompt define the next deliverable as database/auth/RBAC foundation.

**Decision:** Repository delivery phases follow the approved prompt and planning documents. The blueprint appendix remains an architectural migration sequence, not the execution phase numbering.

**Consequences:** Phase 1 implements the RBAC foundation without starting legacy inventory migration.

## DEC-2026-009

**Status:** accepted

**Context:** `PAGE_INVENTORY.md` uses prefixed permission keys and construction-site terminology that conflict with the authoritative architecture blueprint.

**Decision:** Use the blueprint's unprefixed `module.action` permission keys and `ConstructionArea`/`areas` persistence terminology. Korean UI copy may still use the normalized construction-site translation key.

**Consequences:** Page inventory documentation will be reconciled in a documentation-focused follow-up; Phase 1 does not introduce a second permission namespace.

## DEC-2026-010

**Status:** accepted

**Context:** Token transport, lifetime, and revocation were not previously specified.

**Decision:** Phase 1 uses separate short-lived bearer JWT contexts with explicit audiences and per-user `tokenVersion` invalidation on logout. A logout invalidates all active tokens for that user; refresh-token and per-device session support are deferred.

**Consequences:** The API checks the persisted user status and token version on every authenticated request. The web application keeps the access token in memory for this foundation.

## DEC-2026-011

**Status:** accepted

**Context:** Phase 1 API E2E verification must use the same local environment source as the runtime API. The API entry point loads `apps/api/.env` through `dotenv/config`, while the E2E setup previously only supplied fallback values.

**Decision:** Load `dotenv/config` first in the API E2E setup, then retain non-secret fallback values only for absent test environment variables.

**Consequences:** Runtime and API E2E commands use the same configured `DATABASE_URL` when `apps/api/.env` exists. This does not change authentication, RBAC, database architecture, or deployment configuration.

**Files affected:** `apps/api/test/setup-env.ts`.

## DEC-2026-012

**Status:** accepted

**Context:** Phase 1 verification confirmed that the API runtime and API E2E both load `apps/api/.env`, and that PostgreSQL accepts the corrected credentials but reports `P1003` because the configured `gss_iot_v3` database does not exist.

**Decision:** Do not alter application architecture, credentials, migrations, or seed behavior to compensate for the missing database. Database provisioning remains an external environment prerequisite.

**Consequences:** Phase 1 remains blocked until the target database is provisioned and the existing migration, seed, and API E2E commands pass.

**Files affected:** `docs/planning/PROJECT_STATE.md`, `docs/planning/TODO.md`.

## DEC-2026-013

**Status:** accepted

**Context:** Database seed verification found that the `platform_manager` company role template received GSS-only permissions from the complete catalog.

**Decision:** Company role templates may receive only permissions whose scope type is `COMPANY` or `BOTH`. GSS-only permissions remain available only to GSS roles.

**Consequences:** The seed preserves separate GSS and Company authorization contexts while keeping `platform_manager` as the most privileged company template.

**Files affected:** `apps/api/prisma/seed.ts`.

## DEC-2026-014

**Status:** accepted

**Context:** Database-backed API E2E found that login attempted to provide the JWT audience both in the payload and signing options, which the JWT library rejects.

**Decision:** Set the JWT audience through the signing options only; the verified payload type permits the resulting `aud` claim.

**Consequences:** GSS and Company token issuance retains explicit audience separation and the RBAC E2E suite can exercise authenticated endpoints.

**Files affected:** `apps/api/src/common/auth.types.ts`, `apps/api/src/modules/auth/auth.service.ts`.

## DEC-2026-015

**Status:** accepted

**Context:** The external `gss_iot_v3` database prerequisite was completed and Phase 1 migration, seed, RBAC verification, idempotency check, and quality gates were rerun successfully.

**Decision:** Record Phase 1 as complete. Do not start Phase 2 without an explicit prompt.

**Consequences:** The applied migration history is preserved; any future schema change must use a new forward migration. The canonical seed can be rerun safely without duplicating permissions, roles, templates, or the GSS super admin.

**Files affected:** `docs/planning/PROJECT_STATE.md`, `docs/planning/TODO.md`, `docs/planning/DECISION_LOG.md`.

## DEC-2026-016

**Status:** accepted

**Context:** Phase 2 added web component tests while the root `pnpm test` command runs API and web Vitest suites concurrently on Windows. The default web Vitest fork pool can fail with `spawn EPERM` in that concurrent run even when the web tests pass in isolation.

**Decision:** Configure the web Vitest suite to use the `threads` pool.

**Consequences:** The root workspace test gate runs reliably without changing application behavior, RBAC behavior, database schema, seed data or browser E2E coverage.

**Files affected:** `apps/web/vitest.config.ts`.

## DEC-2026-017

**Status:** accepted

**Context:** Phase 2 requires a browser-verifiable story/demo surface for shared UI primitives before real organization and device data exists.

**Decision:** Add a public `/phase-2/demo` route that renders typed fixtures for the GSS theme, universal states, status/table primitives and the three legacy node-type cards. Keep real Admin and Company shell routes protected by the existing Phase 1 auth/permission guards.

**Consequences:** Phase 2 browser checks can verify the UI foundation without adding mock business APIs or bypassing production auth behavior. Phase 3 can replace placeholders with real organization/user flows.

**Files affected:** `apps/web/src/app/router.tsx`, `apps/web/src/features/shell/DesignSystemDemoPage.tsx`, `apps/web/e2e/bootstrap.spec.ts`.

## DEC-2026-018

**Status:** accepted

**Context:** The Phase 2 web app runs from Vite at `http://127.0.0.1:5173` by default, while API requests target `http://localhost:3000`. Browsers treat `localhost` and `127.0.0.1` as different origins, and the API previously did not enable CORS.

**Decision:** Add environment-driven API CORS configuration through `CORS_ALLOWED_ORIGINS`. Development and test defaults allow `http://localhost:5173` and `http://127.0.0.1:5173`; production defaults to no browser origins unless explicitly configured. Auth remains bearer-token based, so CORS credentials stay disabled and login does not set cookies.

**Consequences:** Local browser login works from both Vite origins without using wildcard CORS or weakening RBAC/auth guards. Unknown browser origins do not receive CORS allow headers.

**Files affected:** `packages/config/src/env.ts`, `apps/api/src/common/cors.ts`, `apps/api/src/bootstrap.ts`, `apps/api/src/main.ts`, `.env.example`, `apps/api/.env.example`, `apps/api/test/e2e/rbac.e2e-spec.ts`, `packages/config/test/env.spec.ts`.

## DEC-2026-019

**Status:** accepted

**Context:** Phase 3 requires building plan/real-image records, but the object-storage provider and browser upload transport remain explicit open decisions.

**Decision:** Phase 3 persists validated `BuildingPlanImage` metadata through an auditable `storageKey` API boundary. It does not introduce a local-file shortcut, provider credentials, or an unapproved S3 adapter.

**Consequences:** Organization and building-plan workflows have durable, permission- and scope-protected image references now. Binary upload and signed URL delivery will be added only with the future storage-provider decision.

**Files affected:** `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260714150000_organization_users/migration.sql`, `apps/api/src/modules/organizations/`.

## DEC-2026-020

**Status:** accepted

**Context:** Phase 4 requires gateway/node inventory and move/unassign history while preserving one active gateway-building assignment and one active node-gateway assignment. PostgreSQL unique constraints treat `NULL` values as distinct, so nullable `endedAt` alone is not a portable active-uniqueness key through Prisma.

**Decision:** Store assignment history in additive Phase 4 tables with `status`, `assignedAt`, `unassignedAt` and an `activeKey`. Active rows use `activeKey = "active"`; ended rows copy their own assignment id into `activeKey`. Unique indexes over `(gatewayId, activeKey)` or `(nodeId, activeKey)` enforce the one-active-assignment invariant while preserving unlimited ended history rows.

**Consequences:** Gateway and node moves are performed inside transactions that first end any current active row, then create the new active row and audit the change. MQTT command publishing, GatewayCommand outbox and sensor monitoring remain Phase 5/6 work.

**Files affected:** `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260714170000_device_inventory_assignments/migration.sql`, `apps/api/src/modules/devices/`.

## DEC-2026-021

**Status:** accepted

**Context:** Phase 5 must persist and correlate GatewayCommand outbox records for the legacy MQTT protocol, but the old `cmd 2/3/4/5` payloads do not include a durable command id.

**Decision:** Gateway command acknowledgement matching uses gateway serial plus MQTT `cmd` number, and the database enforces only one non-terminal command per `gatewayId + commandNumber` using `activeKey = "active"`. Terminal commands copy their own id into `activeKey`.

**Consequences:** A gateway response is never acknowledged by gateway serial alone. Duplicate acknowledgements are idempotently ignored after the command leaves `sent`, and operators must retry/cancel/expire a failed non-terminal command before another command with the same legacy `cmd` number can be active for that gateway.

**Files affected:** `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260715120000_gateway_command_outbox/migration.sql`, `apps/api/src/modules/gateway-commands/`, `apps/api/src/modules/mqtt/`.

## DEC-2026-022

**Status:** accepted

**Context:** Phase 6 must deduplicate MQTT QoS redelivery and gateway retry without discarding legitimate later readings that repeat the same sensor value. The legacy payloads do not always include a durable message id or sequence number. Sensor history retention was also still open, while Phase 10 partitioning and archival must not be implemented early.

**Decision:** Sensor deduplication uses MQTT packet message id first, then gateway payload message id, sequence number, or measured time plus normalized value hash. When a legacy payload has no reliable packet/message/sequence/measured-time key, the API stores the reading with a unique received-time key instead of dropping same-value readings. Phase 6 documents a default 180-day sensor history retention target and adds query indexes, while physical purge jobs, partitioning and archival remain Phase 10 work.

**Consequences:** Duplicate QoS redelivery and gateway retry are idempotent when the broker packet metadata or gateway payload carries a stable identifier. No-ID/no-time legacy payloads are preserved to avoid false-positive dedupe; gateways should send message id, sequence or measured time for deterministic retry dedupe. Reports, archival and partition maintenance are not introduced in Phase 6.

**Files affected:** `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260715150000_phase_6_monitoring_realtime/migration.sql`, `apps/api/src/modules/monitoring/`, `apps/api/src/modules/mqtt/`, `docs/architecture/PHASE_6_MONITORING_REALTIME.md`.

## DEC-2026-023

**Status:** accepted

**Context:** Phase 7 stabilization found that Admin Company Open navigated to `/admin/companies/:companyId`, but the frontend router had no matching route and the wildcard redirected every unknown URL to `/login`. Browser refresh and direct links also lost auth because the web app held the session only in React memory.

**Decision:** Persist only the bearer access token and auth context in `sessionStorage`, then rebuild the full `AuthSession` from the matching `/auth/gss/me` or `/auth/company/me` endpoint on app bootstrap. Add explicit GSS company detail/setup routes and protected context-aware NotFound fallbacks for unknown `/admin/*` and `/company/*` URLs.

**Consequences:** Missing routes are no longer misreported as login failures, refresh/direct URLs restore through the backend security boundary, invalid sessions are cleared and redirected to login, and GSS Admin and Company contexts remain separate. Phase 7 does not add refresh tokens, merge auth contexts, make protected pages public, or start Phase 8 device provisioning/alarm work.

**Files affected:** `apps/web/src/shared/auth/`, `apps/web/src/shared/rbac/`, `apps/web/src/app/router.tsx`, `apps/web/src/features/organizations/`, `apps/web/src/features/shell/`, `apps/web/src/test/auth-routing.spec.tsx`.

## DEC-2026-024

**Status:** accepted

**Context:** Phase 8 found that direct DB node-gateway assignment could diverge from physical gateway state, and legacy cmd 2 behavior updated DB state only after `resp === "success"`. Later legacy command docs accepted explicit success fields, but not missing error as success. Hardware unregister/remove command behavior remains unconfirmed.

**Decision:** Node-to-gateway assignment must be created through a relational `NodeGatewayProvisioningRequest` linked to a `REGISTER_NODES` GatewayCommand. Active `NodeGatewayAssignment` rows are created only in the successful ACK transaction. Strict gateway response parsing accepts only documented success values (`success/ok/ack` true or `resp/result/status` success-like values) and treats negative or missing accepted values as failed. Response topic serial matching supports exact saved serials and suffix tokens. Node-gateway unassign remains DB history only until a hardware unregister or full replacement command is confirmed.

**Consequences:** Failed, expired, cancelled, duplicate or late responses do not create active assignments. Selected node database IDs are auditable outside JSON payloads. Operators no longer use raw UUID node-to-gateway assignment; they use the MQTT provisioning flow. A future physical unassign/sync workflow needs a separate protocol decision.

**Files affected:** `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260716120000_phase_8_device_provisioning/migration.sql`, `apps/api/src/modules/gateway-commands/`, `apps/api/src/modules/devices/`, `apps/api/src/modules/mqtt/`, `apps/web/src/features/devices/AdminDevicesPage.tsx`, `docs/architecture/PHASE_8_DEVICE_PROVISIONING.md`.

## DEC-2026-025

**Status:** accepted

**Context:** Phase 8 MQTT provisioning needs production-safe operational visibility for disabled mode, broker connection lifecycle, subscriptions, publish attempts and gateway responses. MQTT credentials must not leak through logs, API responses or UI.

**Decision:** Keep MQTT observability as in-memory runtime state on `MqttClientService` and expose a protected GSS Admin status endpoint under `mqtt-commands.view`. Logs and API/UI status may include sanitized broker URL/host, client id, topic filters, command id, gateway serial, command number, payload byte size, timestamps and normalized response outcome. They must not include MQTT username or password.

**Consequences:** Operators can diagnose broker connectivity and command flow without adding schema changes or exposing secrets. Status resets on API process restart and remains an operational snapshot, not an audit trail. Durable command lifecycle remains in `GatewayCommand`; Phase 9 alarm/report work is not started.

**Files affected:** `apps/api/src/modules/mqtt/mqtt-client.service.ts`, `apps/api/src/modules/gateway-commands/`, `apps/web/src/features/gateway-commands/GatewayCommandsPage.tsx`, `packages/contracts/src/index.ts`, `docs/architecture/PHASE_8_DEVICE_PROVISIONING.md`.

## DEC-2026-026

**Status:** accepted

**Context:** Live gateway testing showed the deployed legacy backend receives acknowledgements for `cmd: 2`, while V3 did not. The wire-format difference was that V3 published node numbers as JSON strings and the legacy protocol publishes them as JSON numbers.

**Decision:** Keep node numbers as strings in database/domain state, but make the MQTT command adapter the wire-format boundary for `cmd: 2` register-node and `cmd: 5` fault-filter payloads. The adapter converts selected node numbers to safe JSON integers, preserves requested node order and rejects empty, non-numeric, unsafe, negative or numerically duplicated values before `GatewayCommand` persistence or publish. Gateway response parsing explicitly accepts legacy `resp: "success"` and `resp: "fail"` forms. Raw `GATE_RES` and malformed sensor payload diagnostics are debug-level and redact secret-like fields.

**Consequences:** The final published legacy-compatible cmd 2 JSON for selected nodes `["100", "101", "102"]` is `{"cmd":2,"nodeType":2,"numNodes":3,"nodes":[100,101,102]}`. Existing assignment, ACK, RBAC and observability architecture is preserved. Phase 9 alarm/report work is not started.

**Files affected:** `apps/api/src/modules/gateway-commands/adapters/gateway-command-adapters.ts`, `apps/api/src/modules/gateway-commands/gateway-commands.service.ts`, `apps/api/src/modules/gateway-commands/mqtt-response-handler.service.ts`, `apps/api/src/modules/monitoring/monitoring.service.ts`, `apps/api/test/gateway-commands.spec.ts`, `apps/api/test/e2e/gateway-commands.e2e-spec.ts`, `docs/architecture/PHASE_8_DEVICE_PROVISIONING.md`.

## DEC-2026-027

**Status:** accepted

**Context:** Updated gateway firmware can echo a deterministic `requestId` when present. Legacy gateway/cmd-only correlation is vulnerable to ambiguous active commands and does not protect against fast ACK races where a response arrives before the publisher marks the command `SENT`.

**Decision:** For `cmd: 2`, `cmd: 3`, `cmd: 4` and `cmd: 5`, the backend creates the `GatewayCommand` row first and then stores/publishes the final MQTT payload with `requestId` equal to `GatewayCommand.id`. Retries reuse the same id/requestId and stored payload. Response correlation prefers exact requestId and verifies gateway serial, cmd, active eligibility and command-specific fields; malformed, unknown, wrong-gateway or wrong-cmd request IDs never fall back to legacy matching. Legacy no-requestId responses match only by gateway serial plus explicit cmd when exactly one eligible active command exists. The publisher records an attempt before publish and uses conditional status updates so fast ACK/FAIL responses cannot be overwritten back to `SENT`.

**Consequences:** Live firmware can deterministically acknowledge a specific command, duplicate/late responses cannot regress terminal state or duplicate side effects, and strict legacy fallback remains available for gateways that do not echo requestId. Phase 9 alarm/fault-filter models and report features remain out of scope.

**Files affected:** `apps/api/src/modules/gateway-commands/gateway-command-publisher.service.ts`, `apps/api/src/modules/gateway-commands/gateway-commands.service.ts`, `apps/api/src/modules/gateway-commands/mqtt-response-handler.service.ts`, `apps/api/src/modules/mqtt/mqtt-client.service.ts`, `apps/api/src/modules/mqtt/mqtt-payload-parser.service.ts`, `apps/api/test/e2e/gateway-commands.e2e-spec.ts`, `apps/web/src/features/gateway-commands/GatewayCommandsPage.tsx`, `docs/architecture/PHASE_8_DEVICE_PROVISIONING.md`.

## DEC-2026-028

**Status:** accepted

**Context:** Phase 8 live hardware verification was completed with physical ESP32 gateway serial `0300`, nodes `100`, `101` and `102`, and GatewayCommand `160b3e5c-139d-479b-8535-a82f25f95b02`. A prior closure checklist mentioned a specific gateway serial as if it were a permanent acceptance requirement.

**Decision:** Phase 8 completion requires one explicitly selected live-test gateway to be recorded for the verification run, not a hardcoded architectural serial. The acknowledged `cmd=2` GatewayCommand must belong to that selected gateway, `requestId` must equal `GatewayCommand.id`, the ACK payload must correlate to the same command, nodes `100`, `101` and `102` must each have exactly one active `NodeGatewayAssignment`, every resulting assignment must point to the same selected gateway, every `sourceCommandId` must reference the acknowledged command, and duplicate command/audit side effects must remain idempotent. For the completed live run, the selected gateway is `0300`.

**Consequences:** Phase 8 can close on the verified `0300` hardware evidence without manufacturing a new command for another gateway. Future hardware verification records may select a different gateway as long as they satisfy the same invariants. Firmware responses for `cmd 2/3/4/5` now contain `cmd` and echo `requestId` when supplied, while strict legacy no-requestId fallback remains supported.

**Files affected:** `docs/planning/PROJECT_STATE.md`, `docs/planning/TODO.md`, `docs/planning/IMPLEMENTATION_PLAN.md`, `docs/planning/DECISION_LOG.md`, `docs/architecture/PHASE_8_DEVICE_PROVISIONING.md`, `docs/prompts/2nd-step/03_PHASE_8_MQTT_PROTOCOL_BASELINE.md`, `docs/prompts/2nd-step/99_OPEN_DECISIONS.md`.

## DEC-2026-029

**Status:** accepted

**Context:** Phase 9 needed explicit alarm-level, fault-filter and classification decisions before implementation. Legacy code used `BuildingAlarmLevel.green/yellow/red`, `GatewayAlarmSetting`, cmd 4/cmd 5 and raw absolute X/Y angle behavior, while Phase 6 monitoring still treated payload status as authoritative for angle/gangform fallback.

**Decision:** Phase 9 maps legacy `green/yellow/red` to `cautionThreshold/warningThreshold/dangerThreshold`, scoped by building + node type. Enabled angle/gangform configurations require `0 < caution < warning < danger <= 12` and classify inclusively using `metric = max(abs(angleX), abs(angleY))`. Door remains `doorChk = 0 => safe` and `doorChk = 1 => danger`; door cmd 4 controls enabled/alarmEnabled only. Calibration is deferred because the active legacy MQTT classification used raw absolute `angle_x/angle_y`. Missing angle/gangform configuration is explicit `UNCONFIGURED`, not safe. Fault-filter desired state is persisted by gateway + node type + node; applied state changes only after strict successful cmd 5 ACK for the exact GatewayCommand/requestId. ACK-applied filtered readings remain in SensorReading/latest state with `faultFiltered=true` evidence and are reserved for future occurrence-count exclusion.

**Consequences:** Phase 9 adds additive Prisma state for desired/applied alarm levels and fault filters, extends monitoring status with `UNCONFIGURED`, stores classification evidence and preserves the existing GatewayCommand outbox and requestId lifecycle. Occurrence counting, AlarmEvent, recipient resolution, notifications, reports, calibration, retention, partitioning, migration and deployment remain out of scope.

**Files affected:** `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260718120000_phase_9_alarm_levels_fault_filters/migration.sql`, `apps/api/src/modules/alarm-levels/`, `apps/api/src/modules/gateway-commands/`, `apps/api/src/modules/monitoring/`, `apps/web/src/features/monitoring/CompanyMonitoringPage.tsx`, `packages/contracts/src/index.ts`, `packages/ui/src/status-badge.tsx`, `docs/architecture/PHASE_9_ALARM_LEVELS_FAULT_FILTERS_CLASSIFICATION.md`.

## DEC-2026-030

**Status:** accepted

**Context:** Manual browser testing found the GSS Admin company-user create form showed an empty role dropdown for Company A. Database inspection showed Company A had no company-owned `CompanyRole` rows, while the default system templates existed. The company predated the current default-role provisioning path and its legacy test users referenced non-company-owned roles.

**Decision:** The approved per-company default role keys are `platform_manager`, `site_manager`, `building_manager`, `viewer` and `no_permission`. Company creation provisions these roles from system templates idempotently, seed backfills all existing companies, and company role listing backfills the requested company before returning roles. Existing roles with approved keys are updated in place instead of duplicated. Default company roles are system roles and cannot be edited through the existing role-permission endpoint.

**Consequences:** The GSS Admin company-user form receives company-owned roles for legacy and newly created companies without starting the Phase 10 role editor, without merging GSS/Company RBAC, and without allowing arbitrary permission creation. Historical `area_manager` rows or templates are not deleted, but new default provisioning uses `site_manager`.

**Files affected:** `apps/api/src/modules/company-management/default-company-roles.ts`, `apps/api/src/modules/organizations/organizations.service.ts`, `apps/api/src/modules/company-management/company-management.service.ts`, `apps/api/prisma/seed.ts`, `apps/web/src/features/organizations/AdminCompanyDetailPage.tsx`.

## DEC-2026-031

**Status:** accepted

**Context:** Manual Phase 9 browser/hardware testing found that building-level alarm threshold save and fault filters worked, but the new UI lacked the legacy ability to temporarily enable or disable one selected gateway for one selected node type. Legacy `sendAlarmLevelToGateways` kept thresholds at building/node-type scope and persisted per-gateway `alarmEnabled` state in `GatewayAlarmSetting`.

**Decision:** Keep canonical thresholds scoped to building + node type. Add per-gateway + node-type hardware alarm activation to `GatewayAlarmLevelApplication` as `desiredEnabled` and `appliedEnabled`, linked to the existing cmd 4 `GatewayCommand` outbox. Building-level saves fan out cmd 4 with `enabled=true` and `alarmEnabled=true` to every active building gateway. Selected-gateway toggles create exactly one cmd 4: angle/gangform disable uses `enabled=false` and `alarmEnabled=false`, while door disable preserves legacy firmware shape `enabled=true` and `alarmEnabled=false`.

**Consequences:** No per-gateway threshold overrides are introduced. Desired enabled state is visible before ACK; applied enabled state changes only after exact successful ACK. Failed, expired, cancelled, negative and late responses do not change applied state. Future occurrence counting must use ACK-applied gateway/node-type enabled state, not merely desired state. Phase 10 role/company management remains out of scope.

**Files affected:** `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260718143000_phase_9_gateway_alarm_enabled_state/migration.sql`, `apps/api/src/modules/alarm-levels/`, `apps/api/src/modules/gateway-commands/gateway-commands.service.ts`, `apps/web/src/features/monitoring/CompanyMonitoringPage.tsx`, `packages/contracts/src/index.ts`, `docs/architecture/PHASE_9_ALARM_LEVELS_FAULT_FILTERS_CLASSIFICATION.md`.

## DEC-2026-032

**Status:** accepted

**Context:** Phase 10 needed to make existing Company RBAC, scope and CompanyPosition management usable without direct database edits. The schema already contained CompanyRole, CompanyUserPermission, CompanyUserAreaAccess, CompanyUserBuildingAccess, CompanyPosition, CompanyUserPositionAssignment and BuildingPlanImage metadata. Production object storage is still an open decision.

**Decision:** Complete Phase 10 through service/API/UI/test work without a Prisma schema change. Custom company roles can be edited and deleted only when they are not system/default roles, not company owner roles and not assigned to users. Default company roles remain protected. Role and position keys are normalized to lowercase underscore keys and validated centrally. Building-plan UI remains limited to provider-neutral `storageKey` metadata until the production storage provider and browser transfer mechanism are approved.

**Consequences:** Company Platform Managers can manage roles, users, direct permissions, scopes and CompanyPosition assignments through supported APIs and UI. Company users still cannot create arbitrary global permission rows or assign GSS-only permissions. No file-system or cloud-provider storage shortcut is introduced during Phase 10. Manual browser acceptance remains required before Phase 10 is complete.

**Files affected:** `apps/api/src/modules/company-management/`, `apps/web/src/features/company-management/`, `apps/web/src/features/organizations/CompanyResourceDetailPages.tsx`, `packages/contracts/src/index.ts`, `docs/architecture/PHASE_10_COMPANY_PORTAL_SCOPE_AND_MANAGEMENT.md`.

## DEC-2026-033

**Status:** accepted

**Context:** Manual Phase 10 browser testing found that scoped non-platform-manager users could see permitted sidebar entries and scoped list rows, but area/building detail pages and Company users/roles pages failed. The root cause was twofold: normal company-management read endpoints still derived company context through the platform-manager-only `assertCompanyManager` helper, and frontend detail/users/roles pages grouped required base data with optional users/devices/permission-catalog requests in all-or-nothing `Promise.all` calls.

**Decision:** Company-management read routes use the authenticated company-user company id plus existing effective-permission guards, while protected mutations and last-platform-manager/self-lockout checks keep the platform-manager owner policy. Area/building detail base queries load independently; assigned users, devices, roles and permission catalogs are requested only when the current session has the relevant permission, and optional 403 failures cannot replace an authorized base page with a full-page error.

**Consequences:** Custom and site-manager users with explicit permissions and assigned scope can open area/building detail pages and users/roles read pages without being platform managers. Missing permissions, missing scope, sibling resources and cross-company resources remain forbidden. Phase 10 still requires manual browser acceptance before completion; Phase 9 MQTT/GatewayCommand/alarm behavior is unchanged.

**Files affected:** `apps/api/src/modules/company-management/company-management-company.controller.ts`, `apps/api/src/modules/company-management/company-management.service.ts`, `apps/web/src/features/organizations/CompanyResourceDetailPages.tsx`, `apps/web/src/features/company-management/CompanyUsersPage.tsx`, `apps/web/src/features/company-management/CompanyRolesPage.tsx`, `apps/api/test/e2e/rbac.e2e-spec.ts`, `apps/web/src/test/company-management.spec.tsx`, `docs/architecture/PHASE_10_COMPANY_PORTAL_SCOPE_AND_MANAGEMENT.md`, `docs/planning/PROJECT_STATE.md`, `docs/planning/TODO.md`.

## DEC-2026-034

**Status:** accepted

**Context:** Phase 11 implements the durable occurrence-count engine after Phase 9 classification and Phase 10 CompanyPosition/scope management. The older alarm blueprint included notification creation in the same flow, but the approved Phase 11 boundary stops before Phase 12 delivery.

**Decision:** Phase 11 creates `AlarmRule`, `AlarmRecipientPolicy`, `AlarmCounterState`, `AlarmEvent` and immutable `AlarmPolicyTrigger` records only. It emits an internal post-commit `alarm.policy-triggered` event as a wake-up signal. Recipient resolution to final users, `AlarmNotification`, `AlarmDeliveryLog`, notification badges, external providers and acknowledge/resolve operations UI are Phase 12.

**Consequences:** `AlarmPolicyTrigger` is the bridge from occurrence counting to later delivery. Phase 11 does not overload `AlarmNotification` with a pre-delivery trigger meaning.

**Files affected:** `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260719120000_phase_11_alarm_occurrence_engine/migration.sql`, `apps/api/src/modules/alarms/`, `apps/api/src/modules/monitoring/monitoring.service.ts`, `docs/architecture/PHASE_11_ALARM_OCCURRENCE_COUNT_ENGINE.md`.

## DEC-2026-035

**Status:** accepted

**Context:** Gateway payload timestamps and measured timestamps can arrive out of order, while occurrence counts must survive restarts and avoid duplicate cycle triggers.

**Decision:** `SensorReading.receivedAt` is the authoritative clock for count eligibility and `nextCountAt`. Phase 11 evaluates reading/latest/counter/event/trigger work in a PostgreSQL serializable Prisma transaction with a bounded three-attempt retry. The idempotency keys are `SensorReading.deduplicationKey`, unique `(policyId, nodeId)` counter state and unique `(policyId, nodeId, triggerCycleNo)` policy trigger.

**Consequences:** Out-of-order `measuredAt` does not move counters backward or create duplicate triggers. Redis and timers are not occurrence-count sources of truth.

**Files affected:** `apps/api/src/modules/monitoring/monitoring.service.ts`, `apps/api/src/modules/alarms/alarm-occurrence-evaluator.service.ts`, `docs/architecture/PHASE_11_ALARM_OCCURRENCE_COUNT_ENGINE.md`.

## DEC-2026-036

**Status:** accepted

**Context:** Phase 9 stores desired/applied alarm enable state and ACK-applied fault-filter evidence. Phase 11 must preserve the hardware command boundary while honoring operator intent.

**Decision:** Phase 11 uses `GatewayAlarmLevelApplication.desiredEnabled` as backend occurrence-evaluation intent. `appliedEnabled` remains hardware acknowledgement state and is not modified by the evaluator. Fault-filtered readings remain stored and update latest state, but reset pending counters and resolve open events with reason `FAULT_FILTERED`.

**Consequences:** Disabling desired alarm state or applying a fault filter cannot leave stale pre-filter/pre-disable counts that later trigger. Phase 11 does not publish MQTT commands.

**Files affected:** `apps/api/src/modules/alarms/alarm-occurrence-evaluator.service.ts`, `docs/architecture/PHASE_11_ALARM_OCCURRENCE_COUNT_ENGINE.md`.

## DEC-2026-037

**Status:** accepted

**Context:** Phase 11 needs deterministic rule, episode and assignment semantics without expanding to ambiguous overlapping scopes.

**Decision:** The release-supported rule scope is building + node type + severity. The active event episode key is `nodeId + ruleId + severity + activeKey`. Evaluation evidence stores active gateway-company, gateway-building, node-company and node-gateway assignment row IDs. Policy count/interval/target/channel changes increment `evaluationVersion` and reset current state; rule display-name-only changes do not reset counters.

**Consequences:** Old-scope counts are not moved across reassignment, and a continuous unsafe episode reuses one open `AlarmEvent` while each policy cycle creates its own immutable trigger.

**Files affected:** `apps/api/prisma/schema.prisma`, `apps/api/src/modules/alarms/`, `apps/api/src/modules/monitoring/monitoring.service.ts`, `docs/architecture/PHASE_11_ALARM_OCCURRENCE_COUNT_ENGINE.md`.

## DEC-2026-038

**Status:** accepted

**Context:** Phase 12 needs notification delivery to survive process restarts. The Phase 11 in-memory `alarm.policy-triggered` event is only a wake-up signal and cannot be the source of truth.

**Decision:** Add dispatch state directly to `AlarmPolicyTrigger`: `dispatchStatus`, `dispatchAttemptCount`, `dispatchClaimedAt`, `dispatchCompletedAt` and `dispatchFailureReason`. Startup reconciliation scans pending trigger rows. `AlarmNotification` is idempotent by unique `(policyTriggerId, recipientUserId, channel)`.

**Consequences:** Delivery can resume after restart without Redis/BullMQ for this release. A future queue can claim the same durable trigger/notification rows without changing occurrence counting.

**Files affected:** `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260720120000_phase_12_notifications_alarm_operations/migration.sql`, `apps/api/prisma/migrations/20260720120100_phase_12_notification_tables/migration.sql`, `apps/api/src/modules/alarms/`, `docs/architecture/PHASE_12_NOTIFICATIONS_AND_ALARM_OPERATIONS.md`.

## DEC-2026-039

**Status:** accepted

**Context:** Provider vendors, credentials and SLA rules remain open decisions, but Phase 12 must implement in-app notifications and auditable delivery behavior now.

**Decision:** Configure in-app as the only production-enabled provider. SMS, Telegram, email and web-push policies are allowed in the model but dispatch as `SKIPPED` with `PROVIDER_UNCONFIGURED` unless a deterministic test-provider metadata flag is used for automated retry/failure coverage. No real provider calls or secrets are introduced.

**Consequences:** The UI can show provider availability and delivery logs are auditable without inventing vendor policy. Real external providers remain future approved work.

**Files affected:** `apps/api/src/modules/alarms/alarm-notification-dispatch.service.ts`, `docs/architecture/PHASE_12_NOTIFICATIONS_AND_ALARM_OPERATIONS.md`, `docs/quality/PHASE_12_MANUAL_ACCEPTANCE_CHECKLIST.md`.

## DEC-2026-040

**Status:** accepted

**Context:** Open decisions asked whether acknowledged alarms keep counting and whether manual resolve can close an unsafe alarm. The Phase 12 prompt requested conservative behavior.

**Decision:** `ACKNOWLEDGED` remains an active unsafe episode and keeps `activeKey = active`; later policy cycles reuse the event and can produce new notifications. Manual resolve rejects with 409 while latest state is unsafe, fault filtering is not active, desired alarm state is enabled and active assignment rows still exist. Safe/fault-filtered/desired-disabled transitions auto-resolve both `OPEN` and `ACKNOWLEDGED` active events.

**Consequences:** Acknowledgement means the user has seen the alarm; it does not suppress occurrence counting. Manual resolve cannot hide a still-unsafe active node by default.

**Files affected:** `apps/api/prisma/schema.prisma`, `apps/api/src/modules/alarms/alarm-occurrence-evaluator.service.ts`, `apps/api/src/modules/alarms/alarms.service.ts`, `docs/architecture/PHASE_11_ALARM_OCCURRENCE_COUNT_ENGINE.md`, `docs/architecture/PHASE_12_NOTIFICATIONS_AND_ALARM_OPERATIONS.md`.

## DEC-2026-041

**Status:** accepted

**Context:** Phase 12 manual pre-check on `/company/alarm-rules` found the create-rule modal crashed when typing the Name field. The fix also needed to avoid accidentally changing alarm rule identity or occurrence-count semantics.

**Decision:** `AlarmRule.name` is a human-readable display label only. Canonical rule identity remains the database id, and release-supported evaluation scope remains building + node type + severity. The shared Admin/Company create-rule modal owns an isolated local rule draft, reads input values synchronously before React state updaters, trims and validates the display label, contains validation/API failures inside the modal and resets cleanly on close/reopen. Required rule selectors do not allow deselection into `null`.

**Consequences:** Typing a display name does not submit, navigate, mutate cache, reset selectors, reset counters or change Phase 11 occurrence semantics. A failed create request leaves the page and modal usable, and the same behavior is covered for Company and Admin alarm-rule pages.

**Files affected:** `apps/web/src/features/alarms/AlarmOperationsPages.tsx`, `apps/web/src/test/alarm-rules.spec.tsx`, `apps/api/src/modules/alarms/dto/alarms.dto.ts`, `apps/api/src/modules/alarms/alarms.service.ts`, `docs/architecture/PHASE_12_NOTIFICATIONS_AND_ALARM_OPERATIONS.md`, `docs/quality/PHASE_12_MANUAL_ACCEPTANCE_CHECKLIST.md`.

## DEC-2026-042

**Status:** accepted

**Context:** Phase 12 recorded that the Company Alarm UI did not surface the backend 409 response when manual Resolve was rejected while the node remained unsafe. The shared alarm detail is used by both Company and GSS Admin routes, and action mutations had no loading/error guard.

**Decision:** The shared alarm detail keeps the current alarm state until an action PATCH succeeds, disables both alarm actions while a mutation is pending, resets the mutation state in `finally`, and renders a localized inline error on failure. The API client preserves a safe backend `message` from 4xx JSON responses; other failures use a localized fallback. The same behavior applies to Company and GSS Admin alarm detail interfaces.

**Consequences:** Unsafe Resolve remains rejected by the backend and is now visible to the operator without optimistic `RESOLVED` state. Successful SAFE Resolve continues to apply the returned `RESOLVED` event. No backend, MQTT, occurrence-count, recipient, shared-event or Phase 9 alarm-level behavior changes.

**Files affected:** `apps/web/src/shared/api/api-client.ts`, `apps/web/src/features/alarms/AlarmOperationsPages.tsx`, `apps/web/src/app/i18n.ts`, `apps/web/src/test/alarm-operations.spec.tsx`.

## DEC-2026-043

**Status:** accepted

**Context:** Phase 13 requires the durable report/export foundation, while the authoritative blueprint describes report categories and job fields at a higher level than the execution prompt. The repository does not yet have a report worker or a production storage provider.

**Decision:** Implement the Phase 13 execution-prompt report types (`company_summary`, `site_summary`, `building_summary`, `device_inventory`, `device_assignment_history`, `gateway_status_history`, `node_status_history`, `sensor_history`, `alarm_history`, `mqtt_command_history`, `user_activity`, `audit_log`), with `site_summary` mapped to the existing `ConstructionArea` hierarchy. `ReportJob` uses only the approved `PENDING`, `PROCESSING`, `COMPLETED` and `FAILED` statuses; expiration applies to `ReportExport`, not to the job lifecycle. The foundation supports CSV/XLSX metadata and a provider-neutral opaque storage-key boundary. Report generation remains an internal worker-facing completion service; no generator or worker endpoint is introduced in this task. Company requests snapshot the authenticated accessible building scope, and current scope must still authorize export download.

**Consequences:** Report view and export permissions remain separate, client-supplied company/area/building identifiers are validated against authenticated context, expired or out-of-scope downloads return the same non-disclosing not-found response, and a successful download updates export metadata and writes the existing `AuditLog` record in one transaction. Production S3-compatible storage and report generators remain open Phase 13 work; the local in-memory adapter is test/development-only.

**Files affected:** `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260721150000_phase_13_report_foundation/migration.sql`, `apps/api/src/modules/reports/`, `apps/api/test/e2e/reports.e2e-spec.ts`, `docs/planning/PROJECT_STATE.md`, `docs/planning/TODO.md`.

## DEC-2026-044

**Status:** accepted

**Context:** The Phase 13 execution prompt requires bounded report generation and actual ReportJob processing, but the repository does not contain a configured Nest scheduler, Redis/BullMQ worker, or production object-storage provider. The approved plan does not define automatic retry counts or a larger report row/date limit.

**Decision:** Implement an internal pull-processor service with a conditional `PENDING -> PROCESSING` claim, idempotent terminal handling and no implicit retry of `FAILED` or stuck `PROCESSING` jobs. A later approved scheduler/worker can call `processPending()` without changing the job contract. Use a maximum of 10,000 rows per export, a 366-day general date range and a 31-day sensor-history range; requests exceeding these bounds fail safely. Use the existing provider-neutral in-memory storage adapter only for development/tests; production storage remains deferred.

**Consequences:** Concurrent processors cannot claim the same pending job, completed jobs do not create duplicate exports, generation failures store only a redacted bounded summary and completion/failure are system-audited. Large datasets are bounded at the database query and normalized-dataset boundary, while production queue scheduling, retry policy and cloud storage remain explicit Phase 13 follow-up work rather than invented infrastructure.

**Files affected:** `apps/api/src/modules/reports/`, `apps/api/src/modules/reports/dto/reports.dto.ts`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260721153000_phase_13_report_audit_date_index/migration.sql`, `apps/api/test/reports.spec.ts`, `apps/api/test/e2e/reports.e2e-spec.ts`, `docs/planning/PROJECT_STATE.md`, `docs/planning/TODO.md`, `docs/planning/IMPLEMENTATION_PLAN.md`.

## DEC-2026-045 — Phase 13 internal report worker, provider selection and expiration cleanup

**Context:** The Phase 13 report vertical slice needs automatic processing and storage cleanup, but the repository has no approved report queue/scheduler integration. The Phase 13 architecture approves local development storage and production S3-compatible storage, while recovery semantics for crashed `PROCESSING` jobs remain undefined.

**Decision:** Use a Nest lifecycle polling worker that calls the existing `ReportJobProcessorService` and `ReportExportCleanupService`; do not introduce Redis/BullMQ. Make worker execution disableable and validate `REPORT_WORKER_ENABLED`, `REPORT_WORKER_INTERVAL_MS` (30-second development default), `REPORT_WORKER_BATCH_SIZE` (10), `REPORT_CLEANUP_ENABLED`, `REPORT_CLEANUP_INTERVAL_MS` (5-minute default) and `REPORT_CLEANUP_BATCH_SIZE` (100). Use memory storage in tests, local filesystem storage in development and a private S3-compatible provider in production. Downloads remain authorized backend streams; no public or permanent object URLs are emitted. Add `ReportExport.storageDeletedAt`, delete expired objects in bounded idempotent batches, preserve database history and audit only successful conditional cleanup.

**Unresolved:** A crashed `PROCESSING` job is not automatically reclaimed or retried. No safe retry count, lease, or recovery transition was approved, and reclaiming it could create duplicate exports. This remains an explicit follow-up decision.

**Consequences:** Concurrent worker ticks and claims cannot double-process a job; one failed job or cleanup deletion does not block the batch; production storage credentials are validated but never committed or returned; expired objects can be retried without deleting active exports; ReportJob and ReportExport history remains durable. The worker, storage adapters and cleanup remain Phase 13 backend work. Frontend report pages and the approved dashboard recent-job/status card use the existing portal-specific list endpoints; manual acceptance remains open.

**Files affected:** `packages/config/src/env.ts`, `apps/api/.env.example`, `apps/api/src/modules/reports/`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260721160000_phase_13_report_storage_cleanup/migration.sql`, `apps/api/test/report-storage.spec.ts`, `apps/api/test/report-worker.spec.ts`, `apps/api/test/e2e/reports.e2e-spec.ts`, `docs/architecture/PHASE_13_REPORTS_AND_EXPORTS.md`, `docs/planning/PROJECT_STATE.md`, `docs/planning/TODO.md`, `docs/planning/IMPLEMENTATION_PLAN.md`.

## DEC-2026-046 — Phase 13 report acceptance and Phase 14 operational boundary

**Status:** accepted

**Context:** Phase 13 browser acceptance verified the Admin and Company report
pages, local report generation/download workflow, polling, lifecycle updates
and dashboard recent-report summaries. The approved execution order names
retention, hardening and deployment as Phase 14 work.

**Decision:** Close Phase 13 as `PHASE_13_COMPLETE` using the verified private
local report storage path plus implemented export expiry/cleanup and the
existing automated permission, scope, lifecycle, download and security tests.
Production S3 execution, standalone worker deployment, deployment manifests
and rollback runbooks, and long-term sensor retention/partitioning/archival/
purge remain deferred Phase 14 scope. No Phase 14 implementation or production
execution is claimed by this acceptance.

**Consequences:** The report API contract, worker behavior, private download
boundary, row/date limits and cleanup semantics remain unchanged. Future Phase
14 deployment work must provide the production configuration and operational
acceptance separately.

**Files affected:** `docs/quality/PHASE_13_MANUAL_ACCEPTANCE_CHECKLIST.md`,
`docs/planning/PROJECT_STATE.md`, `docs/planning/TODO.md`,
`docs/architecture/PHASE_13_REPORTS_AND_EXPORTS.md`.

## DEC-2026-047 — Pre-Phase-14 refactor execution boundary

**Status:** accepted

**Context:** The 3rd-step prompt defines a pre-Phase-14 UX/product completion wave after the verified Phase 13 report work. The current repository still has the source-map Welcome, dashboard, header, portal-module, device-action, bulk-node, provisioning-mode, and monitoring-card gaps, while RBAC, MQTT requestId/ACK, alarms/notifications, and reports are already complete and must not regress.

**Decision:** Execute the numbered 3rd-step tasks exactly in the master-prompt order, one task at a time, with focused verification and `EXECUTION_STATE.md` updates after every task. Treat the legacy archives as read-only behavior/asset references. Preserve `PHASE_13_COMPLETE` and `PHASE_14_NOT_STARTED`; do not implement production storage/deployment, migration, retention, partitioning, archival/purge, rollback, or CI/CD hardening. Add only forward additive migrations when a task proves durable state is needed; Task 09 is the current likely candidate for durable APPEND/REPLACE provisioning mode/final-node-set data, subject to schema inspection at that task.

**Consequences:** The refactor remains resumable and auditable. Existing permission/scope guards, assignment history, GatewayCommand outbox/requestId correlation, alarm occurrence/notification behavior, reports, and audit effects are protected regression surfaces. The complete plan and observable ten-requirement checklist are recorded in `docs/refactor/PRE_PHASE_14_REFACTOR_PLAN.md` and `docs/quality/PRE_PHASE_14_REFACTOR_ACCEPTANCE_CHECKLIST.md`.

**Files affected:** `docs/prompts/3rd-step/EXECUTION_STATE.md`, `docs/refactor/PRE_PHASE_14_REFACTOR_PLAN.md`, `docs/quality/PRE_PHASE_14_REFACTOR_ACCEPTANCE_CHECKLIST.md`, `docs/planning/PROJECT_STATE.md`, `docs/planning/TODO.md`, `docs/planning/IMPLEMENTATION_PLAN.md`.

## DEC-2026-048 — Deterministic web unit-file execution for the refactor wave

**Status:** accepted

**Context:** The existing web unit suites use shared browser globals such as `window`, session storage, and mocked `fetch`. With Vitest file parallelism enabled, unrelated auth/management/alarm tests intermittently observed another file's state and failed; the same suites passed individually and with one worker.

**Decision:** Keep the established `threads` pool, but set `fileParallelism: false` in `apps/web/vitest.config.ts` so web unit files execute deterministically in one worker. This changes only test execution order/concurrency and does not alter application behavior or production runtime configuration.

**Consequences:** The required `pnpm --filter web test:unit` command is stable and continues to exercise all web suites. The suite is slower than parallel execution, but avoids false failures while the tests rely on shared jsdom globals.

**Files affected:** `apps/web/vitest.config.ts`, `docs/planning/DECISION_LOG.md`.

## DEC-2026-049 — Safe session metadata and notification realtime states

**Status:** accepted

**Context:** Task 04 requires personalized Welcome/profile/header surfaces while preserving the existing authentication boundary and notification unread/socket behavior. The previous session response intentionally exposed only a minimal identity and permission list, and the shell displayed an unconditional reconnecting badge.

**Decision:** Extend the authenticated session response with only active state, phone, last-login timestamp, role id/key/name/super-admin flag and (for Company users) company id/name. Password hashes, token versions, secrets and internal authorization details remain excluded. Render Welcome/profile from session metadata, keep profile view-only, and create the notification socket only when `notifications.view` is effective. Track connecting, connected, reconnecting and offline from actual Socket.IO events; hide the badge when idle or connected. Monitoring realtime remains a distinct socket.

**Consequences:** Account and Welcome surfaces cannot mutate credentials or bypass backend authorization. Existing unread endpoint/room, RBAC permission filtering and monitoring socket behavior remain intact. No schema or migration change is needed because all metadata already exists on the authenticated user relations.

**Files affected:** `packages/contracts/src/index.ts`, `apps/api/src/modules/auth/auth.service.ts`, `apps/api/test/e2e/rbac.e2e-spec.ts`, `apps/web/src/features/shell/WelcomeProfilePages.tsx`, `apps/web/src/features/shell/PortalLayout.tsx`, `apps/web/src/app/router.tsx`, `apps/web/src/app/i18n.ts`, `apps/web/src/test/welcome-profile.spec.tsx`, `packages/ui/src/realtime-status-badge.tsx`.

## DEC-2026-050 — Bounded permission-aware dashboard summaries

**Status:** accepted

**Context:** Task 05 needs useful GSS operational dashboards without turning the dashboard into a scope or permission side channel. Existing report-job cards are approved behavior but are not sufficient as the only dashboard content.

**Decision:** Add `/admin/dashboard/summary` and `/company/dashboard/summary` with validated `7d|30d|90d` ranges. The backend derives Company scope from the authenticated principal, runs bounded Prisma counts/group-bys, omits sections without effective permission, and uses the latest-state table for severity distribution. Telemetry chart points are capped at 10,000 selected timestamps; no raw history is loaded without a bound. Admin command metrics require `mqtt-commands.view`; Company users never receive global company totals.

**Consequences:** Dashboard metrics are operationally useful while preserving backend authorization and scope enforcement. The frontend may render omitted sections as unavailable/empty and keeps recent reports as a lower-priority existing section. No schema or migration change is required.

**Files affected:** `packages/contracts/src/index.ts`, `apps/api/src/modules/dashboard/`, `apps/api/src/modules/reports/reports.module.ts`, `apps/api/src/app.module.ts`, `apps/api/test/e2e/rbac.e2e-spec.ts`, `apps/web/src/features/dashboard/DashboardPages.tsx`, `apps/web/src/app/i18n.ts`, `apps/web/src/test/dashboard.spec.tsx`, `docs/architecture/DASHBOARD_ANALYTICS.md`.

## DEC-2026-051 — Protected GSS roles and conservative portal settings

**Status:** accepted

**Context:** Task 06 requires meaningful roles and settings pages without introducing unsafe runtime controls or allowing Company scope data to be selected by the browser. Existing GSS/company role models and permission scopes already provide the required persistence and authorization boundaries.

**Decision:** Add non-system GSS role CRUD with transactional permission replacement, reject Company-only permissions, reject deletion of assigned roles, and keep system/super-admin roles immutable. Expose system configuration through a redacted read-only DTO; production/deployment controls remain Phase 14. Company settings derive the company from the authenticated CompanyUser relation and allow only address, phone and email edits; company identity, code, name and status remain read-only.

**Consequences:** Task 06 requires no schema migration or seed change. Backend guards remain the security boundary, all role and Company settings mutations are audited, and the frontend hides manage actions while retaining backend enforcement.

**Files affected:** `apps/api/src/modules/settings/`, `apps/web/src/features/settings/SettingsPages.tsx`, `packages/contracts/src/index.ts`, `apps/api/test/e2e/rbac.e2e-spec.ts`, `apps/web/src/test/settings.spec.tsx`, `docs/architecture/ADMIN_ROLES_AND_SETTINGS.md`, `docs/planning/PROJECT_STATE.md`, `docs/planning/TODO.md`, `docs/planning/IMPLEMENTATION_PLAN.md`.

## DEC-2026-052 — Pristine-only device deletion with server-derived blockers

**Status:** accepted

**Context:** Task 07 requires clear device edit/delete actions while preserving
assignment history, MQTT command outbox records, provisioning evidence,
monitoring history, alarms and fault-filter state. Current unassignment is a
history-preserving operation, so an unassigned device is not necessarily safe to
delete.

**Decision:** Keep `gateways.update`, `gateways.delete`, `nodes.update` and
`nodes.delete` as separate backend permissions. Return a server-derived
deletion capability in Admin inventory records, but repeat all blocker checks
inside the transactional delete operation. Any historical relation blocks hard
delete with structured `409 DEVICE_HISTORY_EXISTS` guidance toward
`INACTIVE_OR_RETIRED`. Only pristine devices are deleted; no cascade is used,
and successful deletes are audited. The frontend uses compact accessible
Mantine action icons, permission wrappers, capability-derived disabled states,
destructive confirmations and localized success/conflict feedback.

**Consequences:** Existing assignment, MQTT requestId/ACK, alarm and report
behavior remains unchanged. No schema migration or seed change is required.
Devices with history remain available for an approved lifecycle workflow rather
than being erased.

**Files affected:** `apps/api/src/modules/devices/`,
`apps/api/test/e2e/devices.e2e-spec.ts`,
`apps/web/src/features/devices/AdminDevicesPage.tsx`,
`apps/web/src/test/devices.spec.tsx`, `packages/contracts/src/index.ts`,
`docs/architecture/DEVICE_INVENTORY_LIFECYCLE.md`,
`docs/planning/PROJECT_STATE.md`, `docs/planning/TODO.md`,
`docs/planning/IMPLEMENTATION_PLAN.md`.

## DEC-2026-054 — Explicit APPEND/REPLACE provisioning membership

**Status:** accepted

**Context:** Task 09 needs repeatable gateway node membership changes without
turning a partial UI selection into an accidental clear operation. Existing
cmd 2 outbox, requestId correlation and assignment history must remain the
source of truth for physical application.

**Decision:** Require `APPEND` or `REPLACE` on every register-nodes request.
Persist the mode and selected/final membership, compute APPEND as the current
same-gateway/node-type union with selected unassigned nodes, and compute
REPLACE as the exact selected set. Apply changes only after a strict ACK. End
omitted active assignments during REPLACE in durable request-linked history,
serialize nonterminal requests with a PostgreSQL advisory transaction lock, and
reject empty selections and concurrent PENDING/SENT requests. Remove the old
one-to-one provisioning-item assignment index so retained assignments can be
linked from successive requests.

**Consequences:** Retries retain the same command/requestId payload and
duplicate or late ACKs remain idempotent. Existing RBAC, scope, MQTT, alarm
and report behavior is preserved. The task adds two additive migrations and no
seed change.

**Files affected:** `apps/api/prisma/schema.prisma`,
`apps/api/prisma/migrations/20260722120000_task_09_provisioning_modes/`,
`apps/api/prisma/migrations/20260722121000_task_09_reusable_provisioning_assignment_links/`,
`apps/api/src/modules/gateway-commands/`,
`apps/api/test/e2e/gateway-commands.e2e-spec.ts`,
`apps/web/src/features/devices/AdminDevicesPage.tsx`,
`apps/web/src/test/devices.spec.tsx`,
`docs/architecture/NODE_PROVISIONING_APPEND_REPLACE.md`.

## DEC-2026-055 — Reusable bounded Company monitoring presentation

**Status:** accepted

**Context:** Task 10 needs V2-inspired node cards and historical graphics while
preserving the V3 monitoring endpoint, realtime room, alarm-level controls and
fault-filter separation.

**Decision:** Add typed Mantine/GSS monitoring presentation components for a
persisted TABLE/CARD latest-state preference, accessible door cards, angle and
gangform T-shaped indicators, and a selected-node detail drawer. Keep one
realtime state stream, fetch only the selected node's existing bounded history,
and render a local SVG chart rather than adding a chart dependency. Do not put
a fault-filter control in the detail drawer; retain it only in the dedicated
fault-filter tab.

**Consequences:** Company monitoring gains card/table parity and bounded detail
history without schema/API changes or per-card requests. Admin monitoring will
reuse the presentation components in Task 11. Production telemetry retention
remains deferred.

**Files affected:** `apps/web/src/features/monitoring/CompanyMonitoringPage.tsx`,
`apps/web/src/features/monitoring/components/`,
`apps/web/src/test/monitoring.spec.tsx`,
`docs/architecture/MONITORING_PRESENTATION.md`.

## DEC-2026-056 — Global Admin monitoring read models and shared workspace

**Status:** accepted

**Context:** Task 11 needs a useful `/admin/monitoring` landing page while
keeping Company scope enforcement separate and avoiding unbounded sensor
queries or duplicated monitoring cards/detail behavior.

**Decision:** Add permission-guarded Admin options and summary endpoints using
bounded Prisma aggregates over latest node state, active gateway freshness,
building grouping and eight recent nodes. Use the existing Admin
building/node-type/history endpoints for drilldown. Build the Admin page with
company/site/building cascades, operational/severity summaries, legacy
node-type images, the shared Task 10 presentation components and a selected
building/node-type realtime room.

**Consequences:** GSS Admin can monitor globally without Company scope
confusion; only the selected room and selected node history are fetched. Five
minutes remains the established stale freshness convention. No schema,
migration or seed change is required.

**Files affected:** `apps/api/src/modules/monitoring/`,
`apps/api/test/e2e/monitoring.e2e-spec.ts`,
`packages/contracts/src/index.ts`,
`apps/web/src/features/monitoring/AdminMonitoringPage.tsx`,
`apps/web/src/app/router.tsx`, `apps/web/src/test/monitoring.spec.tsx`,
`docs/architecture/ADMIN_MONITORING.md`.

## DEC-2026-053 — Atomic canonical bulk node creation

**Status:** accepted

**Context:** Task 08 needs the V2 single/range/list node-number behavior while
preserving V3 validation, audit, permission and transaction boundaries. Node
numbers are strings in the database and MQTT adapters already normalize numeric
wire values separately.

**Decision:** Add a shared parser and typed `POST /admin/devices/nodes/bulk`
contract. Accept positive safe decimal values, inclusive ranges and mixed comma
segments; trim whitespace, canonicalize decimal strings, deduplicate input and
cap each batch at 1,000 unique numbers. Compare requested values against all
existing numeric inventory by canonical value. Reject malformed input with a
structured 400 and existing-number conflicts with a structured 409. Create the
whole batch in one transaction, audit one batch record, and keep gateway
assignment in the existing MQTT requestId/ACK provisioning flow. Use a Mantine
textarea with preview/count/error states and hide the create action without
`nodes.create`.

**Consequences:** Duplicate input cannot create duplicate hardware-numeric
identity, and failures cannot leave partial node rows. The existing single-node
endpoint and node edit flow remain compatible. No schema migration or seed
change is required.

**Files affected:** `packages/contracts/src/node-number-parser.ts`,
`packages/contracts/src/index.ts`, `packages/contracts/test/node-number-parser.spec.ts`,
`apps/api/src/modules/devices/`, `apps/api/test/e2e/devices.e2e-spec.ts`,
`apps/web/src/features/devices/AdminDevicesPage.tsx`,
`apps/web/src/test/devices.spec.tsx`,
`docs/architecture/BULK_NODE_CREATION.md`, `docs/planning/PROJECT_STATE.md`,
`docs/planning/TODO.md`, `docs/planning/IMPLEMENTATION_PLAN.md`.

## DEC-2026-057 — Final responsive shell and package-consumer consistency

**Status:** accepted

**Context:** Task 12 needs a single responsive hierarchy across active routes and deterministic browser smoke coverage. The web app also consumes the Task 08 parser from `@gss-iot/contracts`; the package is declared as an ES module but its build configuration emitted CommonJS, which breaks browser named imports from the built workspace package.

**Decision:** Keep Mantine as the shared component system and make the low-risk global improvements in shared primitives: wrapping `PageHeader` actions, accessible optional table names/captions, closing the mobile navigation drawer after selection and a visible GSS focus ring. Change only the contracts package build module target/resolution to ES modules/bundler mode so its published output matches `package.json`. Add deterministic login/protected-redirect/legacy-card/mobile overflow smoke checks and record authenticated all-route visual capture as deferred until a stable session fixture exists.

**Consequences:** Active navigation routes remain permission-filtered and behavior-preserving, tables remain scrollable, and the parser export works in the browser build. No permission, scope, MQTT, alarm, reports or API business rule changes are introduced. Theme switching and production visual-regression infrastructure remain deferred.

**Files affected:** `packages/ui/src/page-header.tsx`, `packages/ui/src/data-table.tsx`, `packages/ui/test/dashboard-primitives.spec.tsx`, `packages/contracts/tsconfig.json`, `apps/web/src/features/shell/PortalLayout.tsx`, `apps/web/src/main.tsx`, `apps/web/src/styles/global.css`, `apps/web/e2e/bootstrap.spec.ts`, `docs/design/DESIGN_SYSTEM.md`, `docs/design/UI_UX_SPEC.md`, `docs/design/PAGE_INVENTORY.md`.

## DEC-2026-058 — Pre-Phase-14 refactor handoff evidence boundary

**Status:** accepted

**Context:** Task 13 requires a complete regression and an honest manual acceptance record without turning unavailable browser sessions or unexecuted hardware checks into claims.

**Decision:** Mark the pre-Phase-14 refactor complete after all configured automated gates pass and record public desktop/mobile browser observations separately from protected API/E2E evidence. Keep authenticated all-route visual walkthrough as a user-review follow-up when a deterministic session fixture is available. Keep live ESP32 cmd 4/cmd 5 verification pending; existing Phase 8 cmd 2 evidence and protocol tests remain valid but are not hardware evidence for this handoff.

**Consequences:** The repository state is `PHASE_13_COMPLETE`, `PHASE_14_NOT_STARTED`, `PRE_PHASE_14_REFACTOR_COMPLETE`. No production S3, worker deployment, retention, migration, rollback, CI/CD, or live hardware implementation is introduced. Automated security/scope/protocol/alarm/report evidence remains the authoritative regression proof until the deferred manual checks are performed.

**Files affected:** `docs/quality/PRE_PHASE_14_REFACTOR_ACCEPTANCE_CHECKLIST.md`, `docs/planning/PROJECT_STATE.md`, `docs/planning/TODO.md`, `docs/planning/IMPLEMENTATION_PLAN.md`, `docs/planning/DECISION_LOG.md`, `docs/prompts/3rd-step/EXECUTION_STATE.md`.

## DEC-2026-059 — Wave 1 visual contract and action hierarchy

**Status:** accepted

**Context:** Wave 1 needs a coherent visual system and clearer action hierarchy
across the highest-value organization and company-management surfaces without
changing APIs, routes, DTOs, authorization, scope filtering, realtime behavior,
i18n boundaries or legacy monitoring behavior.

**Decision:** Adopt the Wave 1 visual contract in
`docs/design/UI_REDESIGN_V2.md`: compact navy shell, cyan primary emphasis,
entity-first list/card layouts, semantic status badges, one contextual overflow
menu per entity, confirmation modals for destructive actions, and shared modal
footers with Cancel first and the primary action on the right. Use row/entity
navigation for primary open behavior and permission-filter every secondary
action. Validate the contract with focused unit tests and exact-viewport
authenticated visual captures.

**Consequences:** Shared tokens, primitives, shell, gallery and the Companies,
Admin Company Detail, Company Resources and Company Users surfaces are updated
as one Wave 1 slice. No schema, migration, seed, API contract or business-rule
change is introduced. Devices, monitoring, alarms, reports, settings and other
Wave 2 surfaces remain unchanged and Wave 2 is not started.

**Files affected:** `packages/ui/src/`, `apps/web/src/styles/global.css`,
`apps/web/src/features/shell/PortalLayout.tsx`,
`apps/web/src/features/organizations/CompaniesPage.tsx`,
`apps/web/src/features/organizations/AdminCompanyDetailPage.tsx`,
`apps/web/src/features/organizations/CompanyResourcesPage.tsx`,
`apps/web/src/features/company-management/CompanyUsersPage.tsx`,
`apps/web/e2e/ui-redesign.visual.spec.ts`,
`docs/design/UI_REDESIGN_AUDIT.md`, `docs/design/UI_REDESIGN_V2.md`.

## DEC-2026-060 — Wave 2 operational surfaces and existing-mutation boundary

**Status:** accepted

**Context:** Wave 2 needs clearer Devices, Assignments, Gateway Commands,
Organization Details and Company Roles workflows while preserving the existing
backend and authorization contracts.

**Decision:** Apply the Wave 1 visual contract to the Wave 2 surfaces using
dense entity-first tables, semantic lifecycle/connectivity/status badges, one
contextual overflow menu per row, explicit blocker explanations and shared
confirmation/modal-footer primitives. Keep secondary organization navigation in
the building overflow menu and keep company scope filtering server-derived.
Reuse only existing device assignment, unassignment, delete, gateway-command
retry/cancel, role mutation and plan-image endpoints. Do not add Deactivate or
Retire mutations when the current API/page contract does not expose them; render
their existing lifecycle states and preserve current mutation availability.

**Consequences:** Wave 2 improves scanability and action placement without
changing API paths, DTOs, query keys, permission resolution, scope checks, MQTT
topics/payloads, assignment history, validation, realtime behavior, self-lockout
or inactive-session handling. No schema, migration, seed or backend change is
introduced. Wave 3 remains deferred.

**Files affected:** `packages/ui/src/status-badge.tsx`,
`packages/ui/src/entity-primitives.tsx`, `apps/web/src/app/i18n.ts`,
`apps/web/src/features/devices/`,
`apps/web/src/features/gateway-commands/GatewayCommandsPage.tsx`,
`apps/web/src/features/organizations/CompanyResourceDetailPages.tsx`,
`apps/web/src/features/company-management/CompanyRolesPage.tsx`,
`apps/web/e2e/ui-redesign.visual.spec.ts`, focused web tests and the Wave 2
planning handoff entries.

## DEC-2026-061 — Wave 3 operational surfaces and evidence boundary

**Status:** accepted

**Context:** Wave 3 requires a visual redesign of dashboards, monitoring,
alarms, reports and settings while preserving all existing backend contracts,
authorization boundaries, realtime behavior and legacy monitoring behavior.

**Decision:** Apply the existing Wave 1–2 contract to the Wave 3 routes using
semantic statuses, compact entity-first hierarchy, contextual overflow actions,
shared realtime badges, partial dashboard loading and a deliberate mobile
report-job fallback. Preserve all current request paths, mutation payloads,
filters, query behavior, occurrence-count/count-interval semantics and settings
protections. Do not invent metrics, business rules or new mutations.

**Consequences:** Wave 3 was presentation-only across the requested Admin and
Company surfaces. Its deferred screenshot and focused-test evidence was
closed by the final Wave 4 protected fixture and workspace unit run. The
aggregate web E2E dark-surface helper remains a separate documented harness
risk.

**Files affected:** `apps/web/src/features/dashboard/`,
`apps/web/src/features/monitoring/`, `apps/web/src/features/alarms/`,
`apps/web/src/features/reports/`, `apps/web/src/features/settings/`,
`packages/ui/src/status-badge.tsx`, `apps/web/src/app/i18n.ts` and the Wave 3
planning handoff entries.

## DEC-2026-0723 — Wave 4 final visual QA boundary

**Status:** accepted

**Context:** Wave 4 is the final redesign wave and must close visual,
responsive, accessibility and consistency gaps without broadening scope.

**Decision:** Keep the existing Mantine/GSS visual contract and correct only
verified presentation defects: semantic status rendering, mobile monitoring
node cards, duplicate realtime indicator visibility, mobile report/dashboard
badge sizing and remaining Admin device lifecycle text. Use the existing
test-only authenticated fixture for exact 1440x900, 1280x800, 1024x768 and
390x844 evidence. Do not change routes, permissions, API contracts, scope,
MQTT/realtime, alarms, reports or settings behavior, and do not start Wave 5.

**Consequences:** The final UI slice is review-ready and all focused gates pass.
The aggregate web E2E command remains a release-readiness risk because the
existing dark shared-surface multi-route evidence helper hangs; this is
documented rather than hidden.

**Files affected:** dashboard, monitoring, reports, settings and Admin company
detail presentation files; focused web tests; the protected visual fixture;
and `docs/ui-redesign/WAVE4_FINAL_VERIFICATION.md`.

## DEC-2026-0725 — Targeted post-Wave-4 metrics, tooltips and read-only permission catalogs

**Status:** accepted

**Context:** User feedback identified dense-dashboard layout, chart legibility,
monitoring entry/summary consistency and permission-catalog discoverability gaps
after Wave 4. DEC-2026-009 already establishes unprefixed permission keys, and
the existing Company catalog and Admin role-editor catalog have different
authorization contexts.

**Decision:** Keep the Wave 4 Mantine/GSS contract and make only the targeted
shared metric, building-card and SVG-tooltip corrections. Preserve bounded
telemetry and 25-reading node-history requests. Add a separate read-only
`GET /admin/permissions` endpoint guarded by `permissions.view`, while retaining
`GET /admin/roles/permissions` for `admin-roles.view`. Keep
`GET /company/permissions` guarded by `company-permissions.view`. Filter the
catalogs to GSS/BOTH and COMPANY/BOTH respectively, expose no permission
mutations, and use one shared read-only frontend page with independently guarded
routes/sidebar items. Seed every catalog row with an idempotently updated
description through the existing nullable field; add no migration.

**Consequences:** KPI and realtime summaries fit one desktop row at the approved
viewports; chart data is accessible by mouse and keyboard without a new
dependency or unbounded query; Company building entries no longer create nested
status badges. Admin and Company users can inspect only their authorized catalog
context, and sidebar filtering remains UX rather than the security boundary.
Wave 5, Phase 14, MQTT, alarm logic, production storage/deployment and retention
remain out of scope. The documented aggregate web E2E dark-helper timeout still
blocks an overall release-ready claim.

**Files affected:** `packages/ui/src/dashboard-primitives.tsx`,
`apps/web/src/styles/global.css`, dashboard/monitoring/permission presentation,
shell navigation/router/i18n, `apps/api/src/modules/settings/`,
`apps/api/prisma/seed.ts`, focused web/API/Playwright tests and the related
design/planning handoff documents.

## DEC-2026-0725-02 — Private provider-neutral Company logo assets

**Status:** accepted

**Context:** Post-Wave-4 feedback requires a platform header identity and company-owned sidebar
branding, plus controlled logo management from Company Settings and Admin Company Detail. The
existing `Company.logoKey` column has no storage contract, and returning it from organization
selects would leak provider metadata.

**Decision:** Treat company logos as private server-mediated assets behind a dedicated provider
boundary. Use memory in tests, local filesystem in development and private S3 in production through
`ASSET_*` configuration; production must fail startup without S3. Accept only magic-byte validated
PNG/JPEG/WebP up to 2 MiB and generate `company-logos/{companyId}/{uuid}.{extension}` keys. Public
company contracts expose only `hasLogo`. Company GET is available to every active Company user and
derives ownership from the principal; Company mutation uses `settings.company.manage`; Admin read
and mutation use `companies.view` and `companies.update`. Replacement writes first, commits DB and
audit atomically, cleans the new object on rollback and deletes the old object best-effort after
commit. Metadata PATCH and logo mutation stay independent.

**Consequences:** The sidebar can refresh immediately from shared authenticated blob state without
public URLs or storage-key leakage. Object URLs are revoked safely. No Prisma migration is needed.
The report storage subsystem and unresolved building-plan provider decision are unchanged.
Production-capable S3 code exists, but no credentials, bucket provisioning or deployment execution
is claimed. Phase 14 remains not started.

**Files affected:** `packages/config/src/env.ts`, `packages/contracts/src/index.ts`, the new
`apps/api/src/modules/company-branding/` module, organization/settings serializers, shared web API
and branding state, `PortalLayout`, Company Settings, Admin Company Detail, shared UI brand,
focused API/web/Playwright tests and `docs/architecture/COMPANY_LOGO_STORAGE.md`.

## DEC-2026-0727 — Explicit lifecycle, evidence-safe deletion, assignment ending and collection pagination

**Status:** accepted

**Context:** The authoritative blueprint maps several `DELETE` organization endpoints to delete
permissions, while the current implementation uses those routes only to set `INACTIVE`. The
correction request explicitly separates reversible lifecycle transitions from actual deletion,
requires operational alarm/notification evidence to remain durable, completes reciprocal device
unassignment, and standardizes user-facing list pagination. DEC-2026-024 also establishes that a
database node-gateway unassignment is not a physical MQTT unregister operation.

**Decision:** Add explicit `PATCH .../status` endpoints guarded by update/manage permissions and
reserve `DELETE .../permanent` plus existing true-delete endpoints for delete permissions. Keep the
old organization `DELETE` endpoints temporarily as documented deactivate compatibility adapters.
Hard-delete Company, Area, Building, CompanyUser, Position and custom Role records only when a
server-derived capability is `HARD_DELETE` and all blockers are repeated inside the transaction.
Return structured `409` blocker codes with a safe recommended alternative. Archive AlarmEvent and
AlarmNotification through additive `deletedAt`, `deletedByType` and `deletedById` fields; normal
lists and unread counts exclude archived rows while audit/report evidence and relations remain.
AlarmRule and AlarmRecipientPolicy deactivation/reactivation reset their mutable counter state and
must satisfy active uniqueness before activation. User deactivation increments `tokenVersion`;
reactivation never restores an earlier token version. Preserve last-super-admin and
last-platform-manager protection.

Gateway/node assignment ending always updates history rows and writes audit records in one
transaction. Node-company unassignment first ends an active node-gateway relationship. Gateway-
company unassignment is blocked while active building or node relationships exist, with exact
counts returned to the UI; it does not invent a hardware unregister command. Physical gateway
membership continues to use the approved `REPLACE` provisioning flow.

All user-facing collection endpoints use the shared `{ items, page, pageSize, total }` response,
default page `1`, default page size `50`, and only `50|100`. Filtering precedes pagination and every
ordering includes an id tie-breaker. Small fixed catalogs and selector data use explicit bounded
option/search endpoints instead of silently reading the first collection page. Pagination controls
live in the list header/toolbar and are shared/localized.

**Consequences:** This is a forward correction wave, not Phase 14. It requires additive Prisma
migrations for archive fields and supporting indexes, atomic contract/consumer updates, expanded
RBAC/scope/IDOR tests and migration rollback notes. The two supplied logo SVG files remain exact
public assets with case-sensitive paths. No operational history is physically cascade-deleted.
The visual E2E fixture mirrors paginated response envelopes and opens command detail through the
protected overflow action rather than the retired inline action button.

**Files affected:** `apps/api/prisma/schema.prisma`, a new forward migration, organization,
company-management, devices, alarms, settings, monitoring, gateway-command and reports APIs,
`packages/contracts`, `packages/ui`, Admin/Company collection and detail pages, focused tests, and
the lifecycle/deletion/pagination architecture and required design/planning/security documents.

## DEC-2026-0727-02 — Private building images and bounded Node history ranges

**Status:** accepted

**Context:** The existing Building Plan flow trusts a client-provided storage key and has no object
cleanup contract. The approved legacy behavior permits both PLAN and REAL images. Node detail
history is fixed to a latest-reading window and cannot express rolling hours or a local calendar
day. The lifecycle migration was present but not applied to the active databases.

**Decision:** Generalize the Company Logo provider code into a private-asset storage boundary while
retaining separate domain validation and server-owned key generation. Accept magic/MIME/extension-
matched PNG/JPEG/WebP up to 8 MiB and permit four active PLAN plus four active REAL images per
building, preserving the V2 behavior because the blueprint defines no conflicting limit. Use
authenticated Admin/Company content routes, `building-plans.view|manage`, Company scope, private
cache headers and no public storage metadata. Use a durable image deletion state, idempotent object
removal, bounded retry and `ON DELETE RESTRICT` so building cascade deletion cannot bypass cleanup.

Require Node history `from`/`to` UTC ISO values with a maximum 24-hour half-open range. Keep tables
at 50/100 rows and cap charts at 500 deterministic evenly distributed ascending points with explicit
raw/returned/sample metadata. The UI defaults to Hour/12 and converts local Day midnight boundaries
to UTC. Realtime points merge only inside the active range and deduplicate by timestamp plus values.

Apply database migrations before API and Web deployments. A schema-lag E2E assertion checks the
lifecycle and image columns before endpoint verification. Database errors retain useful server-side
Prisma/request context and return only a generic client message.

**Consequences:** This adds one forward migration for building image storage/deletion metadata and
the RESTRICT foreign key. Existing image metadata rows without private content are not exposed as
downloadable objects. Production bucket provisioning and real S3 execution remain Phase 14 work.
The scrollbar and large Alarm Rule modal changes are presentation contracts only; alarm business
logic, RBAC separation and MQTT behavior are unchanged.

**Files affected:** Prisma schema/migration, private-assets and organization modules, monitoring
DTO/service/controllers, shared contracts, Admin/Company image/history UI, focused API/Web tests and
`docs/architecture/BUILDING_IMAGES_AND_NODE_HISTORY.md`.

## DEC-2026-0727-03 — Evidence-safe retirement/archive and the hidden navigation scrollbar exception

**Status:** accepted; supersedes only the history-blocking deletion portion of DEC-2026-0727

**Context:** DEC-2026-0727 correctly required immutable assignment, command, monitoring and alarm
evidence to survive, but its capability implementation counted ended history as a permanent delete
blocker. Operators could resolve every live relationship and still never use Delete. The Company
user editor also could not submit an empty Position assignment list, and recipient policies could
not use the already-existing update API. Separately, product review requires the main navigation
scrollbar to be invisible and the native Node Day date field is unusable in the target browser.

**Decision:** Active dependencies and unfinished operations remain `NOT_ALLOWED` and are checked
again under row locks. A truly pristine Gateway, Node or Position is `HARD_DELETE`. A Gateway or
Node with immutable history but no active blocker is `SOFT_DELETE` to `RETIRED`; a Position in the
same state is archived through additive `deletedAt`, `deletedByType` and `deletedById` fields. All
assignment, command, reading, alarm, notification and audit evidence stays intact. Retired devices
and archived Positions are excluded from active inventory, selectors and recipient resolution and
cannot be assigned, commanded or reactivated through ordinary lifecycle operations.

Saved Position assignments can be explicitly removed and the replacement endpoint accepts an
empty list while ending rows. Recipient policies can move between active Positions and specific
users, change channel/count settings, increment evaluation version, reset counters and preserve
before/after audit snapshots. Audited old Position targets count as historical policy evidence even
after a policy moves.

All intentional scroll surfaces keep the shared visible scrollbar except the Admin/Company main
navigation sidebar, whose visual scrollbar is hidden without disabling overflow. Node Day history
uses the matched Mantine `DatePickerInput`, prevents future days and maps the selected local calendar
day to a UTC half-open range.

**Consequences:** The old decision remains authoritative for lifecycle permissions, evidence
retention, assignment ending and pagination. Only its implication that ended Gateway/Node/Position
history permanently disables Delete is superseded. Migration
`20260727220000_device_retirement_position_archive` is forward-only and deployment order is
**migrate → API → Web**. Frontend capability/count data remains advisory; backend permissions,
company scope and transaction-time checks are authoritative.

**Files affected:** device, gateway-command, Company-management, alarm evaluation/dispatch and
Prisma modules; contracts; Admin Devices, Company Users/Positions, Alarm Rules, monitoring drawer,
portal shell/styles/i18n; unit/API/Playwright tests; and the required architecture, design, planning
and security documents.

## DEC-2026-0728-01 — Archive alarm configuration; retain operational evidence

**Status:** accepted

**Context:** Operators could not delete a Rule or Recipient Policy after it created counters,
triggers or notifications. Clearing those immutable rows individually would make routine
configuration management difficult and would destroy the evidence needed for incident review,
delivery diagnosis and audit. Alarm/Notification lists also supported only one-row archive, while
Policy summaries omitted the scope and counter settings needed to manage them safely.

**Decision:** Normal Rule and Policy Delete is an archive operation. It records actor/time, marks the
configuration inactive, resets mutable counter state and excludes it from normal lists, occurrence
evaluation and notification dispatch. Rule archive archives its active Policies in the same
transaction. Alarm Events, Policy Triggers, Notifications, delivery attempts and audit rows are not
cascaded. A trigger claimed after configuration archive is terminally skipped.

Alarm Events and Notifications gain scoped atomic bulk archive for 1–100 selected IDs. Events are
resolved-only; a mixed or invalid selection rejects the whole request. The UI shows current-page
selection controls left of pagination. Policies use a columnar table and a complete detail/action
drawer. Construction Site and Building lists use one shared but domain-distinct organization card
contract.

**Consequences:** Operators can retire configuration without manually destroying history. Storage
retention remains a separate future policy/job decision, never an implicit side effect of UI
Delete. Backend permissions and company/building scope remain authoritative. Migration
`20260728110000_alarm_rule_policy_archive` is additive and forward-only; production deployment is
**migrate → API → Web**.

**Files affected:** Prisma schema/migration; alarm DTO/controllers/service/evaluator/dispatcher;
contracts and shared pagination; Alarm Operations and organization card UI/styles/i18n; API/Web
tests; architecture, design, planning and quality documents.

## DEC-2026-0728-02 — Recipient Policy rows open one Drawer-owned action surface

**Status:** accepted

**Context:** The targeted 2026-07-28 alarm design text retained an Actions column and Policy row
menus, while the current product correction requires one discoverable detail surface and no
duplicate mutation entry points. The evidence-safe Rule/Policy archive decision remains unchanged.

**Decision:** Recipient Policies keep the operational Rule, Target, Building, Severity, Required
occurrences, Count interval seconds, Channel and Status columns. The Actions column and every row
menu are removed. The complete row is a keyboard-focusable interactive row that opens the existing
Policy Drawer with click, Enter or Space and ignores activation from nested interactive descendants.
The Drawer is readable with `alarm-rules.view`; Edit, Activate/Deactivate and Delete/archive are
rendered only with `alarm-rules.manage`. The active Drawer row has a visible selected state.

**Consequences:** Policy mutation has one permission-aware UI surface while backend permission,
Company scope, archive transactions, counter reset, evaluation/dispatch exclusion and immutable
alarm/trigger/notification/delivery/audit evidence remain authoritative and unchanged. This
decision supersedes only the Actions-column and duplicate-row-menu wording in the design documents;
it does not change the Rule table or any API/schema contract.

**Files affected:** `docs/design/DESIGN_SYSTEM.md`, `docs/design/UI_UX_SPEC.md`,
`apps/web/src/features/alarms/AlarmOperationsPages.tsx`, `packages/ui/src/data-table.tsx`, focused
Web/Playwright tests and the planning/quality handoff documents.

## DEC-2026-0728-03 — GSS Administrator management uses the existing Admin-user permission family

**Status:** accepted

**Context:** GSS roles, permissions, password hashing and last-active-Super-Admin protection already
exist, but there is no operator-facing GSS Administrator API or page. The permission catalog already
defines `admin-users.view`, `admin-users.create`, `admin-users.update`, `admin-users.delete` and
`admin-users.manage`; inventing an `administrators.*` family or reusing Company-user permissions
would create a third authorization vocabulary for the same platform identity.

**Decision:** The canonical management resource is `/admin/gss-users`. Listing and the bounded GSS
role selector require `admin-users.view`; creation requires `admin-users.create`; identity, role,
status and password changes require `admin-users.update`; permanent deletion requires
`admin-users.delete`. `admin-users.manage` remains reserved for a future explicitly defined bulk or
delegated-management workflow. Responses never expose password hashes, token versions or secrets.
New and replaced passwords use the repository's existing bcrypt cost.

Changing a password or active status increments the authentication token version. Deactivation,
demotion from a Super Admin role and deletion take the same transaction-scoped PostgreSQL advisory
lock and recheck that another active Super Admin remains. Audit snapshots contain only safe identity,
role and status values; independent audit evidence is retained after an Administrator is deleted.

**Consequences:** Administrator management uses the existing separate GSS Admin RBAC context and
does not affect Company-user roles, positions or scope. No Prisma schema change, migration or seed is
required. Backend permission checks and the transactional safe-admin policy remain authoritative;
frontend controls are discoverability and UX only.

**Files affected:** settings controller/service/DTO/module, safe-admin policy tests, shared contracts,
Admin routing/navigation/page/i18n, focused API/Web/Playwright tests, RBAC and planning documents.

## DEC-2026-07-29-01 — Two-tier Archive and GSS-controlled physical purge (ACCEPTED)

**Decision:** Company-context Delete is not physical deletion. It records canonical `deletedAt` /
actor/reason metadata, removes the entity and archived ancestors from Company operational surfaces,
and retains GSS evidence. The authoritative evidence surface is GSS-only Archive Center. Physical
purge is allowed only for an archived root to a GSS Admin holding both `archive.purge` and the
canonical domain permission, after backend preview/fingerprint, exact-name confirmation and an
idempotent durable job. Parent purge owns child cleanup; users do not manually purge descendants.
Global Gateway/Node/NodeType and platform RBAC catalog/identities are preserved. Trigger readings
remain until the last evidence/counter reference is removed.

**Supersedes/clarifies:** DEC-2026-052 and the pristine-only portions of DEC-2026-0727 /
DEC-2026-0727-03 are superseded only for GSS-controlled tenant Archive purge. Pristine-only global
device hard-delete rules remain. DEC-2026-0728 alarm evidence archive remains valid and is extended
with GSS purge. Company clients must not receive a hard-delete capability.

**Consequences:** normal queries require explicit and ancestor archive filtering; Company direct ID
returns 404; storage remains during Archive and is removed only in purge; Gateway/Node are unassigned
without forced lifecycle changes; completed purge cannot be application-rolled back; a sanitized
receipt remains without tenant PII/payload/storage keys.

**OPEN_DECISION:** backup retention/legal hold/restore policy and permanent S3 version/delete-marker
cleanup are not approved. Destructive production enablement is blocked until accepted.

**Files affected:** Prisma schema/forward migration/seed, auth/scope/organization/company/alarm/
monitoring/device/command/report/storage/audit services, Archive module, Admin/Company Web routes,
design/architecture/quality/planning documentation.

## DEC-2026-07-29-02 — Database-leased deletion workers and evidence-safe user purge (ACCEPTED)

**Decision:** Add a forward-only `DeletionJob` lease owner, expiry, heartbeat and attempt counter.
Workers claim pending or expired-running jobs conditionally in PostgreSQL, renew the lease during
bounded phases and allow a new instance to resume a stale job idempotently. Permanent purge of an
archived CompanyUser detaches specific-user policy and notification recipient foreign keys while
retaining immutable snapshots; archived Position purge detaches historical position targets;
custom Role purge rejects protected or assigned roles.

**Consequences:** Process-local overlap protection is no longer the multi-instance security
boundary. Active policies and protected dependencies remain fail-closed. `AlarmNotification`
recipient provenance becomes nullable only for purged archived users; normal live dispatch still
requires an actual active recipient. Migration
`20260729140000_deletion_worker_lease_and_user_evidence` must deploy before the corresponding API.
Forced-crash resume, two-worker conditional claim, lease-loss detection, crash-after-root-delete,
exactly-one receipt and orphan reconciliation are now repository-tested. Production destructive
enablement remains blocked only by the external storage, backup, legal-hold, restore and purge-SLA
decisions in DEC-2026-07-29-01.

## DEC-2026-07-29-03 — Existing report pipeline, typed reading filters and reconciliation (ACCEPTED)

**Decision:** Archive CSV/XLSX uses `ReportJob`/`ReportExport` and private storage, with
`archive.view + reports.export`; Company users cannot request this type. SensorReading physical
purge persists a typed backend filter snapshot and globally serialized DeletionJob, never browser
ID aggregation. Reconciliation is a read-only GSS Archive report that counts deterministic command
provenance discrepancies, safe ambiguous legacy assignment rows, FK orphans and missing/failing
storage metadata without returning object keys.

**Consequences:** Archive export inherits report ownership, audit, expiry and authorized streaming.
Referenced readings remain ineligible. Ambiguous provenance is reported but is not treated as an
unexpected orphan or guessed into tenant ownership. Provider failures are counted separately from
confirmed missing objects and no raw provider error is exposed.

## DEC-2026-07-30-01 — Deterministic Korean default with persisted English selection (ACCEPTED)

**Decision:** The Web application supports exactly `ko` and `en`; Korean is the deterministic
default and browser language is ignored. A valid explicit choice is stored under
`gss-iot.locale.v1`, updates `html lang` and re-renders the active application tree without resetting
the route, authenticated session or theme. Both catalogs have compile-time key parity and runtime
placeholder parity. Machine identifiers, MQTT payload fields and immutable evidence stay unchanged.

**Decision:** Backend exceptions keep stable codes as the localization boundary. The Web client
shows localized code/status copy and stores raw backend text only as technical detail. New alarm
notifications retain a template key and parameter snapshot. Report jobs retain the normalized
request locale in their existing internal filter snapshot; the worker localizes headers, semantic
values and filename without changing the public DTO or report routes.

**Consequences:** Permission/action/scope and canonical node-type presentation is key-driven;
`requiredOccurrenceCount` remains 발생 횟수 and `countIntervalSeconds` remains 집계 간격. Archive
Center remains 보관함 and physical purge remains 영구 삭제. No RBAC, company scope, MQTT, alarm
counter, retention, archive or purge rule changes. `pnpm i18n:audit` blocks catalog drift, placeholder
drift, implicit browser-locale formatting and new direct visible JSX literals.

## DEC-2026-08-01-01 — Theme-aware platform header identity (ACCEPTED)

**Decision:** The authenticated Admin and Company headers render a single shared platform brand
before the divider and current-route context. Light mode uses
`/assets/gss-logos/Gss-logo-blue.svg`; dark mode uses `/assets/gss-logos/GSS-logo.svg`. The visible
localized `Global Smart Solutions` wordmark remains part of that same brand group at desktop and
mobile widths, while lower-priority route context may still be hidden on narrow screens. The image
keeps one localized accessible name and the adjacent visible wordmark is hidden from the
accessibility tree to avoid duplicate announcement.

**Supersedes/clarifies:** The older `DESIGN_SYSTEM.md`, `UI_UX_SPEC.md` and `PAGE_INVENTORY.md`
wording that prescribed the blue asset for every theme and repeated a separate compact header
brand is superseded. Company-owned sidebar branding and all permission, routing, notification,
realtime and theme persistence behavior remain unchanged.

**Consequences:** Brand selection is driven by Mantine's computed color scheme, not CSS filters or
duplicated hidden images. Responsive QA must prove the logo, wordmark, divider, route context and
existing controls do not overlap or introduce document-level horizontal overflow.

## DEC-2026-08-01-02 — HttpOnly access and rotating refresh sessions (ACCEPTED)

**Decision:** Supersede the Phase 1/7 browser bearer-session foundation. Browser REST and Socket.IO
authentication accepts only a short-lived access JWT in an HttpOnly cookie. A separate HttpOnly
refresh JWT uses a distinct secret/audience, a narrow `/auth` cookie path and a one-time rotating
PostgreSQL `RefreshSession` whose raw token is never stored. Rotation records lineage; reuse revokes
the still-active family. The browser stores only auth context, uses double-submit CSRF for every
unsafe request and performs one shared refresh plus one retry after a 401. Replacement refresh
credentials inherit the family's original absolute expiry instead of sliding the lifetime forward;
each Socket.IO connection cycle likewise attempts refresh/reconnect only once until it connects.

**Supersedes/clarifies:** DEC-2026-002 and DEC-2026-007 remain authoritative for separate auth
contexts, active-user checks and token-version invalidation, but their bearer delivery and deferred
refresh statements are superseded. DEC-2026-010's audience fix remains valid for both token types.
DEC-2026-025's route restoration remains valid, but no credential is persisted in Web storage.

**Consequences:** Login/refresh bodies expose only the public session. CORS is credentialed and
allowlisted; Authorization is not an allowed browser header. Logout revokes refresh sessions and
increments token version. Migration `20260801090000_http_only_rotating_auth` deploys before the API,
existing browser sessions log in again, and production requires two distinct secrets plus HTTPS
cookie settings. Detailed rollout/rollback is in `HTTP_ONLY_AUTH_SESSION_SECURITY.md`.

## DEC-2026-08-01-03 — Backend-composed scoped overviews and local date/time boundaries (ACCEPTED)

**Decision:** Company Area/Building overview pages consume dedicated backend-composed read models.
The base endpoint repeats permission plus scope enforcement; each optional section has its own view
permission, database total and at-most-100 preview. Access-source evidence is deduplicated per user.
The browser does not aggregate totals from paginated collection responses.

Sensor History and Archive use shared Mantine local date/optional-time controls and normalize once
to UTC request values. History is an exact 24-hour default with exclusive `to`; Archive date-only
`to` includes the last local millisecond. Invalid, partial, reversed and over-31-day ranges are
blocked before network calls, and runtime timezone rules supply DST offsets.

**Consequences:** Scope/RBAC remain backend boundaries, overview response size is bounded, and list
pagination no longer changes KPI truth. List/export paths receive the same normalized Archive
filters. No alarm, retention, MQTT or stored UTC semantics change.
