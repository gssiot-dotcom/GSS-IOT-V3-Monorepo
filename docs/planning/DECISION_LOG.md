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

**Consequences:** Wave 3 is presentation-only across the requested Admin and
Company surfaces. Targeted authenticated screenshots and the web Vitest suite
remain follow-up evidence because the current browser is unauthenticated and
the focused Vitest runner hung before producing results. Repository-wide visual
QA and Wave 4 remain deferred.

**Files affected:** `apps/web/src/features/dashboard/`,
`apps/web/src/features/monitoring/`, `apps/web/src/features/alarms/`,
`apps/web/src/features/reports/`, `apps/web/src/features/settings/`,
`packages/ui/src/status-badge.tsx`, `apps/web/src/app/i18n.ts` and the Wave 3
planning handoff entries.
