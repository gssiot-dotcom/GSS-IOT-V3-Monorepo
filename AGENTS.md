# GSS IoT V3 — Repository Instructions for Codex

## 1. Mandatory context loading

Before planning or editing code, read these files in order:

1. `docs/architecture/gss_iot_rbac_architecture_blueprint.md`
2. `docs/design/DESIGN_SYSTEM.md`
3. `docs/design/UI_UX_SPEC.md`
4. `docs/design/PAGE_INVENTORY.md`
5. `docs/migration/LEGACY_REFACTORING_STRATEGY.md`
6. `docs/planning/PROJECT_STATE.md`
7. `docs/planning/TODO.md`
8. `docs/planning/DECISION_LOG.md`

For any alarm work, also read `docs/quality/ALARM_OCCURRENCE_TEST_CASES.md`.
For any authorization work, also read `docs/quality/RBAC_SECURITY_CHECKLIST.md`.

## 2. Source-of-truth rules

- The architecture blueprint is authoritative.
- The old GSS ZIP is a behavior and asset reference only. Do not copy its Express/Mongoose structure into production code.
- Parfumbox is the reference for RBAC implementation patterns and admin component style, not for GSS business entities.
- When documents conflict, stop and record the conflict in `docs/planning/DECISION_LOG.md` before coding.
- Never silently invent business rules. Mark unresolved items as `OPEN_DECISION`.

## 3. Target stack and repository shape

Use a pnpm monorepo:

```txt
apps/api       NestJS + TypeScript + Prisma + PostgreSQL
apps/web       React + Vite + TypeScript; `/admin/*` and `/company/*`
packages/ui    shared Mantine-based UI components and GSS design tokens
packages/contracts shared DTO/event/schema contracts
packages/config shared TypeScript, ESLint and environment validation
```

Use Redis/BullMQ only for provider retry, report jobs, command retry and heavy fan-out. Alarm occurrence counting must use PostgreSQL transaction state as the source of truth.

## 4. Architecture invariants

- GSS Admin RBAC and Company/User RBAC are separate authorization contexts.
- Effective permissions = role permissions + direct allow - direct deny.
- `role.isSuperAdmin === true` bypasses explicit permission rows.
- Company endpoints require both permission and company/construction-site/building scope.
- Backend guards are the security boundary. Frontend checks are UX only.
- Platform role, company position/lavozim and resource scope are separate concepts.
- Company users cannot create global permissions.
- Device ownership/assignment, gateway-building assignment, node-gateway assignment and MQTT commands require auditable history.
- Offline gateway commands use a durable outbox with `pending|sent|acknowledged|failed|expired|cancelled`.
- All critical changes create audit logs.

## 5. Alarm invariants

- Severity values are `safe`, `caution`, `warning`, `danger`, `offline`.
- A reading belongs to only one highest matching severity.
- `회수` means `requiredOccurrenceCount`, not send count.
- `지속시간` means `countIntervalSeconds`, the minimum time between counted readings, not notification delay.
- Every unique reading is stored in `sensor_readings`; only eligible readings increment `alarm_counter_states`.
- `alarm_counter_states` has one row per `nodeId + recipientPolicyId` and is updated, not appended per reading.
- Duplicate MQTT delivery must not increment counters twice.
- Safe or severity transition resets the relevant counter cycle according to the blueprint.
- Position + scope resolves recipients; RBAC permissions control UI/API actions.

## 6. UI and design invariants

- Use Mantine components and Tabler icons following Parfumbox admin patterns.
- Do not mix Mantine and shadcn as two competing component systems.
- Use GSS colors from `docs/design/DESIGN_SYSTEM.md`, not Parfumbox green.
- Preserve the three legacy node-type images in `assets/legacy-node-types/`.
- Preserve the legacy node-type selection card’s image-first structure and interaction behavior, while implementing it with the new design tokens.
- All routes, sidebar items and action buttons must map to permissions.
- All company pages must apply backend scope filtering.
- Every screen must define loading, empty, error, forbidden and inactive-session states.
- UI strings must use i18n keys; do not hardcode Korean or English text inside components.

## 7. Coding rules

- Prefer small domain services over large mixed services.
- Controllers must not contain business logic.
- Validate environment variables at startup.
- Validate all API inputs with DTO/schema validation.
- Use transactions for assignment changes, safe-admin checks and alarm counter updates.
- Use idempotency keys or unique constraints for MQTT messages, commands and notification creation.
- Never expose password hashes, secrets, provider payload secrets or unrestricted raw MQTT data through APIs.
- Avoid `any`; document justified exceptions.
- Use UTC in the database. Convert only at presentation boundaries.
- Use soft delete only for entities approved in the blueprint/decision log.

## 8. Work procedure

For every task:

1. Inspect relevant docs and current code.
2. Write a concise plan and list files to change.
3. Implement the smallest coherent vertical slice.
4. Add or update tests in the same task.
5. Run format, lint, typecheck, unit and relevant integration tests.
6. Update `PROJECT_STATE.md`, `TODO.md` and `DECISION_LOG.md` when behavior or architecture changes.
7. Report commands run, results, remaining risks and next recommended task.

Do not mark a phase complete when tests are skipped or failing.
Do not start broad refactoring during a feature task unless explicitly listed in the plan.

## 9. Required commands after scaffold exists

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter api test:e2e
```

Use the actual scripts available in `package.json`; if a command does not exist, add it during bootstrap and document it.

## 10. Git and change discipline

- Keep commits phase- or feature-scoped.
- Do not combine schema migration, unrelated UI redesign and business logic changes in one commit.
- Never rewrite or delete migration history after it has been applied outside local disposable environments.
- Include migration, seed and rollback notes in the task summary.
- Preserve legacy source archives unchanged under `reference/source-materials/`.
