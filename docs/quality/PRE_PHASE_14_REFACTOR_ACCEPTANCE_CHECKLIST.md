# Pre-Phase-14 refactor acceptance checklist

Starting status: `PHASE_13_COMPLETE` / `PHASE_14_NOT_STARTED`

Use one evidence row per check. Do not mark a check passed without the command, test, screenshot/trace, API response, or database observation that proves it.

| Requirement                     | Concrete observable checks                                                                                                                                                                                                                          | Automated evidence                                                                          | Manual evidence                                                                                                                     | Status / notes                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1. Welcome pages                | `/admin/welcome` and `/company/welcome` render session-aware profile/context, useful quick links, permission-filtered actions, loading/empty/error/forbidden/inactive states, and responsive layouts.                                               | `welcome-profile.spec.tsx`, `auth-routing.spec.tsx`, full web unit suite (58).              | Protected browser visual review not available without a deterministic authenticated session fixture.                                | AUTOMATED PASS; MANUAL DEFERRED         |
| 2. Dashboards                   | Admin dashboard shows real GSS operational KPIs/overview/charts from bounded APIs; Company dashboard shows only authenticated company/scope data; no fabricated values.                                                                             | `dashboard.spec.tsx`, dashboard/RBAC API E2E and full API E2E (64).                         | Protected browser visual review not available without a deterministic authenticated session fixture.                                | AUTOMATED PASS; MANUAL DEFERRED         |
| 3. Header realtime badge        | Header does not claim reconnecting before a connection attempt; connected/offline/reconnecting states reflect actual authorized realtime lifecycle and preserve last-known data.                                                                    | Welcome/profile notification tests, realtime component tests and full API/web suites.       | Public login shell verified; authorized socket lifecycle visual trace not available in this browser session.                        | AUTOMATED PASS; MANUAL PARTIAL          |
| 4. Account dropdown             | Bell-adjacent account control opens a keyboard-accessible dropdown with user details, portal/company/scope context, profile link, and sign-out; inactive sessions clear safely.                                                                     | `welcome-profile.spec.tsx`, `auth-routing.spec.tsx`, RBAC API E2E and full API E2E (64).    | Login controls and protected redirect verified; authenticated menu/sign-out visual review deferred.                                 | AUTOMATED PASS; MANUAL PARTIAL          |
| 5. Empty portal modules         | Admin Monitoring, Admin Roles, Admin System Settings, and Company Settings provide meaningful approved data/configuration flows, guarded routes/actions, and universal states without fake or unsafe controls.                                      | `monitoring.spec.tsx`, `settings.spec.tsx`, monitoring/RBAC E2E and full API E2E (64).      | Protected route visual review deferred; unauthenticated Admin monitoring correctly redirected without placeholder.                  | AUTOMATED PASS; MANUAL PARTIAL          |
| 6. Device edit/delete actions   | Gateway/node edit works; hard delete succeeds only for pristine never-assigned/unreferenced inventory; history/references reject hard delete and expose safe lifecycle action; compact actions have labels/tooltips.                                | `devices.e2e-spec.ts`, gateway/device E2E and full API E2E (64).                            | Device mutation browser walkthrough not repeated in this final unauthenticated session.                                             | AUTOMATED PASS; MANUAL DEFERRED         |
| 7. Bulk node creation           | Preview accepts single values, inclusive ranges, comma-separated lists and combinations; normalizes safely, rejects malformed/duplicate/conflicting values, and submits an auditable batch without partial unsafe writes.                           | Contracts parser tests (5), device E2E, web device tests and full API E2E (64).             | Input/preview browser walkthrough not repeated in this final unauthenticated session.                                               | AUTOMATED PASS; MANUAL DEFERRED         |
| 8. APPEND/REPLACE provisioning  | UI/API requires explicit mode; REPLACE sends exactly selected final nodes; APPEND unions active gateway/node-type nodes with new selection; successful strict ACK alone changes assignments; requestId/retry/late/duplicate behavior remains exact. | Gateway command unit/E2E, provisioning device E2E and full API E2E (64); no hardware claim. | No hardware or authenticated command walkthrough claimed; hardware verification remains pending.                                    | AUTOMATED PASS; HARDWARE/MANUAL PENDING |
| 9. Monitoring table/card/detail | Company monitoring supports table and V2-inspired cards; door shows open/closed and battery; angle/gangform use T-shaped LED/status visualization; node click opens historical graphics; detail contains no fault-filter action.                    | `monitoring.spec.tsx`, monitoring E2E, alarm E2E and full API E2E (64).                     | Public legacy image-first cards and mobile no-overflow verified; protected monitoring detail visual review deferred.                | AUTOMATED PASS; MANUAL PARTIAL          |
| 10. Modern UI/UX                | Admin/Company screens consistently use Mantine, Tabler, GSS tokens, i18n, accessible status cues, responsive layouts, and explicit loading/empty/error/forbidden/session/realtime states without changing business/security behavior.               | UI 8, web 58, full API 64, browser smoke 4, typecheck/lint/build/format/diff all pass.      | Login/protected redirect, alt text, public desktop/mobile layout and no overflow verified; authenticated all-route review deferred. | AUTOMATED PASS; MANUAL PARTIAL          |

## Cross-cutting regression evidence

### 2026-07-22 final evidence record

```txt
Task/requirement: Task 13 final regression and pre-Phase-14 handoff
Date/time: 2026-07-22 Asia/Seoul
Principal and auth context: unauthenticated browser smoke; protected behavior from seeded API E2E principals
Permission set: API E2E fixtures cover super-admin, direct deny, no-permission, inactive and scoped principals
Company/site/building scope: API E2E fixtures cover same-company, sibling-building and cross-company denial
Viewport/browser: Playwright desktop plus in-app browser desktop and 390x844 mobile viewport
Command/test/API/DB evidence: full API E2E 7 files / 64 tests; full web unit 13 files / 58 tests; full web E2E 4 tests; UI 3 files / 8 tests; root typecheck, lint, build, Prettier check and git diff --check passed; isolated E2E schema reported no pending migrations
Screenshot or trace: Playwright legacy node card screenshot assertion; in-app browser DOM observations for login, protected redirect, meaningful alt text and mobile no-overflow
Expected: completed Tasks 02-12 regress without Phase 14 work
Actual: all automated gates passed; public/unauthenticated browser checks passed; authenticated protected visual walkthrough remains explicitly deferred because no deterministic browser session fixture was available
Result: PASS with documented manual/deferred evidence
Risk/follow-up: user review should repeat authenticated Admin/Company walkthrough; live ESP32 cmd 4/cmd 5 hardware verification remains pending
```

- Auth/RBAC: separate token audiences, inactive-user rejection, direct deny, super-admin bypass, no-permission, cross-company/building scope, and hidden-button direct API denial.
- Assignment history: one active gateway-building/node-gateway invariant, move/unassign history, audit rows, and no unsafe deletion.
- MQTT: `GatewayCommand` persistence before publish, `requestId` stamping/reuse, strict matching, fast ACK, duplicate/late ACK idempotency, and no credential leakage.
- Alarms/notifications: authoritative classification, occurrence interval/count, safe/severity/fault-filter resets, shared event/trigger behavior, recipient scope, acknowledge/resolve, and notification room authorization.
- Reports: Admin/Company endpoint separation, view/export split, bounded scoped data, private backend downloads, expiry/cleanup, and download audit.
- Phase status: no Phase 14 implementation, production execution, migration, deployment, or retention claim.

## Evidence record template

```txt
Task/requirement:
Date/time:
Principal and auth context:
Permission set:
Company/site/building scope:
Viewport/browser:
Command/test/API/DB evidence:
Screenshot or trace:
Expected:
Actual:
Result: PASS | FAIL | BLOCKED | NOT_RUN
Risk/follow-up:
```
