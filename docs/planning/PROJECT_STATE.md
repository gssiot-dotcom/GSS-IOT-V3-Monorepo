# GSS IoT V3 — Project State

## Current phase

`PHASE_4_COMPLETE`

## Last completed milestone

Phase 4 device inventory and assignment history completed and verified on 2026-07-14. The repository now has auditable gateway/node inventory, company device assignment, gateway-building assignment and node-gateway assignment flows behind the Phase 1 authorization boundary and Phase 3 scope model.

## Current repository status

- Application source: NestJS API keeps the Phase 1 separate GSS Admin and Company JWT contexts, active-user enforcement, permission resolution, decorators and scope guards.
- Database schema: Prisma RBAC, organization hierarchy, scope-access foundation and Phase 4 device history migration `20260714170000_device_inventory_assignments` applied to `gss_iot_v3`; `prisma migrate status` reports the schema up to date.
- Seed: permission catalog, default GSS/company roles, canonical node types and environment-configured active GSS super admin seeded idempotently.
- Frontend: in-memory auth bootstrap, auth/permission guards, permission-filtered Admin/Company shells, protected placeholder routes, Phase 2 design-system demo route, universal UI states and legacy image-first node-type cards created.
- Phase 3 API: guarded GSS Admin and Company endpoints manage companies, areas, buildings, storage-key image records, company users, company-owned roles, direct permissions, area/building access and scoped position assignments. Critical mutations write audit logs inside their database transactions.
- Phase 3 UI: Admin company creation creates the initial platform manager; Company routes now render scoped area/building lists plus company-user and role management views using the shared Phase 2 shell and UI primitives.
- Phase 4 API: guarded GSS Admin endpoints manage node types, gateway inventory, node inventory, company-device assignment, gateway-building assignment and node-gateway assignment. Company endpoints expose company, area and building scoped device snapshots. Critical create, update, assign, unassign and move operations write audit logs.
- Phase 4 UI: Admin `/admin/devices` renders gateway/node inventory tables, create dialogs and permission-wrapped assignment actions. Company `/company/devices` renders assigned gateways and nodes through the shared shell.
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
- SensorReading retention and PostgreSQL partition interval.
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

API, web, contracts, config and UI unit suites, API E2E, lint, typecheck, build and browser E2E pass.

Runtime CORS verification covers `http://localhost:5173`, `http://127.0.0.1:5173`, unknown-origin rejection, GSS login followed by `/auth/gss/me`, company login CORS behavior and no-cookie bearer-token responses.

## Next action

Await an explicit Phase 5 prompt. Do not begin MQTT, GatewayCommand outbox, monitoring, alarm or report work automatically.
