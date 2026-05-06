# Backup Runbook

## Scope

The platform has two persistent layers that must be backed up:

- PostgreSQL (`DATABASE_URL`)
- media storage (`local` uploads directory or S3-compatible bucket)

## PostgreSQL

Create a backup:

```powershell
.\scripts\backup-postgres.ps1
```

Restore a backup:

```powershell
.\scripts\restore-postgres.ps1 -BackupFile .\backups\postgres\game_game-YYYYMMDD-HHMMSS.dump
```

Recommendations:

- keep at least one daily snapshot
- keep one weekly snapshot for 4 weeks
- verify restore on a non-production database before relying on the backup policy

## Media Storage

Create a media backup:

```powershell
.\scripts\backup-media.ps1
```

Behavior:

- `STORAGE_PROVIDER=local`: copies the local uploads directory
- `STORAGE_PROVIDER=s3`: mirrors the bucket with `mc mirror` if MinIO Client is installed

Recommendations:

- for managed S3 providers, prefer bucket versioning and provider-native lifecycle/replication
- keep object storage retention aligned with PostgreSQL backup retention
- document the exact bucket name and endpoint per environment

## Restore Strategy

1. restore PostgreSQL into a clean target database
2. restore media files or bucket objects
3. run `npm run smoke:mvp`
4. verify `/api/health/details`
5. verify admin media list and one child mission with media assets
