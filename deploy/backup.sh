#!/usr/bin/env bash
# Nightly SQLite backup. Add to crontab:
#   0 2 * * * /var/www/insurhelp/deploy/backup.sh
set -euo pipefail

DB="${IH_DB:-/var/www/insurhelp/data/insurhelp.db}"
DEST="${BACKUP_DIR:-/var/backups/insurhelp}"
KEEP_DAYS="${KEEP_DAYS:-30}"

mkdir -p "$DEST"
STAMP=$(date +%Y%m%d-%H%M%S)

# .backup copies a consistent snapshot even while the app is writing;
# copying the file directly can capture a torn write.
sqlite3 "$DB" ".backup '$DEST/insurhelp-$STAMP.db'"
gzip -f "$DEST/insurhelp-$STAMP.db"

find "$DEST" -name 'insurhelp-*.db.gz' -mtime +"$KEEP_DAYS" -delete
echo "backed up to $DEST/insurhelp-$STAMP.db.gz"
