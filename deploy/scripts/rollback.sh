#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
deploy_root="${DEPLOY_ROOT:-$(cd "$script_dir/../.." && pwd)}"
compose_file="${COMPOSE_FILE:-$deploy_root/docker-compose.production.yml}"
active_release_file="${ACTIVE_RELEASE_FILE:-$deploy_root/release.env}"
rollback_release_file="${ROLLBACK_RELEASE_FILE:-$deploy_root/previous-release.env}"

if [[ ! -f "$rollback_release_file" ]]; then
  echo "Rollback release file not found: $rollback_release_file" >&2
  exit 1
fi

docker compose --env-file "$rollback_release_file" --file "$compose_file" pull
docker compose --env-file "$rollback_release_file" --file "$compose_file" up --detach --remove-orphans

api_smoke_url="$(awk -F= '$1 == "API_SMOKE_URL" {sub(/^[^=]*=/, ""); print; exit}' "$rollback_release_file")"
web_smoke_url="$(awk -F= '$1 == "WEB_SMOKE_URL" {sub(/^[^=]*=/, ""); print; exit}' "$rollback_release_file")"
API_SMOKE_URL="$api_smoke_url" WEB_SMOKE_URL="$web_smoke_url" "$script_dir/smoke-test.sh"

install -m 0600 "$rollback_release_file" "$active_release_file"
echo "Application images rolled back. Database migrations were intentionally retained."
