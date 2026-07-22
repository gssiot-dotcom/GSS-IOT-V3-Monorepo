# CODEX TASK 13 — Final regression, manual acceptance and pre-Phase-14 handoff

Complete Tasks 02–12 first. Do not implement new product features in this task.

## Goal

Prove that the ten approved requirements are complete, completed phases did not regress, and the repository is ready for user review before any Phase 14 work.

## 1. Audit task state

Verify every prior task in `EXECUTION_STATE.md` is complete with evidence. Re-open any task whose Definition of Done is not actually satisfied.

## 2. Automated verification

Run the actual available equivalents of:

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

Also run focused regression suites for:

- auth/session/inactive user/no-permission;
- RBAC and safe-admin policies;
- device CRUD/assignment history;
- Phase 8 requestId and provisioning ACK behavior;
- Phase 9 alarm levels/fault filters/classification;
- Phase 11 occurrence-count engine;
- Phase 12 notifications/alarm operations;
- Phase 13 reports/exports.

Do not hide failures behind unrelated skips.

## 3. Manual acceptance checklist

Complete `docs/quality/PRE_PHASE_14_REFACTOR_ACCEPTANCE_CHECKLIST.md` with honest evidence.

At minimum verify in browser:

1. Admin and Company Welcome pages show profile and permission-filtered quick links.
2. Admin and Company dashboards show real KPIs/charts and recent reports.
3. Header never shows false permanent reconnecting; real reconnect/offline states work.
4. Account dropdown, profile links and sign out work in both portals.
5. Admin Monitoring, Admin Roles, Admin Settings and Company Settings are meaningful.
6. Pristine device delete succeeds; historical device delete is blocked.
7. Bulk node parser/preview/create works.
8. APPEND and REPLACE previews/lifecycles are correct; do not claim hardware verification unless hardware was used.
9. Monitoring table/card toggle, door/T-shape cards and detail charts work; detail has no fault-filter button.
10. Desktop/mobile UI is coherent and accessible.

Also verify no-permission, inactive-user and cross-company/scope behavior.

## 4. Documentation closeout

Update:

```txt
docs/planning/PROJECT_STATE.md
docs/planning/TODO.md
docs/planning/IMPLEMENTATION_PLAN.md
docs/planning/DECISION_LOG.md
docs/refactor/PRE_PHASE_14_REFACTOR_PLAN.md
docs/quality/PRE_PHASE_14_REFACTOR_ACCEPTANCE_CHECKLIST.md
relevant architecture/design docs
```

The final state must clearly say:

```txt
PHASE_13_COMPLETE
PHASE_14_NOT_STARTED
PRE_PHASE_14_REFACTOR_COMPLETE
```

Preserve any still-pending live hardware status honestly. In particular, do not convert unexecuted ESP32 tests into passed evidence.

## 5. Explicit Phase 14 deferrals

Keep these deferred:

- production S3 configuration/execution;
- standalone production worker deployment;
- deployment manifests and rollback procedures;
- long-term sensor retention/partitioning/archival/purge;
- legacy production migration;
- production CI/CD and release hardening.

## Final report format

Report:

- exact files changed across the refactor wave;
- migrations and rollback notes;
- tests/commands and results;
- manual acceptance evidence;
- unresolved risks;
- live hardware checks still pending;
- confirmation Phase 14 was not started.

## Definition of Done

- All ten user requirements are implemented and verified.
- Full automated regression is green.
- Manual acceptance is recorded.
- Documentation is truthful and consistent.
- Phase 14 remains not started.
