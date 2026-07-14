# GSS IoT V3 — Project State

## Current phase

`PHASE_0_COMPLETE`

## Last completed milestone

Phase 0 repository bootstrap completed and all mandatory code gates verified on 2026-07-14.

## Current repository status

- Application source scaffold: NestJS API and React/Vite web shell created
- Database schema: Prisma/PostgreSQL datasource scaffold only; business entities deferred
- CI: template only
- Quality gates: format, lint, typecheck, unit tests, build, API E2E, Playwright discovery, Prisma validation and Docker Compose validation passed
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

## Next action

Wait for an explicit Phase 1 prompt. Do not add business features during the completed bootstrap phase.
