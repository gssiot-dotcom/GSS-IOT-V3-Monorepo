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

- [ ] Create Prisma schema foundation.
- [ ] Create permission catalog constants and seed.
- [ ] Implement GSS admin auth.
- [ ] Implement company auth.
- [ ] Implement permission resolver.
- [ ] Implement company/site/building scope guards.
- [ ] Implement self-lockout protections.

## UI foundation

- [ ] Create GSS Mantine theme.
- [ ] Create shared layout and navigation.
- [ ] Create route/action permission helpers.
- [ ] Implement immutable legacy node-type selection card.
- [ ] Add visual regression tests for core components.

## Deferred

See `IMPLEMENTATION_PLAN.md` for later phases.
