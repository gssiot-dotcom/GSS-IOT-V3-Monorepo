# GSS IoT V3 — TODO

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

## Deferred

Occurrence counting, AlarmEvent, recipient resolution, notifications, reports, partitioning, archival, migration, deployment and external delivery providers remain deferred to Phase 11 or later according to the approved 2nd-step execution order.
