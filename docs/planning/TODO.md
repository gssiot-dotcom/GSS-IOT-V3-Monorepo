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

## Deferred

Alarm levels, fault filters, backend alarm classification, occurrence counting, notifications, reports, partitioning, archival and external delivery providers remain deferred to Phase 9 or later.
