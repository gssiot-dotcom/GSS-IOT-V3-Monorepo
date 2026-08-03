# GSS IoT V3 — TODO

## 2026-07-30 Korean/English localization

- [x] Make Korean the deterministic default and persist an explicit Korean/English user choice.
- [x] Add the globe selector before the theme control in Admin and Company shells.
- [x] Replace the monolithic catalog with typed KO/EN catalogs and shared explicit-locale formatters.
- [x] Localize stable API errors, permission catalog display, canonical node types and notification
      template snapshots without exposing raw backend copy as the primary UI message.
- [x] Snapshot export locale and localize CSV/XLSX headers, semantic values and filenames.
- [x] Add catalog/placeholder/implicit-format/visible-JSX audit automation plus focused unit tests.
- [x] Verify Admin and Company KO/EN persistence and overflow at 1440×900, 1280×800 and 390×844.
- [ ] Product-owner copy review may refine Korean tone without changing glossary meanings or keys.

## Phase 0

- [x] Initialize Git and pnpm workspace.
- [x] Scaffold apps/packages.
- [x] Add strict TypeScript, lint, format, unit and E2E tooling.
- [x] Add environment validation and `.env.example` files.
- [x] Add Docker Compose for PostgreSQL, Redis and local MQTT broker.
- [x] Create legacy source inventory report.
- [x] Verify source files and node images checksums.
- [x] Confirm package/runtime versions from official documentation.
- [x] Run all baseline quality commands.

## Phase 1

- [x] Create Prisma schema foundation and initial migration.
- [x] Create permission catalog and default-role/super-admin seed.
- [x] Implement GSS admin auth.
- [x] Implement company auth.
- [x] Implement permission resolver.
- [x] Implement company/area/building scope guards.
- [x] Implement self-lockout protections.
- [x] Verify the `gss_iot_v3` database, apply migration, seed idempotently, verify RBAC data and run database-backed API E2E.

## UI foundation

- [x] Create GSS Mantine theme.
- [x] Create shared layout and permission-filtered placeholder navigation.
- [x] Create route/action permission helpers.
- [x] Implement immutable legacy node-type selection card.
- [x] Add visual/browser checks for core components.

## 2026-07-27 lifecycle and operator-flow correction

- [x] Hide only the portal sidebar scrollbar while retaining wheel, trackpad, touch, keyboard and
      programmatic scrolling in Admin and Company responsive shells.
- [x] Replace the native Node Day date field with the matched Mantine Dates calendar and verify the
      local-midnight UTC half-open request contract in both portal contexts.
- [x] Split Gateway/Node active blockers from immutable history; hard-delete pristine inventory and
      retire history-bearing inventory without deleting evidence.
- [x] Add transaction locks and a delete-versus-assignment race regression test.
- [x] Allow a Company user Position assignment list to become empty while preserving ended history.
- [x] Add recipient-policy editing and evaluation reset/audit coverage.
- [x] Add Position dependency counts, guided resolution UI, pristine hard delete and historical
      archive with actor/time metadata.
- [x] Exclude inactive/archived Positions and inactive/scope-mismatched recipients from dispatch.
- [ ] Production deployment remains an operations task: migrate → API → Web. Do not use `db push`.

## 2026-07-28 alarm lifecycle, bulk operations and organization cards

- [x] Archive history-bearing Alarm Rules and Recipient Policies through the normal Delete flow;
      retain alarm, trigger, notification, delivery and audit evidence.
- [x] Stop evaluation/dispatch for archived configuration and reset mutable counter state.
- [x] Add atomic 1–100 item bulk archive for resolved Alarm Events and scoped Notifications.
- [x] Replace the Policy summary rows with complete columns and an operational detail/action drawer.
- [x] Place current-page selection actions left of shared pagination on Alarm and Notification lists.
- [x] Replace generic Construction Site and Building cards with responsive domain-specific cards.
- [x] Add focused API E2E and Web unit regression coverage for the new workflows.
- [ ] Production deployment and real-provider smoke test remain operations tasks: migrate → API →
      Web. Do not use `db push` or cascade-delete evidence.

## Phase 2

- [x] Export shared GSS theme and reusable UI primitives from `packages/ui`.
- [x] Implement Admin and Company application shells with guarded sidebars, header, profile and notification affordances.
- [x] Add universal loading, empty, error, forbidden and session-expired state components.
- [x] Add i18n keys for shell, status, demo and monitoring fixture UI.
- [x] Add a Phase 2 demo route and typed node-card fixtures without real organization/device data.
- [x] Verify node-type card rendering through unit and browser checks.
- [x] Configure local-development CORS for the actual Vite origins without weakening production defaults.

## Phase 3

- [x] Add company, construction-area and construction-building CRUD with GSS Admin and Company permission/scope enforcement.
- [x] Add provider-neutral building plan/real-image metadata records with audited create/delete operations.
- [x] Add company user creation, update and deactivation with company-owned roles, direct permissions and scoped area/building access.
- [x] Add company position catalog and scoped position assignments, distinct from platform roles.
- [x] Add transaction-backed audit records for organization, role, scope, position and company-user changes.
- [x] Add Phase 3 API E2E coverage for company boundaries, position scope, global-permission denial and last platform-manager self-lockout.
- [x] Replace relevant Phase 2 placeholders with shared-shell Admin company creation and Company organization/user/role management screens.
- [x] Backfill missing approved default company roles idempotently so existing companies render role choices in the GSS Admin company-user create form.

## Phase 4

- [x] Add canonical `NodeType`, `Gateway` and `Node` inventory schema with the three legacy node types seeded idempotently.
- [x] Add `CompanyDeviceAssignment`, `GatewayBuildingAssignment` and `NodeGatewayAssignment` history tables with one active gateway-building assignment and one active node-gateway assignment.
- [x] Add transaction-backed GSS Admin APIs for gateway/node create, update, company assignment, building assignment and gateway assignment.
- [x] Add Company Dashboard device snapshot APIs with company, area and building scope enforcement.
- [x] Add audit logs for Phase 4 create, update, assign, unassign and move operations.
- [x] Add Admin and Company device pages behind route, sidebar and action-level permission checks.
- [x] Add Phase 4 E2E coverage for authorization, direct deny, inactive login rejection, scope denial, cross-company assignment rejection, validation/conflict cases, move history, super-admin bypass and audit creation.
- [x] Apply `20260714170000_device_inventory_assignments` without resetting the database and verify normal seed idempotency.

## Phase 5

- [x] Add `GatewayCommand` schema, status lifecycle, active uniqueness and indexes through forward migration `20260715120000_gateway_command_outbox`.
- [x] Add safe MQTT configuration with disabled/fake local test mode and real broker settings behind validated environment variables.
- [x] Implement MQTT topic generation, response parsing and typed legacy command adapters for `cmd 2`, `cmd 3`, `cmd 4` and `cmd 5`.
- [x] Implement GatewayCommand outbox create, publish, acknowledge, retry, expire, cancel and reconnect processing services.
- [x] Add GSS Admin gateway-command APIs and permission enforcement using `mqtt-commands.view` and `mqtt-commands.manage`.
- [x] Add Admin `/admin/gateway-commands` status UI with list, detail, retry and cancel actions behind permission checks.
- [x] Add unit and API E2E coverage for adapter payloads, topic parsing, malformed responses, status transitions, fake MQTT mode, permission denial, direct deny, inactive user, command lifecycle, audit logging and isolated fixtures.

## Phase 6

- [x] Add `SensorReading` and `LatestNodeState` schema through forward migration `20260715150000_phase_6_monitoring_realtime`.
- [x] Add typed MQTT sensor parsing for door, angle and gangform/vertical legacy payloads.
- [x] Persist valid unique sensor readings and upsert one latest-state row per node.
- [x] Add MQTT deduplication using packet/message/sequence/measured-time keys with a documented no-ID fallback.
- [x] Add GSS Admin and Company monitoring endpoints for building overview, node-type states and paginated sensor history.
- [x] Enforce `monitoring.view`, `monitoring.realtime` and company building scope for HTTP and Socket.IO room joins.
- [x] Add Socket.IO monitoring rooms and emit normalized node-state updates after persistence.
- [x] Add Company Dashboard monitoring UI through scoped building selection, the three legacy node-type image cards, realtime state and node history.
- [x] Document monitoring endpoints, Socket.IO rooms/events, MQTT payload normalization, dedupe, pagination and retention.
- [x] Run the full Phase 6 verification command set and smoke test before marking the phase complete.

## Phase 7

- [x] Fix Admin Company Open routing by adding explicit `/admin/companies/:companyId` route instead of falling through to `/login`.
- [x] Add safe browser session restoration for GSS Admin and Company contexts using stored token/context plus `/auth/gss/me` or `/auth/company/me`.
- [x] Add context-aware protected NotFound fallbacks so unknown authenticated `/admin/*` and `/company/*` URLs do not masquerade as auth failures.
- [x] Complete GSS Admin company setup subroutes for profile overview, construction sites, buildings, company users and assigned devices.
- [x] Improve company create/edit flows with required-field validation, loading state and duplicate/conflict feedback without weakening backend permissions.
- [x] Add frontend route/session tests for Open navigation, refresh/deep-link restore, expired sessions, NotFound, Forbidden and wrong auth context.
- [x] Run the full Phase 7 verification command set before marking the phase complete.

## Phase 8

- [x] Add relational MQTT provisioning request and item state linked to `REGISTER_NODES` GatewayCommands.
- [x] Require selected company, building, actively assigned gateway, node type and eligible company-owned unassigned nodes for cmd 2 provisioning.
- [x] Create active `NodeGatewayAssignment` rows only after strict successful gateway acknowledgement.
- [x] Mark negative responses failed, preserve raw response payloads and keep expired/cancelled/late/duplicate responses from creating assignments.
- [x] Make retries idempotent and prevent duplicate active assignments.
- [x] Reject cross-company gateway/node selection, wrong-building gateway selection, mixed node types and already-assigned nodes.
- [x] Replace raw UUID node-to-gateway UI with guided company/building/gateway/node-type/node selectors and command status display.
- [x] Document DB-only unassign while hardware unregister/remove protocol remains unconfirmed.
- [x] Add Phase 8 unit, API E2E and web UI coverage.
- [x] Apply `20260716120000_phase_8_device_provisioning` without resetting the database and verify seed idempotency.
- [x] Add production-safe MQTT observability logs, protected sanitized status API and Admin status UI without exposing MQTT username/password.
- [x] Fix legacy MQTT cmd 2/cmd 5 node-number wire compatibility by publishing node arrays as JSON numbers, rejecting invalid numeric normalization before command persistence and adding raw response/malformed sensor debug diagnostics.
- [x] Add deterministic `requestId = GatewayCommand.id` payload stamping and response correlation for cmd 2/3/4/5, including retry reuse, exact requestId matching, strict legacy fallback and fast-ACK-safe status updates.
- [x] Run real hardware live gateway verification for Phase 8 requestId/numeric-node payload acknowledgement using selected gateway `0300`, command `160b3e5c-139d-479b-8535-a82f25f95b02` and nodes `100`, `101` and `102`.

## Phase 9

- [x] Add additive Prisma models and migration for building/node-type alarm-level desired state, version history, per-gateway application status, fault-filter desired/applied state and classification evidence.
- [x] Preserve existing GatewayCommand outbox for cmd 4 and cmd 5, including `requestId = GatewayCommand.id`, retry reuse, exact requestId correlation, fast-ACK safety and idempotent duplicate ACK behavior.
- [x] Implement guarded GSS Admin and Company APIs for viewing/updating building alarm levels, inspecting per-gateway status, viewing/updating fault filters and retrying failed configuration commands.
- [x] Validate angle/gangform thresholds with `0 < caution < warning < danger <= 12` and map legacy green/yellow/red to caution/warning/danger.
- [x] Validate fault-filter nodes by company, active gateway assignment, node type and numeric wire node number without numeric-normalization duplicates.
- [x] Make monitoring classification authoritative: door from `doorChk`, angle/gangform from `max(abs(angleX), abs(angleY))`, payload status diagnostic only and missing configuration `UNCONFIGURED`.
- [x] Retain ACK-applied fault-filtered readings with `faultFiltered=true` evidence for later occurrence-count exclusion.
- [x] Add Company monitoring UI tabs for alarm-level configuration, per-gateway application status, fault-filter node selection and retry action without raw UUID entry.
- [x] Add legacy-parity per-gateway + node-type alarm enable/disable using the existing GatewayCommand cmd 4 outbox, with desired/applied enabled state and no per-gateway threshold overrides.
- [x] Add focused unit/API E2E/web regression coverage for thresholds, backend classification, unconfigured state, cmd 4/cmd 5 requestId payloads, applied-state ACK behavior, numeric node arrays, duplicate ACK idempotency and Phase 1-8 cleanup compatibility.
- [ ] Run the full final Phase 9 verification command set after docs are complete.
- [ ] Perform live hardware verification for one explicitly selected available gateway: building-level cmd 4 fan-out, selected gateway/node-type disable, selected gateway/node-type re-enable, cmd 5 numeric-node success ACK, exact requestId ACK, desired/applied state and duplicate ACK idempotency.
- [ ] Mark Phase 9 complete only after all automated checks, migration/seed checks and live hardware verification pass.

## Phase 10

- [x] Audit Phase 3, Phase 7, Phase 8 and Phase 9 Company Portal/RBAC implementation before coding.
- [x] Preserve Phase 8 MQTT requestId/outbox protocol and Phase 9 desired/applied alarm configuration state.
- [x] Complete custom company role create/edit permission editor with company-only permission catalog.
- [x] Add safe custom-role update/delete behavior and protected default/system role handling.
- [x] Complete Company user create/edit workflows for role, active status, contact, direct allow/deny permissions and site/building scope.
- [x] Add read-only effective-access preview with role permissions, direct allow, direct deny, final permissions, direct buildings and area-inherited buildings.
- [x] Complete CompanyPosition catalog create/deactivate and scoped user-position assignments.
- [x] Reject inactive-position assignments and duplicate direct/scope/position assignments.
- [x] Add Company area detail, building detail and building-plan metadata routes.
- [x] Keep building-plan workflow at provider-neutral storage-key metadata boundary until production storage is decided.
- [x] Add API E2E and web unit coverage for Phase 10 role/user/scope/position/no-permission/inactive-token behavior.
- [x] Fix Phase 10 maintenance defect where normal read flows required platform-manager identity and optional frontend panel requests could replace authorized detail/users/roles pages with full-page errors.
- [x] Complete manual browser acceptance checklist before marking Phase 10 complete.
- [x] Mark Phase 10 complete after manual verification of custom scoped area/building detail, `site_manager` area/building detail, optional `/company/users` partial failure handling, Company Users with `company-users.view`, Company Roles with `company-roles.view`, no-users request without `company-users.view`, `no_permission`, inactive existing-session rejection, last active platform-manager lockout, monitoring and scoped resource filtering.

## Phase 11

- [x] Add additive Prisma models and forward migration for `AlarmRule`, `AlarmRecipientPolicy`, `AlarmCounterState`, `AlarmEvent` and immutable `AlarmPolicyTrigger`.
- [x] Enforce count/interval/target check constraints, one active rule per building + node type + severity, one counter state per policy + node and one trigger per policy + node + cycle.
- [x] Integrate occurrence evaluation into the existing MQTT monitoring path after unique `SensorReading` persistence, latest-state upsert and Phase 9 authoritative classification.
- [x] Use `SensorReading.receivedAt` as the count clock and preserve measured/payload timestamps as evidence only.
- [x] Use `GatewayAlarmLevelApplication.desiredEnabled` as backend evaluation intent without modifying `appliedEnabled` or publishing MQTT commands.
- [x] Exclude fault-filtered readings from counts while preserving SensorReading/latest-state evidence and resetting stale cycles.
- [x] Implement safe reset, severity-transition reset, desired-disabled reset and policy/version reset behavior.
- [x] Store active assignment provenance for gateway-company, gateway-building, node-company and node-gateway rows.
- [x] Create/reuse one active `AlarmEvent` per node + rule + severity episode and create one immutable `AlarmPolicyTrigger` per policy cycle.
- [x] Emit internal post-commit `alarm.policy-triggered` events without Phase 12 recipient notifications or provider delivery.
- [x] Add guarded GSS Admin and Company rule/policy/counter/event/trigger APIs using `alarm-rules.view`, `alarm-rules.manage` and `alarms.view`.
- [x] Add targeted Phase 11 E2E coverage for immediate/count-interval timelines, duplicate MQTT dedupe, reset behavior and API permission/scope access.
- [x] Run the full final Phase 11 verification command set.
- [x] Perform controlled manual sensor-flow acceptance with development MQTT/scripted readings and API/DB inspection.
- [x] Mark Phase 11 complete after manual verification of independent policy counters, multiple eligible triggers, one shared continuous-episode `AlarmEvent`, unsafe resolve rejection preserving status and safe-state resolution.

## Phase 12

- [x] Add forward Prisma migrations for `AlarmNotification`, `AlarmDeliveryLog`, alarm acknowledgement fields and durable `AlarmPolicyTrigger` dispatch state.
- [x] Resolve recipients from CompanyPosition/scope or specific CompanyUser without treating CompanyRole as a recipient category.
- [x] Create idempotent notification rows per policy trigger + recipient + channel.
- [x] Implement in-app delivery, sanitized delivery logs, provider status and deterministic test-provider retry failure.
- [x] Skip unconfigured external providers clearly without real vendor calls or secrets.
- [x] Add alarm list/detail, rule/policy configuration, notification inbox and unread bell UI for Admin and Company routes.
- [x] Add acknowledge and conservative manual resolve workflows with audit logs.
- [x] Add authorized Socket.IO notification rooms derived server-side.
- [x] Add targeted automated coverage for delivery, unread/read, ack/resolve and provider retry.
- [x] Prepare combined Phase 11/12 manual end-to-end acceptance checklist.
- [x] Fix the manual `/company/alarm-rules` create-rule Name crash, keep rule display name local until Save, contain modal validation/API errors and cover the shared Company/Admin rule form with focused web regression tests.
- [x] Perform combined manual sensor-to-notification-to-operations acceptance before marking Phase 12 complete.
- [x] Mark Phase 12 complete after manual verification of CompanyPosition + scope recipient resolution, scoped Site Manager notifications, independent Platform Manager policy notifications, shared alarm acknowledgement visibility, alarm detail Triggers/Notifications tabs, unsafe resolve rejection, automatic safe resolution and post-safe manual resolve.

## Phase 13

- [x] Surface backend conflict/validation responses in the shared Company/Admin Alarm UI when Resolve is rejected because the node is still unsafe; show a localized inline error with the safe backend message, leave alarm status unchanged, reset loading state and prevent duplicate submissions.
- [x] Add the backend/database ReportJob and ReportExport foundation with approved lifecycle statuses, requester/scope context, progress/error metadata, export expiry and opaque storage-key metadata.
- [x] Add company, device, monitoring, sensor, alarm, MQTT and audit reports with bounded scoped generators.
- [x] Keep report view/export permissions separate for Admin/Company list/detail, request and download endpoints.
- [x] Enforce authenticated Company company/site/building scope on report requests and export downloads; reject unvalidated client resource IDs.
- [x] Add export expiration and successful-download audit behavior without exposing storage keys.
- [x] Add focused automated coverage for the Phase 13 report foundation, lifecycle, permissions, scope and download requirements.
- [x] Add report generators, internal claim-safe job processing and scoped report data queries with normalized CSV/XLSX output.
- [x] Add configurable internal report scheduler/worker integration with bounded batches, conditional claims, overlap prevention and graceful shutdown.
- [x] Add local development/test and production-capable S3-compatible report storage providers with private backend-authorized downloads.
- [x] Add bounded, idempotent expired-export storage cleanup while preserving ReportJob/ReportExport history.
- [x] Implement protected `/admin/reports` and `/company/reports` pages with separate view/export permission behavior.
- [x] Implement approved report type/filter/format selectors, scoped Company resources, date-range validation, active-job polling, expiration UX and authorized backend-stream downloads.
- [x] Add focused frontend report permission, scope, polling, duplicate-submit, CSV/XLSX, download, expiry, failure-redaction and endpoint-separation coverage.
- [x] Add approved dashboard recent-report-job and generation-status summary links without inventing analytics metrics.
- [x] Record the 2026-07-21 Phase 13 browser acceptance: GSS Admin and Company Reports routes, `PENDING` to `READY`/`COMPLETED` lifecycle, polling, CSV/XLSX generation/download, dashboard recent-report summaries/links and verified API-local report files.
- [x] Close Phase 13 after the browser evidence and existing focused web/API report security, scope, lifecycle, download and cleanup tests passed. Keep unsupported permission/security claims tied to automated evidence rather than claiming them as browser observations.
- [x] Keep undocumented legacy report layouts, direct-file access and unsafe storage behavior out of the product; no unsafe parity was added.
- [x] Record Phase 13 local private storage and expiry/cleanup verification. Production S3 execution and standalone worker deployment were not executed.
- [ ] Phase 14 (deferred; not started): configure and verify production S3 storage, production worker deployment, deployment manifests, migration/rollback runbooks and production acceptance.
- [ ] Phase 14 (deferred; not started): implement and verify long-term sensor retention, partitioning, archival and purge behavior.

## Deferred

Reports, exports, partitioning, archival, migration, deployment, live cmd 4/cmd 5 hardware verification and real external delivery vendors remain deferred according to the approved 2nd-step execution order and open provider decisions.

## Pre-Phase-14 refactor wave (3rd step)

- [x] Task 02: complete the preflight audit, reference extraction, refactor plan and ten-requirement acceptance checklist without changing Phase 13 or starting Phase 14.
- [x] Task 03: design-system foundation and app-shell completion with shared tokens/primitives, grouped permission-filtered navigation, accessible mobile toggle, focused tests and deterministic web unit execution.
- [x] Task 04: complete authenticated Admin/Company Welcome and view-only profile surfaces, safe session metadata, responsive account menu, permission-filtered notification bell and truthful notification realtime status with focused web/API coverage.
- [x] Task 05: add bounded permission-aware Admin/Company dashboard summaries, scoped KPI aggregates, operational charts, range selection, empty/loading/error states and retain report-job cards with API/web coverage.
- [x] Task 06: Admin roles and portal settings (GSS role CRUD with protected system roles, redacted read-only system readiness, authenticated Company contact settings and focused permission/scope/redaction coverage).
- [x] Task 07: device edit/delete and action UX (permission-controlled edits, pristine-only hard delete, server-derived blockers, structured lifecycle conflicts, audit preservation and accessible compact actions).
- [x] Task 08: bulk node creation (canonical V2-style single/range/list parser, atomic auditable API, duplicate/validation conflicts and preview/count UX).
- [x] Task 09: explicit APPEND/REPLACE node provisioning protocol (durable mode/final membership, strict-ACK replacement history, concurrency guard and preview UX).
- [x] Task 10: monitoring cards, tables and node-detail charts (Company TABLE/CARD toggle, V2-inspired typed cards, bounded detail charts and fault-filter separation).
- [x] Task 11: Admin monitoring completion (global aggregate read models, selector cascade, shared drilldown/realtime workspace and permission/scope coverage).
- [x] Task 12: global UI/UX modernization and responsive polish (shared responsive hierarchy, table accessibility/scroll, mobile drawer close, focus styling, representative desktop/mobile smoke and frozen design conventions).
- [x] Task 13: final regression, manual acceptance and handoff (full automated regression green; public desktop/mobile browser smoke recorded; protected visual and live hardware evidence explicitly kept as follow-up/pending).

Phase 14 remains explicitly deferred and must not be started by this wave.

## Wave 1 UI redesign

- [x] Audit the current UI and document the Wave 1 visual contract.
- [x] Refresh shared GSS tokens, shell, entity primitives, status badges, data
      tables and modal footers while retaining Mantine and Tabler.
- [x] Refactor Companies, Admin Company Detail, Company Resources and Company
      Users with entity-first hierarchy and permission-aware overflow actions.
- [x] Move destructive actions behind confirmation flows and preserve API,
      route, RBAC, scope, i18n, realtime and business behavior.
- [x] Add focused menu, permission, confirmation, modal-footer, status and row
      navigation tests.
- [x] Capture baseline and Wave 1 review screenshots at 1440x900, 1280x800 and
      390x844 for the selected review surfaces.
- [x] Run the Wave 1 quality gates and record the implementation handoff.

Wave 1 is complete for review.

## Wave 2 UI redesign

- [x] Refactor Admin and Company Devices with dense identity-first tables,
      semantic lifecycle/connectivity badges, local search and permission-aware
      assignment/delete actions.
- [x] Refactor Gateway Commands with semantic lifecycle/status presentation,
      compact identity-first records, sanitized detail inspection and confirmed
      retry/cancel actions behind existing permissions.
- [x] Refactor Company Area, Building and Building Plan detail surfaces with
      contextual headers, relationship tables, scoped optional queries and
      overflow navigation for secondary actions.
- [x] Refactor Company Roles with protected system-role treatment, searchable
      permission groups, effective-permission counts and confirmed custom-role
      deletion.
- [x] Preserve existing routes, API contracts, permission resolution, scope
      enforcement, assignment rules, MQTT behavior, validation and i18n keys.
- [x] Add focused unit coverage and authenticated exact-viewport visual captures
      at 1440x900, 1280x800 and 390x844.
- [x] Run Wave 2 handoff quality gates and record remaining risks.

Wave 2 is complete for review.

## Wave 3 UI redesign

- [x] Refine Admin and Company dashboards with real contract fields, partial
      report loading and operational hierarchy without inventing metrics.
- [x] Refine Company/Admin monitoring cards, tables, realtime status and
      detail entry while preserving legacy node-type card behavior.
- [x] Refine alarms, rules, notification and detail surfaces with semantic
      statuses, contextual actions and occurrence/count-interval evidence.
- [x] Refine report view/export split, job statuses and deliberate mobile
      report fallback without changing export endpoints or authorization.
- [x] Refine GSS roles, read-only system status and scoped Company settings
      while preserving protected-role and self-lockout safeguards.
- [x] Preserve routes, APIs, RBAC/scope checks, i18n and business behavior.
- [ ] Re-run authenticated targeted visual captures and focused web tests when
      a deterministic browser/test session is available.

Wave 3 is implemented for review. Wave 4 final visual QA is implemented and
documented in `docs/ui-redesign/WAVE4_FINAL_VERIFICATION.md`. The protected
and exact-viewport visual fixtures, unit suite, API E2E retry, lint, typecheck
and build pass. The aggregate web E2E command still times out in the existing
dark shared-surface evidence helper; resolve that harness risk before calling
the overall redesign release-ready. Do not start a Wave 5.

## Targeted post-Wave-4 corrections

- [x] Keep dashboard KPI and realtime monitoring summary sets six-across at
      1280/1440 with compact neutral shared surfaces and controlled wrapping.
- [x] Add accessible bounded telemetry and node-history SVG charts with
      mouse/keyboard portal tooltips and no new chart dependency.
- [x] Replace generic Company monitoring building entries with compact
      three/two/one-column semantic whole-card navigation.
- [x] Add the read-only Admin Permission Catalog at `/admin/permissions` and
      `/admin/settings/permissions`, guarded by `permissions.view`, without
      changing the existing role-editor catalog endpoint.
- [x] Add the shared Company Permission Catalog route/sidebar, retaining
      `company-permissions.view` and COMPANY/BOTH filtering.
- [x] Update permission seed descriptions idempotently without a migration or
      mutation endpoint.
- [x] Add focused web/API denial, scope-leak, inactive-session, search,
      read-only, tooltip, responsive and visual coverage.
- [x] Resolve the pre-existing dark shared-surface helper with the current overflow-menu
      interaction and paginated visual fixtures; the bounded focused test passes.

No Wave 5 or Phase 14 work is authorized by this correction.

## Targeted platform and Company branding

- [x] Add the shared Mantine/Tabler platform brand to Admin and Company headers without changing
      existing right-side controls.
- [x] Replace the Company sidebar product label with authenticated company logo/name branding,
      skeleton and fallback states.
- [x] Add Company Settings and Admin Company Edit logo preview/upload/replace/confirmed-remove UX
      with independent metadata/logo failure boundaries.
- [x] Add private memory/local/S3 company-logo storage, startup validation, magic-byte/size checks,
      opaque company-owned keys, audit records and transactional replacement cleanup.
- [x] Add permission-separated Company/Admin binary endpoints and remove `logoKey` from public
      company responses in favor of `hasLogo`.
- [x] Add provider, authorization, malformed/SVG, cache/ETag, object-URL and responsive light/dark
      coverage.
- [ ] Provision and verify production private S3 credentials/bucket through the deployment process.
- [x] Resolve the pre-existing dark shared-surface helper timeout with current fixture contracts
      and overflow-menu interaction coverage.

No Prisma migration, Wave 5 or Phase 14 start is part of this slice.

## Lifecycle/deletion/pagination correction

- [x] Replace generated platform marks with the exact supplied blue/white SVG assets.
- [x] Guard shared table/card navigation from SVG and keyboard action-menu activation.
- [x] Convert Company Detail and related operational tab groups to `WorkspaceTabs`.
- [x] Separate reciprocal lifecycle status endpoints from permanent deletion permissions.
- [x] Add pristine deletion capabilities and Alarm Event/Notification evidence archive.
- [x] Add Gateway/Node reciprocal unassignment with transactional history/audit rules.
- [x] Move GSS Role actions into the protected overflow menu.
- [x] Add the shared 50/100 pagination DTO, contracts, indexes, header UI and collection consumers.
- [x] Add lifecycle/deletion/pagination architecture and rollback documentation.
- [x] Pass lint, typecheck, unit, build, API E2E and bounded Playwright visual/browser verification.
- [ ] Provision production storage/database backups before applying the forward migration.

Phase 14 remains not started.

## Post-lifecycle regression and building media correction

- [x] Apply the existing lifecycle migration to development and E2E schemas and verify no pending
      migrations.
- [x] Verify Alarm, Notification and unread-count lists for Admin and Company and keep database
      failures observable without leaking raw details.
- [x] Keep public collection pagination at 50/100 and make Dashboard slice five jobs from a 50-row
      response.
- [x] Add shared private-asset memory/local/S3 providers and real PLAN/REAL multipart upload,
      authenticated display and durable audited deletion/retry.
- [x] Enforce four PLAN/four REAL, strict PNG/JPEG/WebP validation, Company scope and building
      deletion blockers.
- [x] Add Hour/Day half-open Node history ranges, 50/100 table pagination and bounded deterministic
      chart sampling metadata for Admin and Company.
- [x] Widen the Alarm Rule modal and replace hidden/inconsistent overflow bars with the shared
      light/dark scrollbar contract.
- [x] Add focused storage, API, migration-schema, scope, range and UI regression coverage.
- [ ] Provision and verify the production S3 bucket/credentials and production database/object
      backups during Phase 14 deployment work.

Phase 14 remains not started by this correction.

## 2026-08-03 header and Node heartbeat correction

- [x] Remove the duplicate `portal / current route` caption from the shared Admin/Company header.
- [x] Treat only accepted unique readings as heartbeat and persist the exact five-minute offline
      state without changing alarm or notification behavior.
- [x] Add bounded, race-safe, multi-instance-safe evaluation with one scoped realtime emission.
- [x] Preserve telemetry/evidence/`lastSeenAt` offline and recover immediately on the next reading.
- [x] Resynchronize Admin/Company monitoring on reconnect and keep Admin summary counts current.
- [x] Cover exact timing, repeated sweeps, race loss, scope isolation, UI ordering and responsive
      single-route header behavior.
- [x] Pass frozen install, lint, typecheck, i18n audit, 213 unit/component tests, production build,
      93 API E2E tests, 24 Playwright tests, task-scoped Prettier and `git diff --check`.
- [ ] Validate a real hardware Node silence/recovery cycle in the deployment environment; automated
      MQTT simulation covers the same backend contract locally.

No migration, seed, offline alarm notification or firmware work is introduced. Phase 14 remains
not started by this correction.

## 2026-07-28 targeted operations correction

- [x] Make Recipient Policy rows the sole table entry to the readable, permission-aware Drawer and
      remove duplicate Policy action columns/menus.
- [x] Add private ordered PLAN/REAL viewers to Admin/Company realtime monitoring with fit, bounded
      zoom, wheel, pan, reset, independent states and permission-safe request suppression.
- [x] Add the authenticated-Company active-user KPI and enlarge the contained Company sidebar logo.
- [x] Replace Admin Company generic cards with a distinct private-logo identity card while keeping
      table view and lifecycle actions.
- [x] Reproduce and correct the React Alarm checkbox `currentTarget` crash; stabilize/prune bulk
      selection and preserve localized failure feedback.
- [x] Add the Administrators navigation group and full existing-permission GSS Administrator CRUD,
      safe-admin transaction policy, redacted responses and audit evidence.
- [x] Add focused API/Web/browser coverage and update architecture, design, planning and quality
      contracts.
- [ ] Provision production backups/private S3 and apply the already-existing forward migrations in
      the documented migrate → API → Web order during the separately authorized deployment.

No new Prisma migration or seed is introduced by this correction. Phase 14 remains not started.

## Two-tier archive and SensorReading retention (2026-07-29)

- [x] Add forward archive/job/receipt/provenance schema migration and GSS-only permissions.
- [x] Convert Company-owned Delete endpoints to Archive and remove Company permanent-delete APIs.
- [x] Enforce archived-ancestor isolation across auth, Socket.IO, guards and primary operational paths.
- [x] Add GSS Archive Center list/detail/preview/idempotent-job/status/retry APIs and UI route.
- [x] Add ownership-ordered Company/Site/Building and alarm/notification/terminal-command purge adapters.
- [x] Preserve global Gateway/Node records and CompanyDeviceAssignment for Site/Building purge.
- [x] Add reference-safe 180-day bounded retention and Admin/Company Sensor History list/export UI.
- [x] Run full unit/build/API E2E/Web Playwright regression gates for the implemented foundation.
- [x] Add Archive evidence CSV/XLSX dataset to existing ReportJob/ReportExport pipeline.
- [x] Add GSS `sensor-readings.purge` server-filter preview/job/UI action (never browser ID aggregation).
- [x] Add fail-closed CompanyUser/CompanyPosition/custom CompanyRole physical purge adapters with
      immutable notification/policy evidence detachment and focused unit coverage.
- [x] Complete Archive Center hierarchy filters, detail drawer, export, polling progress, failure
      details and retry controls.
- [x] Complete Sensor History Company/Site/Building/Node Type/Node selectors, fault filter, chart and
      GSS retention dry-run controls; current backend filtering/list/export foundation is present.
- [x] Add database lease/heartbeat ownership, conditional stale-lease claims and persisted attempts
      for multi-instance deletion workers.
- [x] Add forced-crash/resume, stale-lease, lease-loss and exactly-one-receipt tests.
- [x] Produce deterministic legacy GatewayCommand/AuditLog/NodeGatewayAssignment reconciliation report.
- [ ] Implement/approve permanent S3 version and delete-marker cleanup.
- [ ] Approve backup retention/legal hold/restore policy (`OPEN_DECISION`).
- [x] Run storage failure/retry, orphan reconciliation, crash recovery and 100k+ SensorReading
      performance/lock tests before production enablement.

## 2026-08-01 production correctness and session hardening

- [x] Snapshot all five Company edit inputs before React functional state updates and cover the
      complete PATCH payload regression.
- [x] Render one light/dark-aware platform header brand with the visible localized wordmark and
      responsive no-overlap contract.
- [x] Replace native Sensor History/Archive date-time fields with shared Mantine controls, local to
      UTC normalization, exact 24-hour default, inclusive date-only Archive `to`, validation and
      DST-focused tests.
- [x] Add scope-guarded backend Area/Building overview read models with independent totals,
      100-row previews, permission-aware optional sections and deduplicated access-source evidence.
- [x] Move REST and Socket.IO auth to HttpOnly access cookies; add distinct rotating refresh JWTs,
      hash-only PostgreSQL sessions, reuse-family revocation, CSRF, credentialed CORS and one-shot
      frontend retry.
- [x] Add forward migration and production environment, deployment and rollback documentation.
- [x] Complete the repository lint, typecheck, unit, build, API E2E and browser verification gates.

Phase 14 remains not started by this correction.
