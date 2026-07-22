# CODEX MASTER PROMPT — Pre-Phase-14 product refactor execution

## How to use this folder

The user will point Codex at `docs/prompts/3rd-step/`. Do not ask the user to paste each task separately.

Read this file first, then execute the numbered task prompts in order. Work task-by-task, not as one uncontrolled repository-wide patch. After each task:

1. run that task's required checks;
2. update `docs/prompts/3rd-step/EXECUTION_STATE.md`;
3. update the required planning/architecture/quality docs;
4. continue automatically to the next `PENDING` task when there is no blocker.

If the session or context ends, the next Codex session must read `EXECUTION_STATE.md` and resume from the first non-complete task without requiring the user to identify it manually.

## Mandatory first reads

Read in this order before editing code:

1. `AGENTS.md`
2. `docs/prompts/3rd-step/01_SOURCE_MAP_AND_APPROVED_REQUIREMENTS.md`
3. `docs/prompts/3rd-step/EXECUTION_STATE.md`
4. the current task prompt
5. every document required by `AGENTS.md`
6. the task-specific architecture and test documents named in the current prompt

## Confirmed starting state

The expected starting state is:

```txt
PHASE_13_COMPLETE
PHASE_14_NOT_STARTED
```

This folder is a **pre-Phase-14 product refactor and UX completion wave**. It is not Phase 14.

Do not start or implement any Phase 14 item, including:

- production S3 execution;
- standalone production worker deployment;
- production deployment manifests;
- rollback or release infrastructure;
- long-term sensor retention, partitioning, archival or purge;
- legacy production data migration;
- production CI/CD hardening.

Keep all Phase 14 items explicitly deferred.

## Architecture invariants that must survive every task

- GSS Admin and Company authorization contexts remain separate.
- Backend guards remain the real security boundary.
- Company access remains permission plus company/site/building scope.
- `role.isSuperAdmin` bypass remains intact.
- Inactive users are rejected even with an existing token.
- Frontend route/sidebar/action checks are UX only and must match backend permissions.
- Device and command history remains auditable.
- MQTT commands continue through `GatewayCommand` outbox.
- `GatewayCommand.id` remains the MQTT `requestId`.
- Strict requestId correlation, fast-ACK safety and exactly-once ACK side effects must not regress.
- Alarm occurrence-count semantics and Phase 11/12 behavior must not regress.
- Phase 13 reports and exports must not regress.
- Source archives under `reference/source-materials/` are read-only references.
- Use Mantine and Tabler; do not introduce a second competing UI component system.
- Use GSS colors, not Parfumbox branding/colors.
- UI strings must use i18n keys.

## Execution order

Execute exactly in this order:

1. `02_PREFLIGHT_AUDIT_AND_REFACTOR_GUARDRAILS.md`
2. `03_DESIGN_SYSTEM_FOUNDATION_AND_APP_SHELL.md`
3. `04_WELCOME_PROFILE_HEADER_AND_REALTIME_STATUS.md`
4. `05_GSS_AND_COMPANY_DASHBOARD_ANALYTICS.md`
5. `06_ADMIN_ROLES_AND_PORTAL_SETTINGS.md`
6. `07_DEVICE_INVENTORY_EDIT_DELETE_AND_ACTION_UX.md`
7. `08_BULK_NODE_CREATION.md`
8. `09_NODE_ASSIGNMENT_APPEND_REPLACE_PROTOCOL.md`
9. `10_MONITORING_CARD_TABLE_AND_NODE_DETAIL_CHARTS.md`
10. `11_ADMIN_MONITORING_COMPLETION.md`
11. `12_GLOBAL_UI_UX_MODERNIZATION_AND_RESPONSIVE_POLISH.md`
12. `13_FINAL_REGRESSION_MANUAL_ACCEPTANCE_AND_HANDOFF.md`

Do not reorder tasks unless a concrete dependency conflict is found. If one is found, record it in `DECISION_LOG.md` and `EXECUTION_STATE.md` before changing the order.

## Task execution loop

For each task:

1. Confirm all previous tasks are `COMPLETE`.
2. Inspect current code and compare it with the source map. Do not rely only on the prompt's snapshot if code has changed.
3. Write a concise implementation plan and list likely files to change.
4. Implement only the current task's coherent vertical slice.
5. Add/update tests in the same task.
6. Run focused checks first, then the task's required broader checks.
7. Update docs and `EXECUTION_STATE.md` with:
   - status;
   - exact files changed;
   - migrations added, if any;
   - commands run and results;
   - manual acceptance still needed;
   - known risks or explicit deferrals.
8. Do not mark the task complete if required tests fail or are skipped without an approved reason.
9. Continue to the next task automatically when complete.

## Stop conditions

Stop and mark the current task `BLOCKED` only when:

- required source material is genuinely missing after checking the repository archives;
- current code contradicts an approved architecture invariant;
- a destructive schema/data decision is required but not approved;
- hardware protocol behavior cannot be determined from the approved requirement and Phase 8 docs;
- tests reveal a pre-existing critical regression that makes the current task unsafe.

When blocked, write one precise question and the exact evidence. Do not invent a business rule.

## Git discipline

- Keep each task's changes isolated.
- Do not rewrite existing migration history.
- Add only additive migrations when required.
- Do not create commits or tags automatically unless the user explicitly enables that workflow.
- Always run `git diff --check` for the current task.

## Minimum final verification

The final handoff task must run the actual available equivalents of:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter api test:e2e
pnpm --filter web test:e2e
pnpm build
git diff --check
```

The final status after this folder is complete must be documented as:

```txt
PHASE_13_COMPLETE
PHASE_14_NOT_STARTED
PRE_PHASE_14_REFACTOR_COMPLETE
```

Do not set `PHASE_14_COMPLETE` or start Phase 14.
