# Admin roles and portal settings

Task 06 provides three authenticated, backend-guarded settings surfaces:

- `GET|POST /admin/roles`, `GET /admin/roles/permissions`, `PATCH|DELETE /admin/roles/:roleId`
- `GET /admin/settings/system`
- `GET|PATCH /company/settings`

GSS role mutations are limited to non-system, non-super-admin roles. Permission replacement is
transactional and accepts only `GSS` or `BOTH` permissions; Company-only permissions are rejected.
Roles assigned to users cannot be deleted, and every create/update/delete is recorded in `AuditLog`.
System and super-admin roles remain readable but immutable. Existing last-safe-admin protections remain
owned by the safe-admin policy used by admin-user mutations.

The canonical GSS Administrator extension is `/admin/gss-users`: list/search and the bounded GSS
role options require `admin-users.view`, create requires `admin-users.create`, identity/role/status/
password update requires `admin-users.update`, and permanent identity deletion requires
`admin-users.delete`. The API uses 50/100 pagination, never returns password hashes or token versions,
and records safe create/update/delete audit snapshots. Passwords use bcrypt cost 12; password or
status changes invalidate existing sessions. Deactivation, Super Admin demotion and deletion share a
transaction-scoped advisory lock and recheck that another active Super Admin remains. Company-user
RBAC, positions and scope are not reachable through this module. No schema migration or seed change
is required because the model and permission catalog already exist.

The system page is intentionally read-only. Its DTO exposes only application version/environment,
MQTT enabled/connected/readiness and subscription count, report provider/worker readiness, bounded
command retry/expiry policy, the documented 180-day sensor-history retention value and existing report
cleanup state. Broker host/client ID, credentials, tokens, raw environment variables, storage paths and
provider payloads are excluded. Production/deployment controls remain deferred to Phase 14.

Company settings derive the Company through the authenticated `CompanyUser` relation. Only address,
phone and email are writable; ID, status, code and legal/display name are read-only. Updates are
validated, normalized for email, audited and returned with the safe Company profile shape. No client
company ID is accepted.
