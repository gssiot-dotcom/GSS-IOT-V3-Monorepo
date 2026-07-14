# GSS IoT V3 — Project State

## Current phase

`PHASE_1_COMPLETE`

## Last completed milestone

Phase 1 auth/RBAC foundation completed and verified against PostgreSQL on 2026-07-14. The configured `gss_iot_v3` database has the applied RBAC migration, idempotent seed data, and passing database-backed API E2E coverage.

## Current repository status

- Application source: NestJS API now has separate GSS Admin and Company JWT contexts, active-user enforcement, permission resolution, decorators and scope guards.
- Database schema: Prisma RBAC, organization hierarchy and scope-access foundation migration `20260714120000_rbac_foundation` applied to `gss_iot_v3`; `prisma migrate status` reports the schema up to date.
- Seed: permission catalog, default GSS/company roles and environment-configured active GSS super admin seeded idempotently. Verification found 89 permissions, five GSS roles, five company role templates, and one active GSS super admin.
- Frontend: in-memory auth bootstrap, auth/permission guards, permission-filtered sidebars and protected placeholder routes created.
- CI: template only
- Quality gates: frozen install, Prisma validation, format, lint, typecheck, unit tests, build, API E2E, browser E2E and `git diff --check` pass.
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

## Verification record

The API entry point and E2E setup load `apps/api/.env` through `dotenv/config`. The verified redacted target is `postgresql://<redacted>:<redacted>@localhost:5432/gss_iot_v3?schema=public`, and `current_database()` returned exactly `gss_iot_v3`.

The database-backed integration suite is `apps/api/test/e2e/health.e2e-spec.ts` and `apps/api/test/e2e/rbac.e2e-spec.ts`. It verifies Prisma-backed API startup plus GSS super-admin bypass, inactive-user rejection, missing-permission rejection, same-company cross-building scope denial, cross-company scope denial, and GSS-token rejection on company endpoints. No standalone integration-test script is configured.

## Next action

Await an explicit Phase 2 prompt. Do not begin Phase 2 work automatically.
