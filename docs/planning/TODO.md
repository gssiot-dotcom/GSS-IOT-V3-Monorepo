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

## Deferred

See `IMPLEMENTATION_PLAN.md` for Phase 5 and later phases. MQTT command publishing, GatewayCommand outbox, sensor ingestion, realtime monitoring, alarms and reports were not started in Phase 4.
