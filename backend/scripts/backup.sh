#!/usr/bin/env bash
set -euo pipefail
umask 077

: "${DATABASE_URL:?DATABASE_URL must be provided through the process environment}"
BACKUP_DIR="${BACKUP_DIR:-$(cd "$(dirname "$0")/../.." && pwd)/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] && (( RETENTION_DAYS >= 1 && RETENTION_DAYS <= 3650 )) || { echo "BACKUP_RETENTION_DAYS must be 1..3650" >&2; exit 2; }
mkdir -p "$BACKUP_DIR"
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd)"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
RUN_DIR="$BACKUP_DIR/teacherhub-backup-$STAMP"
mkdir "$RUN_DIR"

PASSFILE="$RUN_DIR/.pgpass"
trap 'rm -f -- "$PASSFILE"' EXIT
CONNECTION_JSON="$(node "$(dirname "$0")/prepare-db-connection.js" "$PASSFILE")"
DB_URL="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).connectionString)' "$CONNECTION_JSON")"
DB_USER="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).username)' "$CONNECTION_JSON")"
export PGPASSFILE="$PASSFILE"
unset DATABASE_URL
pg_dump --no-password --dbname="$DB_URL" --username="$DB_USER" --format=custom --file="$RUN_DIR/database.dump"
rm -f -- "$PASSFILE"
pg_restore --list "$RUN_DIR/database.dump" >/dev/null

STORAGE_MODE="${STORAGE_DRIVER:-local}"
if [[ "$STORAGE_MODE" == "s3" ]]; then
  STORAGE_MODE="remote-s3"
  UPLOADS_ARCHIVE="null"
  REMOTE_NOTE='"Protect the configured object bucket separately with versioning and a second-region/account copy."'
else
  UPLOAD_ROOT="${UPLOAD_DIR:-$(cd "$(dirname "$0")/.." && pwd)/uploads}"
  [[ -d "$UPLOAD_ROOT" ]] || { echo "Local upload directory not found: $UPLOAD_ROOT" >&2; exit 2; }
  tar -czf "$RUN_DIR/uploads.tar.gz" -C "$UPLOAD_ROOT" .
  tar -tzf "$RUN_DIR/uploads.tar.gz" >/dev/null
  UPLOADS_ARCHIVE='"uploads.tar.gz"'
  REMOTE_NOTE="null"
fi

cat > "$RUN_DIR/manifest.json" <<EOF
{
  "createdAtUtc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "databaseDump": "database.dump",
  "databaseVerified": true,
  "storageMode": "$STORAGE_MODE",
  "uploadsArchive": $UPLOADS_ARCHIVE,
  "remoteStorageNote": $REMOTE_NOTE
}
EOF
if [[ -f "$RUN_DIR/uploads.tar.gz" ]]; then
  (cd "$RUN_DIR" && sha256sum database.dump manifest.json uploads.tar.gz > SHA256SUMS.txt)
else
  (cd "$RUN_DIR" && sha256sum database.dump manifest.json > SHA256SUMS.txt)
fi

# Limit cleanup to named direct children under the already-resolved backup root.
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name 'teacherhub-backup-*' -mtime "+$RETENTION_DAYS" -print0 |
while IFS= read -r -d '' target; do
  case "$(realpath "$target")" in "$BACKUP_DIR"/teacherhub-backup-*) rm -rf -- "$target" ;; *) echo "Refusing retention target outside BACKUP_DIR" >&2; exit 2 ;; esac
done

echo "Backup verified: $RUN_DIR"
