# Quality Gates

## Required checks

- format/lint;
- TypeScript strict typecheck;
- unit tests;
- repository/integration tests;
- API E2E for protected flows;
- browser E2E for route/action denial and core workflow;
- build.

## Security cases

- inactive user 401;
- missing permission 403;
- missing company/site/building scope 403;
- cross-company IDOR blocked;
- unauthorized Socket.IO room join blocked;
- last super admin/platform manager self-lockout blocked;
- company cannot create global permission.

## Alarm cases

- exact interval boundary;
- reading before interval does not count;
- safe reset;
- severity transition reset;
- parallel policies independent;
- duplicate MQTT message idempotent;
- concurrent eligible messages deterministic;
- inactive/scope-mismatched recipient excluded;
- restart preserves counter state.
