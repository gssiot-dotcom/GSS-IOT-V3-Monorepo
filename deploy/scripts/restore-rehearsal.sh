#!/usr/bin/env bash
set -Eeuo pipefail

backup_file="${1:-}"
restore_database_url="${RESTORE_DATABASE_URL:-}"
postgres_image="${POSTGRES_BACKUP_IMAGE:-postgres:16-alpine}"

if [[ -z "$backup_file" || ! -f "$backup_file" ]]; then
  echo "Usage: RESTORE_DATABASE_URL=... $0 /absolute/path/to/backup.dump" >&2
  exit 1
fi
if [[ -z "$restore_database_url" ]]; then
  echo "RESTORE_DATABASE_URL is required." >&2
  exit 1
fi

backup_dir="$(cd "$(dirname "$backup_file")" && pwd)"
backup_name="$(basename "$backup_file")"

docker run --rm \
  --env "BACKUP_FILE=$backup_name" \
  --env "RESTORE_DATABASE_URL=$restore_database_url" \
  --volume "$backup_dir:/backups:ro" \
  "$postgres_image" \
  sh -euc '
    normalized_url="$(printf "%s" "$RESTORE_DATABASE_URL" | sed -E "s/([?&])schema=[^&]*&?/\1/g; s/\?&/?/g; s/[?&]$//")"
    database_path="${normalized_url%%\?*}"
    database_name="${database_path##*/}"
    case "$database_name" in
      *_restore_rehearsal) ;;
      *) echo "Refusing restore: target database must end with _restore_rehearsal." >&2; exit 1 ;;
    esac
    pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$normalized_url" "/backups/$BACKUP_FILE"
    psql "$normalized_url" --no-psqlrc --tuples-only --command="SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;"
  '

echo "Restore rehearsal completed against the explicitly isolated restore database."
