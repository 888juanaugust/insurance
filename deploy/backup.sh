#!/usr/bin/env bash
# Nightly backup. Add to crontab:
#   0 2 * * * /var/www/insurhelp/deploy/backup.sh
#
# One agency, one database, one backup pair: <agency>-<stamp>.db.gz for the
# book and <agency>-documents-<stamp>.tar.gz for the schedules it points at.
# Restoring one agency is then two files, and never touches another's.
set -euo pipefail

TENANTS="${IH_TENANTS_DIR:-}"
DEST="${BACKUP_DIR:-/var/backups/insurhelp}"
KEEP_DAYS="${KEEP_DAYS:-30}"

mkdir -p "$DEST"
STAMP=$(date +%Y%m%d-%H%M%S)

# .backup copies a consistent snapshot even while the app is writing;
# copying the file directly can capture a torn write. Uploaded documents live
# on disk, not in the database — a backup of the database alone would restore
# an agency whose every policy links to a file that is gone, so the two are
# taken together and must be restored together.
backup_one() {
  local name="$1" db="$2" files="$3"
  sqlite3 "$db" ".backup '$DEST/$name-$STAMP.db'"
  gzip -f "$DEST/$name-$STAMP.db"
  if [ -d "$files" ] && [ -n "$(ls -A "$files" 2>/dev/null)" ]; then
    tar -czf "$DEST/$name-documents-$STAMP.tar.gz" -C "$(dirname "$files")" "$(basename "$files")"
    echo "  $name: $DEST/$name-$STAMP.db.gz + $DEST/$name-documents-$STAMP.tar.gz"
  else
    echo "  $name: $DEST/$name-$STAMP.db.gz (no documents yet)"
  fi
}

if [ -n "$TENANTS" ] && [ -d "$TENANTS" ]; then
  found=0
  for dir in "$TENANTS"/*/; do
    slug=$(basename "$dir")
    [ -f "$dir/insurhelp.db" ] || continue
    found=$((found + 1))
    backup_one "$slug" "$dir/insurhelp.db" "$dir/documents"
  done
  if [ "$found" -eq 0 ]; then
    echo "no agency databases under $TENANTS — nothing to back up"
  else
    echo "backed up $found agenc$([ "$found" -eq 1 ] && echo y || echo ies) to $DEST"
  fi
else
  DB="${IH_DB:-/var/www/insurhelp/data/insurhelp.db}"
  FILES="${IH_FILES:-$(dirname "$DB")/documents}"
  backup_one insurhelp "$DB" "$FILES"
fi

find "$DEST" -name '*.db.gz'  -mtime +"$KEEP_DAYS" -delete
find "$DEST" -name '*.tar.gz' -mtime +"$KEEP_DAYS" -delete
