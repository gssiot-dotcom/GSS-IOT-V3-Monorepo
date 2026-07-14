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

## Deferred

See `IMPLEMENTATION_PLAN.md` for later phases.
