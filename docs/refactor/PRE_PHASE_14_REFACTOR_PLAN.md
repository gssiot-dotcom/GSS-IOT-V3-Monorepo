# Pre-Phase-14 refactor execution plan

## Starting status and protected scope

This refactor wave starts from:

```txt
PHASE_13_COMPLETE
PHASE_14_NOT_STARTED
```

Phase 13 report/export behavior, the unsafe-resolve UI maintenance fix, dashboard recent-report integration, private local storage verification, and the existing automated/browser evidence remain complete. The work in `docs/prompts/3rd-step/` is a pre-Phase-14 product refactor and UX completion wave. It must not implement production S3 execution, standalone production worker deployment, deployment manifests, rollback infrastructure, long-term sensor retention/partitioning/archival/purge, migration, or CI/CD hardening.

The following completed behavior is protected throughout the wave:

- Separate GSS Admin and Company authentication/authorization contexts.
- Backend permission plus company/construction-area/building scope enforcement, including super-admin bypass and inactive-user rejection.
- Auditable device assignments and GatewayCommand outbox lifecycle.
- `GatewayCommand.id` as MQTT `requestId`, strict correlation, fast-ACK safety, retry reuse, and exactly-once ACK side effects.
- Phase 9 authoritative alarm classification and desired/applied hardware configuration state.
- Phase 11 occurrence counting, counter reset semantics, shared alarm episodes, and trigger idempotency.
- Phase 12 recipient resolution, notification dispatch, acknowledgement/resolve behavior, and notification realtime authorization.
- Phase 13 scoped report generators, lifecycle/claim behavior, export permissions, private downloads, expiration cleanup, and download audits.

## Confirmed preflight audit

The source-map gaps were rechecked against the current repository on 2026-07-22:

| Source-map gap                 | Current evidence                                                                                                                                                            | Baseline conclusion                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Welcome pages                  | `apps/web/src/app/router.tsx` routes unmatched portal nav entries to `PlaceholderPage`; no dedicated Admin/Company Welcome page is selected.                                | Still open.                                                    |
| Dashboard analytics            | `apps/web/src/features/dashboard/DashboardPages.tsx` renders the recent report-jobs card for both portals and no GSS KPI/overview chart data.                               | Still open; existing report card is retained.                  |
| Header realtime status         | `apps/web/src/features/shell/PortalLayout.tsx` always renders the yellow `shell.reconnecting` badge. Monitoring socket status is tracked separately in the monitoring page. | Still open.                                                    |
| Account dropdown/profile       | `PortalLayout.tsx` renders an avatar/name and separate sign-out button; no account menu/profile route is wired.                                                             | Still open.                                                    |
| Empty portal modules           | `router.tsx` falls back to `PlaceholderPage` for Admin Monitoring, Admin Roles, Admin System Settings, and Company Settings.                                                | Still open.                                                    |
| Device edit/delete UX          | Device controllers expose assignment-history deletes, but no pristine gateway/node hard-delete endpoints or lifecycle delete actions.                                       | Still open; history must remain protected.                     |
| Bulk node creation             | `AdminDevicesPage.tsx` posts one `{ nodeTypeId, number }` value per request.                                                                                                | Still open.                                                    |
| APPEND/REPLACE provisioning    | `GatewayCommand` provisioning currently has no explicit mode; `gateway-commands.service.ts` rejects nodes with an active gateway assignment.                                | Still open; cmd 2 payload/requestId/ACK behavior is protected. |
| Monitoring cards/detail charts | Company node-type monitoring uses `DataTable` for latest states and history; no V2-inspired node cards, T-shaped LED detail, or historical chart modal is wired.            | Still open.                                                    |
| Global UI polish               | Shared Mantine/GSS primitives exist, but the gaps above and responsive/action-state consistency remain.                                                                     | Still open and staged for Tasks 03 and 12.                     |

The approved ten requirements remain applicable. Phase 13 added report/dashboard-status behavior but did not close the product requirements in the source map; existing completed behavior is treated as an implementation constraint rather than reimplemented.

## Task order

Tasks execute exactly in this order. `EXECUTION_STATE.md` is the resumable source of truth.

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

## Architecture and source-reference guardrails

- The architecture blueprint is authoritative; unresolved business behavior is recorded as `OPEN_DECISION` rather than invented.
- Legacy archives are read-only behavior, asset, terminology, and interaction references. They are extracted only to temporary untracked locations when needed; their Express/Mongoose structure, hardcoded roles, insecure route behavior, and branding are not copied.
- New UI uses Mantine, Tabler icons, normalized GSS colors, and i18n keys. No second competing component system or hardcoded user-facing strings is introduced.
- Backend guards remain the security boundary. Frontend route/sidebar/action checks are UX and must mirror the existing permission catalog.
- Company data remains server-side scope filtered. Socket.IO room joins continue to enforce authentication, permission, active-user status, and scope.
- Device assignment history, command outbox records, alarm state, notification state, report state, and audit logs remain durable and auditable.
- Existing migrations are immutable. Any future durable requirement uses an additive forward migration with migration/seed/rollback notes; no destructive reset or history rewrite is allowed.

## Likely schema changes

Task 02 adds no schema or seed change. The current expectation is that most tasks are API/UI-only:

- Tasks 03–08, 10–13 should reuse existing settings, inventory, monitoring, report, audit, and history models unless inspection proves durable state is necessary.
- Task 09 may require one additive provisioning-request representation for explicit `APPEND` versus `REPLACE` mode and the requested final node set if the existing `NodeGatewayProvisioningRequest` cannot persist that distinction. The existing `GatewayCommand`, `requestId`, payload adapter, response correlation, ACK transaction, and assignment history remain unchanged. The exact migration is not approved until the current schema and protocol code are inspected in Task 09.
- No task may add retention/partitioning/archival/purge or production deployment schema as part of this wave. Those remain Phase 14 deferrals.

## Risk areas and test strategy

| Task | Primary risk                                               | Required verification focus                                                                                                                |
| ---- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 02   | Incorrect baseline or accidental phase drift               | Archive/file evidence, plan/checklist, format and diff checks.                                                                             |
| 03   | Shell/theme changes breaking route guards or accessibility | UI unit tests, route/permission tests, responsive browser smoke, full quality gates.                                                       |
| 04   | Session/profile/realtime regressions                       | Auth-context tests, inactive-session/permission tests, actual socket-state browser checks, notification permission denial.                 |
| 05   | Fake dashboard metrics or scope leakage                    | API-backed aggregate tests, bounded queries, Admin/Company scope tests, dashboard browser checks.                                          |
| 06   | Role/settings changes weakening RBAC or safe-admin rules   | Existing RBAC E2E plus direct-deny/super-admin/inactive/last-admin tests and settings UI denial states.                                    |
| 07   | Destructive device deletion or broken assignment history   | Pristine-only delete tests, referenced/history conflict tests, lifecycle fallback, audit assertions, MQTT/alarm regression suite.          |
| 08   | Invalid or duplicate bulk node inventory                   | Parser unit tests, preview/validation tests, duplicate/conflict API tests, existing node inventory E2E.                                    |
| 09   | Wrong complete-list semantics or false physical assignment | APPEND/REPLACE payload tests, requestId/ACK/late/duplicate tests, transactional assignment assertions, live protocol evidence if required. |
| 10   | Monitoring status/detail misclassification or scope leak   | Door/angle/gangform rendering tests, chart/detail tests, fault-filter action absence, realtime/history/scope E2E.                          |
| 11   | Admin monitoring bypass or overly broad queries            | Admin permission tests, sanitized aggregate queries, cross-company denial, browser acceptance of loading/empty/error/forbidden states.     |
| 12   | Inconsistent UI states or responsive regressions           | Shared component/unit tests, keyboard/accessibility checks, mobile/tablet/desktop browser screenshots and behavior checks.                 |
| 13   | Regression hidden by partial checks                        | Full required commands, manual acceptance matrix, diff audit, explicit remaining-risk and Phase 14 handoff.                                |

Across every task, rerun focused checks first and preserve the auth/RBAC, assignment, MQTT, alarm, notification, report, and audit suites relevant to the changed surface.

## Manual browser acceptance strategy

Use the existing seeded local environment and protected browser flows. For each task, capture route/context, authenticated principal, permission set, scope, viewport, action, expected result, actual result, screenshot or trace path, and API/DB evidence where the behavior is security- or persistence-sensitive. Cover both Admin and Company portals, desktop and narrow responsive layouts, loading/empty/error/forbidden/inactive-session states, and real notification/monitoring connection transitions. Do not claim hardware or production-provider behavior without explicit evidence.

The final task must consolidate the per-task evidence, rerun the complete automated gate, verify no Phase 14 files/configuration were added, and leave the repository in:

```txt
PHASE_13_COMPLETE
PHASE_14_NOT_STARTED
PRE_PHASE_14_REFACTOR_COMPLETE
```

## Explicit Phase 14 deferrals

The following remain out of scope and must stay explicitly deferred: production S3 execution, standalone production report worker deployment, production deployment manifests, rollback/release infrastructure, long-term sensor retention/partitioning/archival/purge, legacy production data migration, and production CI/CD hardening.

## Final handoff — 2026-07-22

Tasks 02–13 are complete. The final automated gate passed `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter api test:e2e` (7 files, 64 tests), `pnpm --filter web test:e2e` (4 tests), `pnpm build`, repository-wide Prettier check and `git diff --check`. Focused UI/API regression evidence covers auth/session/inactive/no-permission, RBAC and safe-admin policy, device history and lifecycle, MQTT requestId/ACK and provisioning, alarm classification/occurrence/notification operations, monitoring and reports.

Browser evidence is intentionally bounded: Playwright and the in-app browser verified the login shell, protected Admin monitoring redirect without a placeholder, meaningful legacy node-image alt text, desktop rendering and a 390x844 mobile viewport without document overflow. Authenticated all-route visual walkthrough remains a user-review follow-up because no deterministic browser session fixture was available. Live ESP32 cmd 4/cmd 5 verification remains pending and is not inferred from automated tests or prior cmd 2 evidence.

The final repository state is `PHASE_13_COMPLETE`, `PHASE_14_NOT_STARTED`, `PRE_PHASE_14_REFACTOR_COMPLETE`. No Phase 14 files, production provider execution, deployment/rollback infrastructure, retention/archival work or legacy production migration were added.
