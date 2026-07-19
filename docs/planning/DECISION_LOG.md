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
