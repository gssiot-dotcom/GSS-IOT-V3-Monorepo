# CODEX TASK 02 — Preflight audit and refactor guardrails

Read `AGENTS.md`, the master prompt, source map, current project state and every mandatory architecture/design document before starting.

## Goal

Create a grounded execution baseline for the pre-Phase-14 refactor without changing product behavior yet.

## Scope

1. Confirm from repository docs and code that:
   - Phase 13 is complete;
   - Phase 14 is not started;
   - the ten approved requirements in the source map are still applicable;
   - the named current gaps still exist or document precisely how they changed.
2. Extract both legacy source archives to a temporary untracked location and verify the referenced files exist.
3. Run the current focused baseline checks that are practical in the environment.
4. Create:

```txt
docs/refactor/PRE_PHASE_14_REFACTOR_PLAN.md
docs/quality/PRE_PHASE_14_REFACTOR_ACCEPTANCE_CHECKLIST.md
```

5. Record the refactor wave in planning docs without changing Phase 13 or Phase 14 status.

## Required plan contents

`PRE_PHASE_14_REFACTOR_PLAN.md` must include:

- starting status and protected completed phases;
- task order from this folder;
- architecture invariants;
- source-reference rules;
- likely schema migrations and why they are additive;
- regression risk areas: auth/RBAC, assignment history, MQTT ACK, alarms, reports;
- test strategy per task;
- manual browser acceptance strategy;
- explicit Phase 14 deferrals.

The acceptance checklist must map all ten user requirements to concrete observable checks and evidence fields.

## Do not

- Do not implement UI or API features in this task.
- Do not change Prisma schema.
- Do not start Phase 14.
- Do not mark unexecuted tests as passed.
- Do not edit legacy archives.

## Verification

Run at least:

```bash
pnpm format:check
git diff --check
```

Run additional existing tests only if dependencies/environment are available. Record exact results honestly.

## Definition of Done

- Current gaps are confirmed from code, not assumed.
- Both reference archives and named files are verified.
- Plan and acceptance checklist exist.
- `PROJECT_STATE.md`, `TODO.md`, `IMPLEMENTATION_PLAN.md` and `DECISION_LOG.md` accurately show a pre-Phase-14 refactor wave while preserving `PHASE_13_COMPLETE` and `PHASE_14_NOT_STARTED`.
- `EXECUTION_STATE.md` marks this task complete with evidence.
