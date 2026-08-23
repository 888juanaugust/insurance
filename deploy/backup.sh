#!/usr/bin/env bash
# Nightly backup. Add to crontab:
#   0 2 * * * /var/www/insurhelp/deploy/backup.sh
set -euo pipefail

DB="${IH_DB:-/var/www/insurhelp/data/insurhelp.db}"
FILES="${IH_FILES:-$(dirname "$DB")/documents}"
DEST="${BACKUP_DIR:-/var/backups/insurhelp}"
KEEP_DAYS="${KEEP_DAYS:-30}"

mkdir -p "$DEST"
STAMP=$(date +%Y%m%d-%H%M%S)

# .backup copies a consistent snapshot even while the app is writing;
# copying the file directly can capture a torn write.
sqlite3 "$DB" ".backup '$DEST/insurhelp-$STAMP.db'"
gzip -f "$DEST/insurhelp-$STAMP.db"

# Uploaded policy documents live on disk, not in the database — a backup of
# the database alone would restore an agency whose every policy links to a
# file that is gone. The two are taken together and restored together.
if [ -d "$FILES" ]; then
  tar -czf "$DEST/documents-$STAMP.tar.gz" -C "$(dirname "$FILES")" "$(basename "$FILES")"
  echo "backed up $DEST/insurhelp-$STAMP.db.gz and $DEST/documents-$STAMP.tar.gz"
else
  echo "backed up $DEST/insurhelp-$STAMP.db.gz (no documents directory at $FILES yet)"
fi

find "$DEST" -name 'insurhelp-*.db.gz'      -mtime +"$KEEP_DAYS" -delete
find "$DEST" -name 'documents-*.tar.gz'     -mtime +"$KEEP_DAYS" -delete
