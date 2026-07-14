# Definition of Done

A feature is done only when:

- architecture and permission/scope mapping are documented;
- API DTO validation and error behavior exist;
- backend permission and scope guards exist;
- UI route/sidebar/action checks exist;
- unit/integration tests cover success and denial paths;
- loading/empty/error/forbidden UI states exist;
- audit behavior exists for critical changes;
- migrations and seeds are included where required;
- lint, typecheck, tests and build pass;
- `PROJECT_STATE.md` and `TODO.md` are updated;
- no unresolved high-risk issue is hidden.

For alarm work, all relevant cases in `ALARM_OCCURRENCE_TEST_CASES.md` must pass.
