#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
deploy_root="${DEPLOY_ROOT:-$(cd "$script_dir/../.." && pwd)}"
compose_file="${COMPOSE_FILE:-$deploy_root/docker-compose.production.yml}"
candidate_release_file="${CANDIDATE_RELEASE_FILE:-$deploy_root/candidate-release.env}"
active_release_file="${ACTIVE_RELEASE_FILE:-$deploy_root/release.env}"
previous_release_file="${PREVIOUS_RELEASE_FILE:-$deploy_root/previous-release.env}"
rollback_needed=false

read_release_value() {
  local key="$1"
  local file="$2"
  awk -F= -v key="$key" '$1 == key {sub(/^[^=]*=/, ""); print; exit}' "$file"
}

handle_error() {
  local status=$?
  trap - ERR
  if [[ "$rollback_needed" == "true" && -f "$previous_release_file" ]]; then
    echo "Deployment failed after container switch; attempting image rollback." >&2
    DEPLOY_ROOT="$deploy_root" \
      COMPOSE_FILE="$compose_file" \
      ACTIVE_RELEASE_FILE="$active_release_file" \
      ROLLBACK_RELEASE_FILE="$previous_release_file" \
      "$script_dir/rollback.sh" || true
  fi
  exit "$status"
}
trap handle_error ERR

if [[ ! -f "$candidate_release_file" ]]; then
  echo "Candidate release file not found: $candidate_release_file" >&2
  exit 1
fi

api_image="$(read_release_value API_IMAGE "$candidate_release_file")"
web_image="$(read_release_value WEB_IMAGE "$candidate_release_file")"
api_env_file="$(read_release_value API_ENV_FILE "$candidate_release_file")"
api_smoke_url="$(read_release_value API_SMOKE_URL "$candidate_release_file")"
web_smoke_url="$(read_release_value WEB_SMOKE_URL "$candidate_release_file")"
backup_dir="$(read_release_value BACKUP_DIR "$candidate_release_file")"

for required_value in "$api_image" "$web_image" "$api_env_file" "$api_smoke_url" "$web_smoke_url"; do
  if [[ -z "$required_value" ]]; then
    echo "Candidate release file is missing a required value." >&2
    exit 1
  fi
done
if [[ ! -f "$api_env_file" ]]; then
  echo "API environment file not found: $api_env_file" >&2
  exit 1
fi

if [[ -f "$active_release_file" ]]; then
  install -m 0600 "$active_release_file" "$previous_release_file"
fi

API_ENV_FILE="$api_env_file" BACKUP_DIR="${backup_dir:-/var/backups/gss-iot}" \
  "$script_dir/backup-database.sh"

docker compose --env-file "$candidate_release_file" --file "$compose_file" pull

docker run --rm \
  --env-file "$api_env_file" \
  "$api_image" \
  pnpm exec prisma migrate deploy --schema prisma/schema.prisma

docker compose --env-file "$candidate_release_file" --file "$compose_file" \
  up --detach --remove-orphans
rollback_needed=true

API_SMOKE_URL="$api_smoke_url" WEB_SMOKE_URL="$web_smoke_url" "$script_dir/smoke-test.sh"

install -m 0600 "$candidate_release_file" "$active_release_file"
rollback_needed=false
trap - ERR

echo "Deployment completed: backup -> migration -> API/Web -> smoke checks."
