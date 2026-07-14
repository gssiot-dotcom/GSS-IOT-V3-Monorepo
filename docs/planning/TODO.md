# GSS IoT V3 — TODO

## Phase 0

- [ ] Initialize Git and pnpm workspace.
- [ ] Scaffold apps/packages.
- [ ] Add strict TypeScript, lint, format, unit and E2E tooling.
- [ ] Add environment validation and `.env.example` files.
- [ ] Add Docker Compose for PostgreSQL, Redis and local MQTT broker.
- [ ] Create legacy source inventory report.
- [ ] Verify source files and node images checksums.
- [ ] Confirm package/runtime versions from official documentation.
- [ ] Run all baseline quality commands.

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
