#!/usr/bin/env bash
set -Eeuo pipefail

api_url="${API_SMOKE_URL:?API_SMOKE_URL is required}"
web_url="${WEB_SMOKE_URL:?WEB_SMOKE_URL is required}"
api_url="${api_url%/}"
web_url="${web_url%/}"

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

curl --fail --silent --show-error --retry 10 --retry-all-errors --retry-delay 3 \
  "$api_url/health" >"$work_dir/health.json"
grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' "$work_dir/health.json"

curl --fail --silent --show-error --retry 5 --retry-all-errors --retry-delay 2 \
  --header "Origin: $web_url" \
  "$api_url/auth/csrf" >"$work_dir/csrf.json"
grep -Eq '"csrfToken"[[:space:]]*:' "$work_dir/csrf.json"

curl --fail --silent --show-error --retry 10 --retry-all-errors --retry-delay 3 \
  "$web_url/" >"$work_dir/index.html"
grep -Eqi '<div[^>]+id="root"' "$work_dir/index.html"

echo "Smoke checks passed for API health, CSRF bootstrap and Web shell."
