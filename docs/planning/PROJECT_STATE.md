# GSS IoT V3 — Project State

## Current phase

`PHASE_0_NOT_STARTED`

## Last completed milestone

Codex starter configuration and architecture sources prepared.

## Current repository status

- Application source scaffold: not created
- Database schema: not created
- CI: template only
- Architecture blueprint: available
- UI/UX specification: available
- Legacy source archives: available
- Custom Codex skill: available

## Verified decisions

- New greenfield monorepo; legacy project is reference only.
- Backend: NestJS + TypeScript.
- Database: PostgreSQL + Prisma.
- Frontend: React + Vite + TypeScript.
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

Run `prompts/00_REPOSITORY_BOOTSTRAP.md` in Codex.
