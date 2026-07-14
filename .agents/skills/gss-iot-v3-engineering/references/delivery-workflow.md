# Delivery Workflow

## Phase order

1. Repository bootstrap and discovery freeze.
2. Database/auth/RBAC foundation.
3. Design system and shells.
4. Organization/users/roles/scopes/positions.
5. Device inventory and assignment history.
6. MQTT outbox and typed adapters.
7. Monitoring and realtime.
8. Alarm occurrence-count subsystem.
9. Alarm operations, reports, and audit.
10. Migration, security, performance, and deployment.

## Per-task workflow

1. Inspect docs and current code.
2. Write a file-level plan.
3. Implement a minimal coherent slice.
4. Add success and denial-path tests.
5. Run quality commands.
6. Update state/TODO/decision docs.
7. Return a handoff with risks and next task.

## Refactoring boundary

Extract legacy behavior, contracts, assets, and terminology. Do not copy old mixed Express/Mongoose module structure, hardcoded roles, inline assignments, or unprotected routes.
