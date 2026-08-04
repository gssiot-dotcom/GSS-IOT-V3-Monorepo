# App EC2 + DB EC2 deployment runbook

Status: Phase 14 deployment-readiness baseline with live App EC2 and DNS progress recorded in
`PROJECT_STATE.md`. DB EC2, S3 credentials, application release and restore rehearsal still require
separate acceptance evidence.

## Approved topology

```text
Browser
  -> HTTPS infogssiot.com -> host Nginx -> Web container (127.0.0.1:8080)
  -> HTTPS apiv3.infogssiot.com -> host Nginx -> API container (127.0.0.1:3000)

API container
  -> private PostgreSQL connection -> DB EC2:5432
  -> outbound MQTT connection -> mqtt://gssiot.iptime.org:10200
  -> HTTPS -> private S3 buckets for assets and report exports
```

App EC2 never runs PostgreSQL, Redis or an MQTT broker. It never opens inbound `1883`/`8883`.
The API is the MQTT client: it subscribes to the approved telemetry/response topics and publishes
the existing durable command-outbox payloads. Exact `GatewayCommand.id` request correlation,
numeric wire arrays, retry behavior and `MQTT_FAKE_ACK=false` are unchanged.

The production Web origin is `https://infogssiot.com`; the new API and Socket.IO origin is
`https://apiv3.infogssiot.com`. The existing `api.infogssiot.com` hostname belongs to the legacy
deployment and is not changed by V3. Omit `AUTH_COOKIE_DOMAIN` so access, refresh and CSRF cookies
remain host-only to `apiv3.infogssiot.com` and are never sent to the legacy API. The Web obtains the
double-submit value from the existing `/auth/csrf` response body; it does not need to read the API
host's cookie. Set `CORS_ALLOWED_ORIGINS=https://infogssiot.com`.

## Network boundary

- App EC2 inbound: `80` and `443` from the Internet; `22` only from the operator/VPN CIDR.
- DB EC2 inbound: `5432` and maintenance SSH `22` only from `gss-app-sg`; no Internet CIDR. DB EC2
  normally has no public IP. A temporary public IPv4 on its primary network interface is permitted
  only for outbound package installation or reviewed maintenance, then must be disabled immediately.
- External MQTT broker inbound: TCP `10200` only from the App EC2 Elastic IP/private VPN route.
  No broker port is exposed on App EC2. The existing username/password and topic contract remain
  unchanged; credentials are never stored in the repository.
- App EC2 outbound: DB EC2 `5432`, broker TCP `10200`, DNS/NTP and HTTPS for S3/Docker Hub/package
  operations. `mqtt://` is plaintext MQTT, so the network path must be treated accordingly until
  the separately operated broker supports a reviewed TLS endpoint.
- PostgreSQL listens only on loopback plus `172.31.37.205`, requires TLS/SCRAM from App private IP
  `172.31.32.4`, and uses a least-privilege application role plus a separate backup/restore operator
  role.

## GitHub Environment contract

Create `staging` and `production` GitHub Environments. Add production approval protection before
using the deployment workflow. Application names below exactly match the validated `.env` names.

Secrets:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `GSS_SUPER_ADMIN_PASSWORD`
- `MQTT_USERNAME`, `MQTT_PASSWORD`
- `ASSET_S3_ACCESS_KEY_ID`, `ASSET_S3_SECRET_ACCESS_KEY`
- `REPORT_S3_ACCESS_KEY_ID`, `REPORT_S3_SECRET_ACCESS_KEY`

Variables:

- `PORT`, `CORS_ALLOWED_ORIGINS`
- `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `AUTH_COOKIE_SECURE`,
  `AUTH_COOKIE_SAME_SITE`, `AUTH_ACCESS_COOKIE_NAME`, `AUTH_REFRESH_COOKIE_NAME`,
  `AUTH_CSRF_COOKIE_NAME`
- `GSS_SUPER_ADMIN_EMAIL`
- `MQTT_BROKER_URL` (`mqtt://gssiot.iptime.org:10200`), `MQTT_CLIENT_ID`, `MQTT_TOPIC_BASE` and all
  `MQTT_*` timeout/attempt flags
- `ASSET_S3_ENDPOINT`, `ASSET_S3_REGION`, `ASSET_S3_BUCKET`,
  `ASSET_S3_FORCE_PATH_STYLE`
- `REPORT_S3_ENDPOINT`, `REPORT_S3_REGION`, `REPORT_S3_BUCKET`,
  `REPORT_S3_FORCE_PATH_STYLE` and all `REPORT_*` worker/cleanup values
- all `NODE_OFFLINE_*`, `DELETION_WORKER_*` and `SENSOR_RETENTION_*` values
- `VITE_API_BASE_URL`, `VITE_AUTH_CSRF_COOKIE_NAME`

Deployment-control credentials are not application env values: `APP_EC2_HOST`, `APP_EC2_USER`,
`APP_EC2_SSH_PORT`, `APP_EC2_SSH_PRIVATE_KEY`, pinned `APP_EC2_SSH_KNOWN_HOSTS`, `WEB_SMOKE_URL`,
`DOCKERHUB_USERNAME`, `DOCKERHUB_PUSH_TOKEN` and `DOCKERHUB_READ_TOKEN`.

The selected Docker Hub coordinates are `gssiot2026/gss-iot-v3-api` (private) and
`gssiot2026/gss-iot-v3-web` (public). Set `DOCKERHUB_USERNAME=gssiot2026`; workflows append the
repository suffixes. EC2 still authenticates with the read-only token because the API image is
private. The public Web image must contain no server secret; current build arguments are public
browser configuration only.

The renderer enforces the current fail-safe production posture: S3 storage, secure cookies,
host-only API cookies, external MQTT enabled, fake ACK disabled, deletion worker disabled and
sensor retention disabled in dry-run mode. Both production S3 buckets remain private.
Authenticated API endpoints stream logos,
building plans and reports after RBAC/scope checks; no public object URL is required. Do not weaken
the storage or destructive-job posture until the corresponding decisions are accepted in
`DECISION_LOG.md`.

## One-time App EC2 bootstrap

1. Install Docker Engine with Compose v2.30 or newer, Nginx and Certbot's Nginx plugin on Ubuntu
   LTS. Compose's raw service `env_file` format and `docker run --env-file` then consume the same
   exact, non-interpolated application values.
2. Create `/opt/gss-iot`, `/etc/gss-iot` and `/var/backups/gss-iot`; restrict the latter two to
   root (`0700`). Grant the deployment user passwordless sudo only for the documented deployment
   commands.
3. Copy `deploy/nginx/gss-iot.conf.template` to `/etc/nginx/sites-available/gss-iot`, replace
   `__WEB_DOMAIN__` and `__API_DOMAIN__`, enable it, and run `nginx -t`.
4. Point `infogssiot.com` and `apiv3.infogssiot.com` to the App EC2 Elastic IP, verify both names
   against the authoritative DNS servers, and issue TLS:
   `sudo certbot --nginx -d infogssiot.com -d apiv3.infogssiot.com`.
5. Verify `sudo certbot renew --dry-run`.
6. After the first successful release, install `deploy/systemd/gss-iot.service`, run
   `systemctl daemon-reload`, then enable the service. Docker restart policies and systemd restore
   the active `release.env` after reboot.

The internal container ports bind only to loopback. TLS terminates at host Nginx. The API vhost
preserves Socket.IO upgrades and allows the current 8 MiB private image limit with bounded proxy
headroom.

## Release flow

1. Merge only after CI passes unit, type, lint, i18n, build, PostgreSQL E2E and container-build
   gates.
2. Run `Publish production images` for `staging` with an immutable tag such as the Git SHA.
3. Run `Deploy App EC2` for `staging` using that exact tag.
4. Verify Admin and Company CSRF/login/refresh/logout, Socket.IO reconnect, S3 upload/download,
   report generation and a real external-MQTT telemetry/command ACK cycle.
5. Promote the same source SHA by publishing the Web image with production
   `VITE_API_BASE_URL`, then deploy `production` after the environment approval.

The remote deployment sequence is always:

```text
verified pg_dump backup
  -> docker image pull
  -> prisma migrate deploy
  -> API/Web switch
  -> API health + CSRF + Web smoke
  -> active release record
```

All committed Prisma migrations are immutable deployment history. Keep all 24 current migration
directories. `prisma migrate deploy` applies only the pending committed migrations in order; it
does not generate a new migration on EC2. Never run `prisma migrate dev`, `prisma db push`, delete
old migration folders or squash production history during deployment.

Seeds are not run on every deploy. Run the idempotent production seed only for initial bootstrap or
an explicitly reviewed permission/catalog update, using the same immutable API image and env file.

## Rollback and restore

`deploy/scripts/deploy.sh` stores the previous immutable image pair and automatically attempts an
image rollback when post-switch smoke checks fail. Manual rollback:

```bash
sudo /opt/gss-iot/deploy/scripts/rollback.sh
```

Rollback never executes `db push`, reverses a migration or deletes an additive column. If the old
application cannot tolerate the forward schema, stop and use the incident plan; do not improvise a
destructive schema rollback.

Each deploy creates a custom-format `pg_dump`, verifies its table-of-contents and records SHA-256.
Copy backups to approved encrypted off-host storage; local disk is not the final backup boundary.
Run a scheduled restore rehearsal only against a disposable database whose name ends with
`_restore_rehearsal`:

```bash
RESTORE_DATABASE_URL='postgresql://.../gss_iot_v3_restore_rehearsal' \
  sudo -E /opt/gss-iot/deploy/scripts/restore-rehearsal.sh \
  /var/backups/gss-iot/postgres-YYYYMMDDTHHMMSSZ.dump
```

Record restore duration, migration count and authenticated smoke evidence. Production destructive
retention/purge remains blocked until this evidence and the open S3/legal-hold decisions are
approved.
