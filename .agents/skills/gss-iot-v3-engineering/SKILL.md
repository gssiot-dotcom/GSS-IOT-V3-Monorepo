---
name: gss-iot-v3-engineering
description: build, review, refactor, test, or document the gss iot v3 platform using its nestjs/prisma/react architecture, separate gss and company rbac, permission-plus-scope security, mqtt command outbox, realtime monitoring, position-based alarm recipients, and occurrence-count alarm rules. use for repository bootstrap, backend/frontend implementation, database migrations, ui design, code review, testing, reports, deployment, or legacy gss/parfumbox extraction. do not use for unrelated projects.
---

# GSS IoT V3 Engineering

## Start every task

1. Read the repository `AGENTS.md`.
2. Read the canonical architecture blueprint and current `PROJECT_STATE.md`.
3. Read only the references relevant to the task:
   - architecture/RBAC: `references/architecture-rules.md`
   - workflow and phase delivery: `references/delivery-workflow.md`
   - UI/design: `references/ui-design-rules.md`
   - alarm work: `references/alarm-occurrence-flow.md`
   - testing/review: `references/quality-gates.md`
4. Identify conflicts or missing business decisions before editing.
5. State the planned files, tests, and documentation updates.

## Non-negotiable architecture

- Treat the old GSS repository as behavior and asset reference only.
- Keep GSS Admin and Company/User authorization contexts separate.
- Enforce backend permission and scope; frontend guards are UX only.
- Keep platform role, company position, and resource scope separate.
- Use PostgreSQL/Prisma as durable state and history source.
- Use a durable GatewayCommand outbox for offline MQTT commands.
- Audit critical role, assignment, alarm, command, and export changes.
- Preserve the three legacy node images and node-type selection behavior.

## Implementation behavior

- Build one coherent vertical slice at a time.
- Keep controllers thin and domain logic in services.
- Add migrations, seeds, tests, and UI denial states in the same slice.
- Use transactions and idempotency for assignments, alarm counters, commands, and notifications.
- Do not invent permissions, MQTT payloads, provider behavior, or migration rules silently.
- Record accepted architecture decisions in the repository decision log.

## Alarm semantics

- Use `safe`, `caution`, `warning`, `danger`, and `offline`.
- `회수` is `requiredOccurrenceCount`, not notification send count.
- `지속시간` is `countIntervalSeconds`, the minimum interval between counted matching readings.
- Persist every unique reading; increment only eligible policy counters.
- Store one mutable counter-state row per node-policy.
- Resolve recipients using position/specific user intersected with event scope.
- Protect alarm UI actions with RBAC permissions.

## UI semantics

- Use Mantine and Tabler icons following Parfumbox admin component patterns.
- Use normalized GSS colors, not Parfumbox green.
- Do not introduce a second competing component system.
- Define loading, empty, error, forbidden, inactive-session, and reconnecting states.
- Map every route, sidebar item, and action to permissions.

## Finish every task

1. Run relevant format, lint, typecheck, unit, integration, E2E, and build commands.
2. Report exact command results and any skipped checks.
3. Update `PROJECT_STATE.md`, `TODO.md`, and `DECISION_LOG.md` when applicable.
4. List changed files, migrations/seeds, security impact, risks, and next task.
5. Do not mark work complete while required tests fail.
