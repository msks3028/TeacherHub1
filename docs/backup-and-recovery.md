# TeacherHub backup and recovery

## What is backed up

- PostgreSQL is exported in custom format by `pg_dump`; `pg_restore --list` verifies that the archive can be read before the run is marked successful.
- Local `backend/uploads` (or `UPLOAD_DIR`) is archived separately and checked with `tar -t`.
- A manifest and SHA-256 checksums accompany each dated backup directory.
- The backup directory can be re-verified after copying with `backend/scripts/verify-backup.ps1` or `backend/scripts/verify-backup.sh`. Verification checks the checksums, PostgreSQL archive readability, and local upload archive structure without connecting to a database.
- The scripts keep 30 days by default. Set `BACKUP_RETENTION_DAYS` to a value from 1 to 3650 and point `BACKUP_DIR` at a private, access-controlled location. Keep at least one copy outside the application host.
- When `STORAGE_DRIVER=s3`, uploaded objects are not on local disk. Enable bucket versioning and replicate/copy the bucket to a separate account or region. The database backup script records this mode but does not claim to copy remote objects.

Backups contain student records and uploaded coursework. Restrict filesystem access and encrypt the backup volume or remote backup destination. Keep database credentials in the process environment or the host's secret manager; do not put them in this repository.

## Run a backup

Install Node.js, PostgreSQL client tools (`pg_dump` and `pg_restore`), and `tar`. Provide the same `DATABASE_URL` used by the running application through the process environment. The scripts remove Prisma-only URL settings and pass the database password to `pg_dump` through a short-lived, permission-restricted passfile rather than a command-line argument; do not enable shell tracing around backup runs.

Windows PowerShell:

```powershell
$env:DATABASE_URL = '<managed-secret>'
$env:BACKUP_DIR = 'D:\TeacherHubBackups'
$env:BACKUP_RETENTION_DAYS = '30'
powershell -NoProfile -ExecutionPolicy Bypass -File .\backend\scripts\backup.ps1
```

Linux/macOS:

```sh
export DATABASE_URL='<managed-secret>'
export BACKUP_DIR='/var/backups/teacherhub'
export BACKUP_RETENTION_DAYS=30
bash backend/scripts/backup.sh
```

Run once manually, confirm the generated dump and upload archive, then schedule the same command daily with Windows Task Scheduler or cron. Configure the scheduler to alert on a non-zero exit code. Copy completed directories to a second failure domain; retention on one machine is not an off-host backup.

After copying a backup to its second location, run the matching verification script against that copied directory. Perform a restore rehearsal to an isolated staging database and storage directory at least quarterly and after a schema or storage-provider change. Record the date, archive identifier, checksum result, application smoke-check result, and restore duration without recording credentials.

## Restore safely

1. Choose a clean staging host and a new, empty PostgreSQL database. Do not point restore commands at the production database.
2. Verify the copied archive from its parent directory: `powershell -NoProfile -File .\backend\scripts\verify-backup.ps1 D:\TeacherHubBackups\teacherhub-backup-YYYYMMDD-HHMMSS` on Windows, or `bash backend/scripts/verify-backup.sh /var/backups/teacherhub/teacherhub-backup-YYYYMMDD-HHMMSS` on Linux/macOS.
3. Create the staging database through the managed database provider. Restore into it with `pg_restore --exit-on-error --dbname "$STAGING_DATABASE_URL" database.dump`. Do not add `--clean` or `--create` to this procedure.
4. If `manifest.json` says `storageMode` is `local`, extract `uploads.tar.gz` into a new empty staging upload directory and set `UPLOAD_DIR` to that directory. If it says `remote-s3`, restore the bucket snapshot/versioned objects to a staging bucket and update the staging storage configuration.
5. Start the app against the staging database and storage. Sign in with a test account, open representative course content, play a video, and verify student file authorization.
6. Record the dump timestamp and checksums, compare expected row counts and recent content, then plan production cutover separately. Keep the current production database untouched until the staging restore has been accepted.

The backup scripts do not run a restore or alter a database. Database recovery point depends on the schedule and the provider's own point-in-time recovery window.
