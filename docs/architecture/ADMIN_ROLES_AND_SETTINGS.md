# Admin roles and portal settings

Task 06 provides three authenticated, backend-guarded settings surfaces:

- `GET|POST /admin/roles`, `GET /admin/roles/permissions`, `PATCH|DELETE /admin/roles/:roleId`
- `GET /admin/settings/system`
- `GET|PATCH /company/settings`

GSS role mutations are limited to non-system, non-super-admin roles. Permission replacement is
transactional and accepts only `GSS` or `BOTH` permissions; Company-only permissions are rejected.
Roles assigned to users cannot be deleted, and every create/update/delete is recorded in `AuditLog`.
System and super-admin roles remain readable but immutable. Existing last-safe-admin protections remain
owned by the safe-admin policy used by admin-user mutations; Task 06 does not add admin-user mutation UX.

The system page is intentionally read-only. Its DTO exposes only application version/environment,
MQTT enabled/connected/readiness and subscription count, report provider/worker readiness, bounded
command retry/expiry policy, the documented 180-day sensor-history retention value and existing report
cleanup state. Broker host/client ID, credentials, tokens, raw environment variables, storage paths and
provider payloads are excluded. Production/deployment controls remain deferred to Phase 14.

Company settings derive the Company through the authenticated `CompanyUser` relation. Only address,
phone and email are writable; ID, status, code and legal/display name are read-only. Updates are
validated, normalized for email, audited and returned with the safe Company profile shape. No client
company ID is accepted.
