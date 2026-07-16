# GSS IoT V3 — Project State

## Current phase

`PHASE_6_COMPLETE`

## Last completed milestone

Phase 6 monitoring and realtime completed and verified on 2026-07-15. The repository now has SensorReading persistence, LatestNodeState upsert, typed legacy MQTT sensor ingestion, monitoring HTTP endpoints, Socket.IO room authorization and Company monitoring UI.

## Current repository status

- Application source: NestJS API keeps the Phase 1 separate GSS Admin and Company JWT contexts, active-user enforcement, permission resolution, decorators and scope guards.
- Database schema: Prisma RBAC, organization hierarchy, scope-access foundation, Phase 4 device history migration `20260714170000_device_inventory_assignments` and Phase 5 command migration `20260715120000_gateway_command_outbox` applied to `gss_iot_v3`; `prisma migrate status` reports the schema up to date.
- Seed: permission catalog, default GSS/company roles, canonical node types and environment-configured active GSS super admin seeded idempotently.
- Frontend: in-memory auth bootstrap, auth/permission guards, permission-filtered Admin/Company shells, protected placeholder routes, Phase 2 design-system demo route, universal UI states and legacy image-first node-type cards created.
- Phase 3 API: guarded GSS Admin and Company endpoints manage companies, areas, buildings, storage-key image records, company users, company-owned roles, direct permissions, area/building access and scoped position assignments. Critical mutations write audit logs inside their database transactions.
- Phase 3 UI: Admin company creation creates the initial platform manager; Company routes now render scoped area/building lists plus company-user and role management views using the shared Phase 2 shell and UI primitives.
- Phase 4 API: guarded GSS Admin endpoints manage node types, gateway inventory, node inventory, company-device assignment, gateway-building assignment and node-gateway assignment. Company endpoints expose company, area and building scoped device snapshots. Critical create, update, assign, unassign and move operations write audit logs.
- Phase 4 UI: Admin `/admin/devices` renders gateway/node inventory tables, create dialogs and permission-wrapped assignment actions. Company `/company/devices` renders assigned gateways and nodes through the shared shell.
- Phase 5 API: guarded GSS Admin endpoints list, inspect, create, retry, cancel and expire GatewayCommands. Commands are persisted before publish and all publish, acknowledgement, retry, expiration and cancel transitions are audited.
- Phase 5 MQTT: `MQTT_ENABLED=false` keeps local/test runs broker-free; `MQTT_FAKE_ACK=true` simulates publish acknowledgement for E2E and smoke tests. Real broker connection uses validated broker URL, client id, optional credentials, topic base and publish/command timeouts.
- Phase 5 UI: Admin `/admin/gateway-commands` renders the command list, status badges, payload/response detail drawer, retry and cancel actions behind `mqtt-commands.view/manage`.
- Phase 6 API: additive migration `20260715150000_phase_6_monitoring_realtime` adds `SensorReading`, `LatestNodeState` and `SensorReadingStatus`. GSS and Company monitoring endpoints return scoped building overview, node-type latest states and paginated sensor history using `monitoring.view`.
- Phase 6 MQTT: sensor subscriptions cover legacy `GATE_PUB`, `GATE_ANG` and `GATE_FORM` topics. Payload normalization supports door, angle and gangform/vertical naming, validates active gateway/node/company/building assignments and deduplicates packet/message/sequence/measured-time keys.
- Phase 6 Realtime: Socket.IO joins require authenticated active users, `monitoring.realtime` and company building scope where applicable. Rooms are server-created as building/node-type scoped names, and normalized node-state events emit only after reading persistence and latest-state upsert.
- Phase 6 UI: Company monitoring starts at scoped building selection, enters through the three preserved legacy node-type image cards, shows latest value/status/gateway context/value age, keeps last known values across disconnects and displays paginated node history.
- Shared UI: `packages/ui` exports the normalized GSS Mantine theme, page header, data table/pagination footer, status badge, universal states and node-type selection card primitives.
- Runtime configuration: API CORS is environment-driven through `CORS_ALLOWED_ORIGINS`; local development defaults support both `http://localhost:5173` and `http://127.0.0.1:5173`. Auth remains bearer-token based with no login cookies.
- CI: template only
- Quality gates: frozen install, format, lint, typecheck, unit tests, build, API E2E, browser E2E, combined E2E, Prettier check and `git diff --check` pass. `git diff --check` reports only Git line-ending warnings on Windows.
- Architecture blueprint: available
- UI/UX specification: available
- Legacy source archives: available
- Legacy source inventory and preserved node assets: verified
- Custom Codex skill: available

## Verified decisions

- New greenfield monorepo; legacy project is reference only.
- Backend: NestJS + TypeScript.
- Database: PostgreSQL + Prisma.
- Prisma: `prisma` and `@prisma/client` pinned to `6.19.0`.
- Frontend: React + Vite + TypeScript.
- Workspace TypeScript: root solution project references buildable workspace outputs; apps consume shared packages through package exports.
- Primary UI system: Mantine + Tabler icons using Parfumbox admin patterns.
- Colors: normalized GSS palette.
- Realtime: Socket.IO.
- MQTT: durable GatewayCommand outbox.
- RBAC: separate GSS Admin and Company contexts.
- Alarm: caution/warning/danger occurrence-count model.

## Open decisions

- Exact SMS/Telegram/email providers for first release.
- Production hosting and storage provider.
- Physical SensorReading purge job, PostgreSQL partition interval and archival implementation after the Phase 6 default 180-day retention target.
- Whether company can edit position catalog or only assign seeded positions.
- Exact rule behavior after alarm acknowledgement while unsafe readings continue.
- Legacy data migration cutoff and coexistence window.
- Object-storage provider and browser-to-provider transfer mechanism for `BuildingPlanImage.storageKey`. Phase 3 persists and audits image metadata only; no unapproved local or cloud provider adapter was introduced.

## Verification record

The API entry point and E2E setup load `apps/api/.env` through `dotenv/config`. The verified redacted target is `postgresql://<redacted>:<redacted>@localhost:5432/gss_iot_v3?schema=public`, and `current_database()` returned exactly `gss_iot_v3`.

The database-backed integration suite is `apps/api/test/e2e/health.e2e-spec.ts` and `apps/api/test/e2e/rbac.e2e-spec.ts`. It verifies Prisma-backed API startup plus GSS super-admin bypass, inactive-user rejection, missing-permission rejection, same-company cross-building scope denial, cross-company scope denial, and GSS-token rejection on company endpoints. No standalone integration-test script is configured.

Phase 2 UI verification includes `packages/ui/test/theme.spec.ts`, `packages/ui/test/node-type-card.spec.tsx`, `apps/web/src/test/App.spec.tsx`, `apps/web/src/test/rbac.spec.ts` and `apps/web/e2e/bootstrap.spec.ts`. The browser suite verifies the public `/phase-2/demo` route renders all three legacy node-type images and captures a non-empty node-card screenshot buffer.

Phase 3 verification includes `apps/api/test/e2e/rbac.e2e-spec.ts`. It now covers GSS creation of a company and platform manager, Company platform-manager area/building mutations, foreign-company position-scope rejection, GSS-only direct-permission rejection, last platform-manager self-deactivation rejection, and audit-log creation.

Phase 4 verification includes `apps/api/test/e2e/devices.e2e-spec.ts`. It covers authorized GSS device inventory creation and assignment, missing permission, direct deny, inactive company user login rejection, company/area/building scope denial, cross-company assignment rejection, validation errors, gateway/node move history, super-admin bypass and audit-log creation. Combined E2E was run against a temporary PostgreSQL schema so fixture cleanup did not touch normal development seed data.

Phase 5 verification includes `apps/api/test/gateway-commands.spec.ts` and `apps/api/test/e2e/gateway-commands.e2e-spec.ts`. It covers topic generation, typed payload adapters, transition validation, malformed MQTT payload handling, MQTT-disabled and fake-ack modes, GSS command permissions, direct deny, inactive user, invalid gateway and payload validation, persisted-before-publish command creation, fake publish acknowledgement, retry, cancel, expiration, super-admin bypass and GatewayCommand audit logs.

Phase 6 verification includes `apps/api/test/monitoring.spec.ts`, `apps/api/test/e2e/monitoring.e2e-spec.ts` and `apps/web/src/test/monitoring.spec.tsx`. It covers door/angle/gangform parser normalization, malformed/mismatched payload rejection, valid reading persistence, latest-state upsert, duplicate message dedupe, building/node-type filtering, paginated history, company scope denial, cross-company denial, authorized Socket.IO room join, unauthorized room rejection, correct-room realtime emission and the Company monitoring card route.

Phase 6 final commands passed: `pnpm install --frozen-lockfile`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, `pnpm --filter api exec prisma migrate deploy`, `pnpm --filter api exec prisma migrate status`, two runs of `pnpm --filter api exec prisma db seed` and `git diff --check`. `git diff --check` reported only Git line-ending warnings on Windows.

API, web, contracts, config and UI unit suites, API E2E, lint, typecheck, build and browser E2E pass.

Runtime CORS verification covers `http://localhost:5173`, `http://127.0.0.1:5173`, unknown-origin rejection, GSS login followed by `/auth/gss/me`, company login CORS behavior and no-cookie bearer-token responses.

## Next action

Await an explicit Phase 7 prompt. Do not begin alarm occurrence counting, notifications, reports, partitioning or archival automatically.
