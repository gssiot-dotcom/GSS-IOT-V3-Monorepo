# HttpOnly Auth Session Security

Status: accepted production contract as of 2026-08-01.

## Session model

- Access and refresh JWTs use distinct required secrets, audiences and lifetimes.
- Access is short-lived and stored only in an HttpOnly cookie scoped to `/`.
- Refresh is long-lived and stored only in an HttpOnly cookie scoped to `/auth`.
- Refresh tokens are one-time rotating credentials. PostgreSQL stores only a SHA-256 token hash,
  the current JTI, family ID, principal/context, token version, expiry and revocation lineage.
- A refresh family has one absolute expiry. Every replacement row and JWT inherits the original
  family's deadline; successful rotation never extends the server-side 30-day lifetime.
- Reuse of a rotated or revoked refresh credential revokes every still-active member of its family.
- GSS Admin and Company User identities remain different auth contexts. A cookie for one context
  cannot authorize the other context's `/me`, route guards or Socket.IO rooms.
- Login and refresh response bodies return the public session only. They never return either JWT.
- The Web stores only `{ context }` under `gss-iot-v3-auth-context`; it restores the current public
  session from the matching `/me` endpoint.

## Cookie and request boundary

The default names are `gss_access`, `gss_refresh` and `gss_csrf`. Access and refresh cookies are
HttpOnly and use matching configured Domain, SameSite and Secure attributes. The CSRF cookie is
intentionally readable by the Web and scoped to `/`. Production defaults to `Secure=true`;
`SameSite=None` is rejected unless Secure is enabled.

Every unsafe method, including login, refresh and logout, uses double-submit CSRF protection. The
browser first calls `GET /auth/csrf`, then sends the cookie value in `X-CSRF-Token`. If Origin or
Referer is present, its origin must be in `CORS_ALLOWED_ORIGINS`. CORS allows credentials and the
CSRF header, and does not allow the Authorization header. REST requests use `credentials: include`;
Socket.IO uses `withCredentials: true`. A 401 triggers one module-wide single-flight refresh and at
most one request retry; failed refresh expires the local session and does not loop. Each Socket.IO
connection cycle also attempts refresh/reconnect at most once until a successful connection resets
that allowance.

## Revocation

Logout increments the principal's token version and revokes all active refresh sessions. Password,
role, active-status and other existing identity mutations that increment `tokenVersion` invalidate
access on its next backend validation and cause a later refresh attempt to revoke that refresh
family. Archived/inactive/deleted users or companies cannot restore a session. Refresh-family rows
are session security data and are never exposed by application APIs.

## Environment

Required production inputs:

```txt
JWT_ACCESS_SECRET=<distinct random secret, minimum 32 characters>
JWT_REFRESH_SECRET=<different random secret, minimum 32 characters>
JWT_ACCESS_EXPIRES_IN=900
JWT_REFRESH_EXPIRES_IN=2592000
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAME_SITE=lax
AUTH_ACCESS_COOKIE_NAME=gss_access
AUTH_REFRESH_COOKIE_NAME=gss_refresh
AUTH_CSRF_COOKIE_NAME=gss_csrf
```

`AUTH_COOKIE_DOMAIN` is optional and should be omitted for host-only cookies. Cross-site deployment
requires an explicit architecture/deployment review, `SameSite=None`, HTTPS and `Secure=true`.

## Deployment and rollback

Deploy in this order: back up PostgreSQL; provision both distinct JWT secrets and the cookie/CORS
configuration; apply forward migration `20260801090000_http_only_rotating_auth`; deploy API; deploy
Web; verify CSRF bootstrap, both login contexts, refresh rotation, logout, cross-context denial and
Socket.IO reconnection. Existing bearer sessions intentionally require a new login.

The migration is additive. For an application rollback, restore the previous API/Web environment
contract, deploy the previous builds and force users to log in again; the unused refresh table and
enum may safely remain. Do not drop them during an incident rollback. A later cleanup migration may
remove them only after the new session system is abandoned, all rows are expired/revoked and a
database backup is verified. Rotating either JWT secret is an emergency global session revocation;
deploy the new secret consistently to every API instance before accepting new logins.
