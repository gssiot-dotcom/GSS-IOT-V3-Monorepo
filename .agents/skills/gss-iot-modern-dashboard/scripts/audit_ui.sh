#!/bin/sh
set -eu

if [ ! -f package.json ] || [ ! -d apps/web ] || [ ! -d packages/ui ]; then
  echo "Run this script from the GSS IoT V3 repository root." >&2
  exit 1
fi

printf '%s\n' '=== Git state ==='
git status --short --branch 2>/dev/null || true

printf '%s\n' '\n=== Frontend dependencies ==='
node -e "const p=require('./apps/web/package.json'); console.log(JSON.stringify(p.dependencies,null,2))"

printf '%s\n' '\n=== Shared UI files ==='
find packages/ui/src -maxdepth 3 -type f | sort

printf '%s\n' '\n=== Routes ==='
grep -n 'path=' apps/web/src/app/router.tsx || true

printf '%s\n' '\n=== Tabs ==='
grep -R -n -E '<Tabs|Tabs\.' apps/web/src/features || true

printf '%s\n' '\n=== Shared DataTable usage ==='
grep -R -n '<DataTable' apps/web/src/features || true

printf '%s\n' '\n=== Modal and Drawer usage ==='
grep -R -n -E '<Modal|<Drawer' apps/web/src/features || true

printf '%s\n' '\n=== Direct hardcoded color candidates ==='
grep -R -n -E '#[0-9A-Fa-f]{6}|rgb\(|hsl\(' apps/web/src packages/ui/src || true
