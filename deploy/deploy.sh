#!/usr/bin/env bash
# Pull, build and restart. Run from /var/www/insurhelp.
#
# The build happens on the server on purpose: better-sqlite3 is a native
# module, so a bundle built on a different machine or architecture will not
# load here.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> fetching"
git pull --ff-only

echo "==> installing"
npm ci --omit=dev --ignore-scripts=false

echo "==> building"
npm run build

echo "==> restarting"
pm2 reload ecosystem.config.cjs --update-env

pm2 save
echo "==> done"
