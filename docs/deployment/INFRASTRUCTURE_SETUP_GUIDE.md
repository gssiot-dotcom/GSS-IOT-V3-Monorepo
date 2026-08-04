# Production infrastructure setup — App EC2 + DB EC2

This is the operator checklist for preparing AWS, S3, Docker Hub and GitHub for the GSS IoT V3
deployment. Complete it in order. Never paste passwords, private keys, access keys or tokens into
chat, issues, commits or screenshots.

## 0. Fixed deployment decisions

- Region examples use Seoul: `ap-northeast-2`.
- App EC2 runs the API and Web containers behind host Nginx/Certbot.
- DB EC2 runs PostgreSQL and accepts `5432` only from the App EC2 security group.
- No MQTT container is deployed. The API connects outbound to
  `mqtt://gssiot.iptime.org:10200` with the existing username, password and topics.
- Docker Hub uses private `gss-iot-v3-api` and public `gss-iot-v3-web` repositories. The Web image
  contains only the static browser bundle and Nginx; the API image remains private.
- Asset and report S3 buckets stay private. Browser access goes through authenticated API
  endpoints, so bucket CORS and public object URLs are not needed.
- Keep all 24 committed Prisma migration directories. EC2 runs `prisma migrate deploy`; EC2 never
  creates migrations and deployment never runs `prisma migrate dev` or `prisma db push`.
  Each file is an ordered schema delta, not a complete snapshot. The current last migration creates
  `RefreshSession` and references `GssAdminUser`/`CompanyUser` tables created earlier, so keeping only
  that file cannot initialize an empty production database.

Before creating paid resources, decide the final values below:

```text
AWS region:                 ap-northeast-2
Web domain:                 infogssiot.com
API/Socket.IO domain:       apiv3.infogssiot.com
Legacy API domain:          api.infogssiot.com (preserve; outside V3 deployment)
Cookie domain:              host-only (do not create AUTH_COOKIE_DOMAIN)
Docker Hub namespace:       gssiot2026
Asset bucket:               <globally-unique-private-asset-bucket>
Report bucket:              <globally-unique-private-report-bucket>
MQTT URL:                   mqtt://gssiot.iptime.org:10200
MQTT topic base:            <existing exact value>
```

## 1. Docker Hub

1. Sign in to Docker Hub and select **My Hub → Repositories → Create repository**.
2. Create `<namespace>/gss-iot-v3-api`; set visibility to **Private**.
3. Create `<namespace>/gss-iot-v3-web`; set visibility to **Public**. This is acceptable because
   browser JavaScript and the public `VITE_*` build values are delivered to users anyway. Never add
   server secrets or private runtime env values to the Web Docker build.
4. Open **Account settings → Personal access tokens**.
5. Create `gss-iot-github-push` with **Read & Write** access. Copy it once and store it in a
   password manager; this becomes GitHub secret `DOCKERHUB_PUSH_TOKEN`.
6. Create `gss-iot-ec2-read` with **Read-only** access. Copy it once; this becomes GitHub secret
   `DOCKERHUB_READ_TOKEN`.
7. Record only the non-secret namespace as GitHub variable `DOCKERHUB_USERNAME`. For the current
   repositories this value is `gssiot2026`, not `gssiot2026/gss-iot-v3-api` or a full repository
   path.

Do not use the Docker Hub account password in GitHub or on EC2.

## 2. AWS network and security groups

Use one VPC for both EC2 instances. App EC2 is in the existing public subnet. The accepted
cost-aware DB baseline uses the same Availability Zone's default/public-route subnet but disables
automatic public IPv4 assignment. A temporary public IPv4 is enabled on the primary network
interface only during reviewed package installation or maintenance and disabled immediately
afterward. A private subnet plus NAT Gateway
remains the preferred future managed-egress upgrade.

Create `gss-app-sg`:

| Direction | Protocol/port   | Source                            | Purpose                        |
| --------- | --------------- | --------------------------------- | ------------------------------ |
| Inbound   | TCP 22          | operator/VPN public IP `/32` only | SSH                            |
| Inbound   | TCP 80          | `0.0.0.0/0`, `::/0`               | Certbot redirect/challenge     |
| Inbound   | TCP 443         | `0.0.0.0/0`, `::/0`               | HTTPS Web/API                  |
| Outbound  | required egress | destination services              | DB, MQTT 10200, DNS/NTP, HTTPS |

Create `gss-db-sg`:

| Direction | Protocol/port | Source       | Purpose                     |
| --------- | ------------- | ------------ | --------------------------- |
| Inbound   | TCP 5432      | `gss-app-sg` | PostgreSQL from API only    |
| Inbound   | TCP 22        | `gss-app-sg` | SSH through App EC2 bastion |

Do not add `0.0.0.0/0` to DB port `5432`. No inbound `1883`, `8883` or `10200` rule belongs on App
EC2; MQTT is an outbound client connection.

## 3. App EC2 and DB EC2

1. Create one EC2 key pair for operator SSH and download the `.pem` once. Restrict the file locally
   and never commit it.
2. Launch App EC2 with a supported Ubuntu LTS x86_64 image, encrypted gp3 storage and `gss-app-sg`.
   Choose its instance size after staging load measurement rather than treating an example size as
   production capacity.
3. Allocate an Elastic IP in the same Region/network border group and associate it with App EC2.
4. Launch DB EC2 in the same VPC and `ap-northeast-2c` subnet as App EC2, with **Auto-assign public
   IP disabled**, encrypted gp3 storage and only `gss-db-sg`. Enable termination protection,
   require IMDSv2 and configure EBS snapshots/backups before production acceptance.
5. Record the App Elastic IP and DB private IP. These IPs are not credentials.
6. Connect to DB through App EC2 from the operator machine, for example:

   ```bash
   ssh -i <key.pem> -J ubuntu@<APP_ELASTIC_IP> ubuntu@<DB_PRIVATE_IP>
   ```

   Never copy the private key onto App EC2 and never add an Internet CIDR SSH rule to `gss-db-sg`.

7. For initial package installation or a reviewed maintenance window, temporarily enable public
   IPv4 assignment on the DB primary network interface and confirm that inbound `22`/`5432` still
   have only `gss-app-sg` as source. Do not SSH to the temporary public address. The first live DB
   launch received `3.39.11.24`; it is an installation-only address, not a permanent endpoint.

8. On DB EC2, install PostgreSQL 16 from the supported Ubuntu repository, enable the service and
   configure:

   ```text
   listen_addresses = '127.0.0.1,172.31.37.205'
   password_encryption = 'scram-sha-256'
   ```

9. In `pg_hba.conf`, permit only the App EC2 private IP, not the entire Internet:

   ```text
   hostssl  gss_iot_v3  gss_app  172.31.32.4/32  scram-sha-256
   ```

10. Restart PostgreSQL, then create a long random database password and run as the PostgreSQL
    admin:

```sql
CREATE ROLE gss_app WITH LOGIN PASSWORD '<random-password>';
CREATE DATABASE gss_iot_v3 OWNER gss_app;
```

11. Test TCP connectivity from App EC2 to `<DB_PRIVATE_IP>:5432`. The production secret is:

    ```text
    DATABASE_URL=postgresql://gss_app:<URL-SAFE-PASSWORD>@172.31.37.205:5432/gss_iot_v3?sslmode=require
    ```

12. After package installation, database configuration and App-to-DB checks succeed, disable
    `Auto-assign public IP` on the DB primary network interface. Confirm DB EC2 once again shows no
    public IPv4 address. Repeat this bounded procedure only for planned operating-system maintenance
    until a managed private egress path is approved.

Do not manually create Prisma tables. The first deployment applies every committed migration in
order and records them in `_prisma_migrations`.

## 4. Private S3 buckets

Create two **General purpose** buckets in `ap-northeast-2`. Bucket names are globally unique and
cannot later be renamed or moved to another Region.

For both buckets:

1. Keep **Object Ownership → Bucket owner enforced**; ACLs remain disabled.
2. Keep all four **Block Public Access** settings enabled.
3. Enable **Bucket Versioning**.
4. Keep default server-side encryption enabled (SSE-S3 is sufficient for the baseline; use an
   approved KMS key if policy requires it).
5. Do not add a public bucket policy, static website hosting or CORS configuration.

Suggested separation:

- asset bucket: company logos and scoped building-plan images;
- report bucket: generated CSV/XLSX report objects.

Create one least-privilege IAM runtime identity per bucket and give it only object access. Replace
both bucket placeholders before saving the policies.

Asset policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AssetObjectAccess",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::<ASSET_BUCKET>/*"
    }
  ]
}
```

Report policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReportObjectAccess",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::<REPORT_BUCKET>/*"
    }
  ]
}
```

Create one access key for each runtime identity. Copy each secret access key immediately; AWS does
not show it again. Store the pairs only as the corresponding GitHub Environment secrets:

```text
ASSET_S3_ACCESS_KEY_ID
ASSET_S3_SECRET_ACCESS_KEY
REPORT_S3_ACCESS_KEY_ID
REPORT_S3_SECRET_ACCESS_KEY
```

Public logos can be introduced later only through a separate public-delivery bucket/CloudFront
design. The current shared asset bucket must not be made public because building plans are protected
by company/building scope.

## 5. App EC2 bootstrap

1. Install Docker Engine and the Docker Compose plugin from Docker's official Ubuntu repository.
   Verify `docker compose version` is v2.30 or newer.
2. Install Nginx, Certbot and the Certbot Nginx plugin.
3. Create the deployment directories:

   ```bash
   sudo install -d -m 0750 /opt/gss-iot
   sudo install -d -m 0700 /etc/gss-iot /var/backups/gss-iot
   ```

4. The GitHub workflow connects as `ubuntu` by default. Give that user only the reviewed sudo
   access needed by the deployment scripts; do not make application env files world-readable.
5. Ensure App EC2 can resolve and connect to:

   ```text
   <DB_PRIVATE_IP>:5432
   gssiot.iptime.org:10200
   s3.ap-northeast-2.amazonaws.com:443
   registry-1.docker.io:443
   ```

6. Ask the physical MQTT broker operator to allow the App Elastic IP if the broker has an IP
   allowlist. Do not change the existing MQTT username, password or topic values.

## 6. DNS, Nginx and Certbot

1. Create DNS `A` records for apex `infogssiot.com` and `apiv3.infogssiot.com` pointing to the App
   Elastic IP. Do not edit `api.infogssiot.com`; it must continue serving the legacy API.
2. Wait until both names resolve publicly to that IP.
3. Copy `deploy/nginx/gss-iot.conf.template` to
   `/etc/nginx/sites-available/gss-iot`, replace `__WEB_DOMAIN__` and `__API_DOMAIN__`, enable the
   site and run `sudo nginx -t`.
4. Issue the certificate:

   ```bash
   sudo certbot --nginx -d infogssiot.com -d apiv3.infogssiot.com
   sudo certbot renew --dry-run
   ```

Do not request the certificate before DNS and ports 80/443 are ready.

## 7. GitHub Environments

In the repository open **Settings → Environments** and create `staging` and `production`.
Configure required reviewers for `production`. The workflows intentionally use exact application
`.env` names.

For the current Windows operator workstation, the same configuration can be validated and applied
without printing secret values. The script requires repository `ADMIN`, reads ignored local
deployment credentials, verifies the recorded App EC2 host fingerprint and prompts securely for
the production `gss_app` database password:

```powershell
.\deploy\scripts\configure-github-environment.ps1
.\deploy\scripts\configure-github-environment.ps1 -Apply
```

Run the first command before `-Apply`. The script creates or updates only the selected GitHub
Environment; it does not commit credentials or alter the local development `DATABASE_URL`.

Add these environment **Secrets**:

```text
DATABASE_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
GSS_SUPER_ADMIN_PASSWORD
MQTT_USERNAME
MQTT_PASSWORD
ASSET_S3_ACCESS_KEY_ID
ASSET_S3_SECRET_ACCESS_KEY
REPORT_S3_ACCESS_KEY_ID
REPORT_S3_SECRET_ACCESS_KEY
APP_EC2_SSH_PRIVATE_KEY
APP_EC2_SSH_KNOWN_HOSTS
DOCKERHUB_PUSH_TOKEN
DOCKERHUB_READ_TOKEN
```

Use two different random values of at least 32 characters for the JWT secrets. Copy the existing
MQTT credentials without changing them. `APP_EC2_SSH_PRIVATE_KEY` is the entire PEM content. Build
`APP_EC2_SSH_KNOWN_HOSTS` only after manually verifying the App host key fingerprint.

Add these environment **Variables** with deployment-specific values:

```text
PORT=3000
CORS_ALLOWED_ORIGINS=https://infogssiot.com
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAME_SITE=lax
AUTH_ACCESS_COOKIE_NAME=gss_access
AUTH_REFRESH_COOKIE_NAME=gss_refresh
AUTH_CSRF_COOKIE_NAME=gss_csrf
JWT_ACCESS_EXPIRES_IN=900
JWT_REFRESH_EXPIRES_IN=2592000
GSS_SUPER_ADMIN_EMAIL=<admin-email>

MQTT_BROKER_URL=mqtt://gssiot.iptime.org:10200
MQTT_CLIENT_ID=gss-iot-v3-production-api
MQTT_TOPIC_BASE=<existing-exact-topic-base>
MQTT_ENABLED=true
MQTT_FAKE_ACK=false
MQTT_COMMAND_ACK_TIMEOUT_MS=30000
MQTT_COMMAND_EXPIRES_IN_SECONDS=300
MQTT_MAX_PUBLISH_ATTEMPTS=3
MQTT_PUBLISH_TIMEOUT_MS=5000

ASSET_STORAGE_PROVIDER=s3
ASSET_S3_ENDPOINT=https://s3.ap-northeast-2.amazonaws.com
ASSET_S3_REGION=ap-northeast-2
ASSET_S3_BUCKET=<asset-bucket>
ASSET_S3_FORCE_PATH_STYLE=false
REPORT_STORAGE_PROVIDER=s3
REPORT_S3_ENDPOINT=https://s3.ap-northeast-2.amazonaws.com
REPORT_S3_REGION=ap-northeast-2
REPORT_S3_BUCKET=<report-bucket>
REPORT_S3_FORCE_PATH_STYLE=false

REPORT_WORKER_ENABLED=true
REPORT_WORKER_INTERVAL_MS=30000
REPORT_WORKER_BATCH_SIZE=10
REPORT_CLEANUP_ENABLED=true
REPORT_CLEANUP_INTERVAL_MS=300000
REPORT_CLEANUP_BATCH_SIZE=100
NODE_OFFLINE_EVALUATOR_ENABLED=true
NODE_OFFLINE_SWEEP_INTERVAL_MS=10000
NODE_OFFLINE_BATCH_SIZE=250
DELETION_WORKER_ENABLED=false
DELETION_WORKER_INTERVAL_MS=5000
DELETION_WORKER_BATCH_SIZE=250
DELETION_WORKER_HEARTBEAT_MS=5000
DELETION_WORKER_LEASE_MS=30000
SENSOR_RETENTION_ENABLED=false
SENSOR_RETENTION_DRY_RUN=true
SENSOR_RETENTION_DAYS=180
SENSOR_RETENTION_INTERVAL_MS=3600000
SENSOR_RETENTION_BATCH_SIZE=1000
SENSOR_RETENTION_MAX_ROWS_PER_CYCLE=10000

VITE_API_BASE_URL=https://apiv3.infogssiot.com
VITE_AUTH_CSRF_COOKIE_NAME=gss_csrf
WEB_SMOKE_URL=https://infogssiot.com
APP_EC2_HOST=13.209.142.179
APP_EC2_USER=ubuntu
APP_EC2_SSH_PORT=22
DOCKERHUB_USERNAME=gssiot2026
```

Do not create an `AUTH_COOKIE_DOMAIN` GitHub variable. Host-only V3 cookies are sent only to
`apiv3.infogssiot.com`; using `.infogssiot.com` would also send them to the legacy API hostname.
The existing `/auth/csrf` JSON response supplies the Web's double-submit header value.

Keep destructive workers disabled until backup restore evidence and the recorded retention/legal
decisions are accepted.

## 8. First staging release

1. Ensure the branch is pushed and CI is green.
2. In **Actions**, run **Publish production images** for `staging`. Leave `image_tag` blank to get
   `sha-<12 characters>`, or enter another immutable OCI-safe tag.
3. Confirm both Docker Hub repositories contain that exact tag; API remains private and Web public.
4. Run **Deploy App EC2** for `staging` with the same tag.
5. The remote script performs:

   ```text
   verified pg_dump → image pull → prisma migrate deploy → API/Web switch → smoke checks
   ```

6. Confirm the database contains all committed rows in `_prisma_migrations`; do not edit them.
7. Test login/refresh/logout, CSRF, Admin and Company scope, Socket.IO reconnect, private logo and
   building-plan upload/download, report generation/download, and real MQTT telemetry plus command
   ACK.
8. Copy the verified PostgreSQL backup off App EC2 and perform the documented disposable restore
   rehearsal before production approval.
9. Promote an immutable source/tag through the protected `production` environment only after the
   staging evidence passes.

## 9. Stop conditions

Stop and fix the cause before continuing if any of these occur:

- DB EC2 port `5432` is Internet-accessible;
- either S3 bucket or any object is public;
- a secret appears in logs, screenshots or committed files;
- the broker requires a changed password/topic or the expected `10200` endpoint is unreachable;
- `prisma migrate deploy` reports a failed migration;
- backup verification or post-deploy smoke checks fail;
- the intended Docker image tag is mutable or cannot be traced to the source SHA.

## Official references

- [Prisma `migrate deploy`](https://www.prisma.io/docs/cli/migrate/deploy)
- [AWS: create a general purpose S3 bucket](https://docs.aws.amazon.com/AmazonS3/latest/userguide/create-bucket-overview.html)
- [AWS: Block Public Access](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html)
- [AWS: S3 security best practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html)
- [AWS: S3 identity policy examples](https://docs.aws.amazon.com/AmazonS3/latest/userguide/example-policies-s3.html)
- [AWS: allocate and associate an Elastic IP](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/working-with-eips.html)
- [AWS: security group rules](https://docs.aws.amazon.com/vpc/latest/userguide/security-group-rules.html)
- [Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [Docker Compose plugin on Linux](https://docs.docker.com/compose/install/linux/)
- [Docker Hub repository access](https://docs.docker.com/docker-hub/repos/manage/access/)
- [GitHub deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
- [GitHub Actions secrets](https://docs.github.com/en/actions/reference/security/secrets)
- [Certbot with Nginx on Ubuntu](https://certbot.eff.org/instructions?ws=nginx&os=ubuntufocal)
