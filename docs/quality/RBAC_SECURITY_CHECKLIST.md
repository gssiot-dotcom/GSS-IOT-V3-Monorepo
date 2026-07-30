# RBAC and Scope Security Checklist

## Authentication

- [ ] GSS and Company token contexts cannot be exchanged.
- [ ] Inactive user is blocked on login and every authenticated request.
- [ ] Password hashes and refresh/session secrets are never returned.
- [ ] Logout/session revocation behavior is tested.

## Permission resolution

- [ ] Role permissions load correctly.
- [ ] Direct allow is merged.
- [ ] Direct deny takes precedence.
- [ ] Super admin bypass uses `isSuperAdmin`, not a hardcoded email/key.
- [ ] No-permission role gets only public/authenticated base endpoints.

## Scope

- [ ] Company ID is derived/validated server-side.
- [ ] Site endpoints validate site belongs to the user’s company.
- [ ] Building endpoints validate building + parent site.
- [ ] List queries are scope-filtered, not only detail endpoints.
- [ ] WebSocket room join repeats permission + scope checks.
- [ ] Export/report queries apply the same scope rules.
- [ ] Alarm recipient resolution intersects position assignment with event scope.

## Role/permission administration

- [ ] Company users cannot create global permission keys.
- [ ] System roles cannot be deleted through normal API.
- [ ] Last active GSS super admin cannot be deleted, deactivated or demoted.
- [ ] Last company platform manager cannot self-lockout.
- [ ] Role/permission updates use transaction and audit log.

## Frontend

- [ ] Every sidebar item has view permission.
- [ ] Every protected route has route guard.
- [ ] Every create/update/delete/assign/export/ack/resolve action has permission guard.
- [ ] Hidden UI is not treated as backend security.
- [ ] Notification widgets do not call APIs without permission.

## Tests

- [ ] 401 inactive/invalid auth.
- [ ] 403 missing permission.
- [ ] 403 missing scope.
- [ ] Cross-company IDOR tests.
- [ ] Cross-building WebSocket tests.
- [ ] Direct endpoint call despite hidden button.

## Phase 10 automated coverage note

As of 2026-07-19, Phase 10 adds API E2E coverage for custom company role create/update, GSS-only permission rejection, cross-company role mutation denial, direct-deny effective permission preview, site-inherited building preview, inactive-position assignment rejection, no-permission protected API denial and inactive existing-token rejection. Web unit coverage verifies Company Portal role permission editing, no-permission sidebar filtering and building-plan metadata mutation.

The checklist remains partially open because report/export scope enforcement, alarm recipient resolution and later provider-specific flows are scheduled for later phases.

## 2026-07-27 lifecycle/deletion correction checks

- [x] Status operations use update/manage permissions; delete permissions are reserved for actual
      hard delete or documented evidence archive.
- [x] Delete capability metadata is UX only and blockers are repeated transactionally.
- [x] Company User deactivation/reactivation increments `tokenVersion`; safe-admin/manager checks
      remain in the backend transaction.
- [x] Company/Area/Building/User operations derive ownership and scope server-side.
- [x] Notification archive is recipient-or-scoped-manager; deleted rows leave normal lists/unread.
- [x] Gateway/Node unassignment uses assignment permissions, preserves history and audits endings.
- [x] Direct collection inputs reject page sizes outside 50/100.
- [x] Permission checkbox catalogs remain distinct from paginated permission list endpoints.

## 2026-07-27 retirement and Position dependency checks

- [x] Gateway/Node delete permission never substitutes for assignment or command permission; active
      dependency checks run inside the delete transaction under the same inventory-row lock used by
      new assignments/provisioning/commands.
- [x] Retired Gateway/Node records are excluded from active inventory/options and rejected by normal
      update, assignment, provisioning and command paths.
- [x] Company Position capability counts active assignments and active policies separately from
      ended/audited history; delete repeats dependency checks in the transaction.
- [x] Company Position archive records actor/time, does not cascade changes, and archived Positions
      are rejected by assignment and policy target validation.
- [x] Company user assignment removal remains available through Company scope and the corresponding
      GSS Admin company-scoped operation; direct-deny and cross-company guards are unchanged.
- [x] Recipient-policy PATCH remains separated by `/admin` and `/company` authorization contexts,
      validates target ownership/scope and audits old/new values.
- [x] Recipient resolution requires an active non-archived Position, active assignment, active
      Company user and matching Company/Area/Building scope. Inactive/archived Position regression
      coverage proves that an old active assignment cannot receive a new notification.
- [x] Frontend dependency summaries, hidden actions and capability modes are UX hints only; direct
      endpoint permission, scope and transaction checks remain authoritative.

## 2026-07-28 alarm archive and bulk selection checks

- [x] Rule and Policy archive stays separated by Admin/Company auth context and requires
      `alarm-rules.manage`; each target is company/scope validated server-side.
- [x] Bulk Alarm Event archive requires `alarms.manage`, rejects cross-scope/missing IDs atomically
      and permits only resolved events.
- [x] Bulk Notification archive permits the recipient or the existing scoped manager path; selected
      IDs cannot widen company or resource scope.
- [x] Selection checkboxes and hidden/disabled actions are UX only; direct endpoint calls repeat
      permission, actor ownership and scope checks and create aggregate audit evidence.

## 2026-07-28 GSS Administrator and private monitoring image checks

- [x] `/admin/gss-users` uses only the existing `admin-users.view/create/update/delete` permission
      family; Company tokens and no-permission GSS tokens receive 403 on direct calls.
- [x] Administrator DTOs/responses/audits exclude password hashes, token versions and secrets;
      passwords use the existing bcrypt flow and critical lifecycle mutations are audited.
- [x] Deactivate, Super Admin demotion and delete serialize and recheck the last-active-Super-Admin
      invariant inside the backend transaction.
- [x] Administrator collection search and 50/100 pagination are backend bounded; sidebar/controls
      remain UX hints and route/backend guards are authoritative.
- [x] Realtime PLAN/REAL tabs do not request private metadata or content without
      `building-plans.view`; Company content continues to require company/building scope.

## Two-tier archive and purge

- [x] Company tokens are denied from `/admin/archive`; no Company navigation item exists.
- [x] Normal Company direct-ID access treats archived/ancestor-archived resources as not found.
- [x] Login/session/Socket.IO reject archived Company/User principals.
- [x] Alarm evaluation/dispatch, monitoring ingestion, reports, command/provisioning and uploads
      require active ancestors.
- [x] `archive.view`, `archive.purge` and `sensor-readings.purge` are GSS-only seed permissions.
- [x] Purge rechecks both `archive.purge` and canonical domain permission on the backend.
- [x] Active targets, stale preview hashes, confirmation mismatch and duplicate active jobs fail.
- [x] Global Gateway/Node records are never organization-cascade targets.
- [x] Archive export uses `archive.view + reports.export`, rejects Company users, rechecks job
      ownership/type permission and streams without exposing storage keys.
- [x] Conditional two-worker claim, lease renewal/loss, stale recovery, crash-after-root resume,
      exactly-one receipt, 100k retention and reconciliation are repository-tested.
- [ ] Approve and verify production S3 version/delete-marker cleanup, backup/legal hold, restore
      authorization and purge SLA before destructive production enablement.
