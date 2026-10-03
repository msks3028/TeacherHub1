#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR_INPUT="${1:?Usage: verify-backup.sh <backup-directory>}"
BACKUP_DIR="$(cd "$BACKUP_DIR_INPUT" && pwd)"
cd "$BACKUP_DIR"
[[ -f SHA256SUMS.txt ]] || { echo "SHA256SUMS.txt not found" >&2; exit 2; }

# Accept only the fixed filenames produced by backup.sh; never follow a path
# supplied through an untrusted checksum manifest.
awk '
  {
    if (length($0) < 67 || substr($0, 65, 2) != "  ") exit 2
    hash = substr($0, 1, 64)
    name = substr($0, 67)
    if (hash !~ /^[0-9a-fA-F]+$/ || name !~ /^[A-Za-z0-9._-]+$/) exit 2
    if (name != "database.dump" && name != "manifest.json" && name != "uploads.tar.gz") exit 2
    if (seen[name]++) exit 2
  }
  END { if (!seen["database.dump"] || !seen["manifest.json"]) exit 2 }
' SHA256SUMS.txt || { echo "Invalid checksum manifest" >&2; exit 2; }
sha256sum --strict --check SHA256SUMS.txt
[[ -f database.dump && -f manifest.json ]] || { echo "Required backup files are missing" >&2; exit 2; }

grep -Eq '"databaseDump"[[:space:]]*:[[:space:]]*"database.dump"' manifest.json || { echo "Database dump is not identified in manifest" >&2; exit 2; }
grep -Eq '"databaseVerified"[[:space:]]*:[[:space:]]*true' manifest.json || { echo "Manifest does not mark the database dump verified" >&2; exit 2; }
pg_restore --list database.dump >/dev/null

if [[ -f uploads.tar.gz ]]; then
  grep -Eq '"storageMode"[[:space:]]*:[[:space:]]*"local"' manifest.json || { echo "Unexpected upload archive for this storage mode" >&2; exit 2; }
  tar -tzf uploads.tar.gz >/dev/null
else
  grep -Eq '"storageMode"[[:space:]]*:[[:space:]]*"remote-s3"' manifest.json && grep -Eq '"uploadsArchive"[[:space:]]*:[[:space:]]*null' manifest.json || { echo "Storage archive does not match manifest" >&2; exit 2; }
fi

echo "Backup checksums and archive structure verified."
