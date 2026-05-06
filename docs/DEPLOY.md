# Deploy Runbook

This project now supports two media storage modes:

- `local` for local development
- `s3` for production-like and deployment environments

## Target Baseline

Recommended deployment baseline:

1. PostgreSQL
2. NestJS API
3. Next.js web
4. S3-compatible object storage
5. Reverse proxy / TLS in front of API and web

## Required Environment

Use [`.env.s3.example`](C:\Users\direc\Downloads\game_game\.env.s3.example) as the starting point for a production-like configuration.

Critical values:

- `DATABASE_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SOCKET_URL`
- `STORAGE_PROVIDER="s3"`
- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_PUBLIC_BASE_URL`
- `LOG_FILE_PATH` if logs should also be mirrored into a file for collection

For local seeded access after deploy/seed:

- `admin@example.com / admin123`
- `trainer@example.com / trainer123`

## Deploy Order

1. Install dependencies:

```bash
npm install
```

2. Generate Prisma client:

```bash
npm --workspace @game-game/api run prisma:generate
```

3. Apply migrations:

```bash
npm --workspace @game-game/api run prisma:migrate
```

4. Seed the baseline data if this is a new environment:

```bash
npm --workspace @game-game/api run prisma:seed
```

5. Build API and web:

```bash
cmd /c npm --workspace @game-game/api run build
cmd /c npm --workspace @game-game/web run build
```

6. Start API and web with the target environment loaded.

## Verification Checklist

After deployment, verify:

1. `GET /api/health/details` returns:
   - `ok: true`
   - `database: "connected"`
   - `storage: "s3"`
2. Admin login works through `/api/auth/login`
3. Trainer login works through `/api/auth/login`
4. `POST /api/admin/media/upload-file` returns an S3-backed URL
5. Child join/select/progress flow works
6. Trainer resolve/review flow works
7. `x-request-id` is present on API responses
8. `GET /api/admin/audit-logs` returns recent actions for an admin session
9. Structured logs appear in stdout and, if configured, in `LOG_FILE_PATH`

Login payload example:

```json
{ "email": "trainer@example.com", "password": "trainer123" }
```

## S3 Notes

- `S3_PUBLIC_BASE_URL` should point to the public object path used by the browser.
- Keep `S3_CREATE_BUCKET_IF_MISSING="false"` in managed environments.
- Use `S3_FORCE_PATH_STYLE="true"` for MinIO and many local providers.
- Use `S3_FORCE_PATH_STYLE="false"` when your provider expects virtual-host style URLs.

## Local S3-Compatible Verification

The project has already been verified locally against MinIO with:

- `storage: "s3"` in health details
- successful `smoke:mvp`
- uploaded asset URL on `http://localhost:9000/game-game-media/...`

## Remaining Production Hardening

Still recommended before real release:

1. Real admin/trainer user management instead of seeded local accounts
2. Centralized log shipping for structured HTTP/error/audit events
3. Metrics/alerting on health, failed auth attempts, and audit volume
4. Backup/retention for PostgreSQL and object storage
5. TLS, secret management, and deployment-specific run scripts
