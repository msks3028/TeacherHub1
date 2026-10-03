# Backup and recovery

The existing backup scripts and operating procedure are in `backend/scripts/` and `docs/backup-and-recovery.md`. They cover PostgreSQL custom-format dumps, local uploads, manifests/checksums, archive validation, retention, off-host copy guidance, and a staging restore procedure. Remote S3 objects require bucket versioning/replication separately.

## Current measured state

- Default retention: 30 days (configurable).
- Configure `BACKUP_DIR` and `BACKUP_RETENTION_DAYS` for the backup scripts; schedule their execution in the hosting environment.
- Backup schedule: operator-configured; no scheduler is provisioned by the repository.
- RPO/RTO: **not established**. They depend on schedule, database/storage provider, backup transfer, and measured restore time.
- Restore: documented, but **not rehearsed** against an isolated database/storage target in this environment.

## Release gate

Schedule backups in the hosting environment, copy them into a separate failure domain, verify copied checksums, and rehearse a restore at least quarterly and after schema/storage changes. Record measured restore duration and data recency before declaring RTO/RPO. Never point a rehearsal at production.
