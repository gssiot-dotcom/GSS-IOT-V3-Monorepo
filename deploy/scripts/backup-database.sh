#!/usr/bin/env bash
set -Eeuo pipefail

api_env_file="${API_ENV_FILE:-/etc/gss-iot/api.env}"
backup_dir="${BACKUP_DIR:-/var/backups/gss-iot}"
postgres_image="${POSTGRES_BACKUP_IMAGE:-postgres:16-alpine}"

if [[ ! -f "$api_env_file" ]]; then
  echo "API environment file not found: $api_env_file" >&2
  exit 1
fi

install -d -m 0700 "$backup_dir"
backup_file="postgres-$(date -u +%Y%m%dT%H%M%SZ).dump"

docker run --rm \
  --env-file "$api_env_file" \
  --env "BACKUP_FILE=$backup_file" \
  --volume "$backup_dir:/backups" \
  "$postgres_image" \
  sh -euc '
    normalized_url="$(printf "%s" "$DATABASE_URL" | sed -E "s/([?&])schema=[^&]*&?/\1/g; s/\?&/?/g; s/[?&]$//")"
    pg_dump --dbname="$normalized_url" --format=custom --no-owner --file="/backups/$BACKUP_FILE"
    pg_restore --list "/backups/$BACKUP_FILE" >/dev/null
    chmod 0600 "/backups/$BACKUP_FILE"
    sha256sum "/backups/$BACKUP_FILE" >"/backups/$BACKUP_FILE.sha256"
    chmod 0600 "/backups/$BACKUP_FILE.sha256"
  '

echo "Verified PostgreSQL backup created: $backup_dir/$backup_file"
