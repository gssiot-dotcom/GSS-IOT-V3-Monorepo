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
