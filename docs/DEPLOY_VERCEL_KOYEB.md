# Deploy: Vercel + Koyeb

## Target Setup

- `apps/web` -> Vercel
- `apps/api` -> Koyeb Web Service
- PostgreSQL -> managed database
- Storage -> simplest test mode: `local`

This setup is suitable for testing and a production-like release candidate.

## 1. Backend On Koyeb

Create a new Web Service from the GitHub repository.

Repository settings:

- repository root: project root
- branch: your deploy branch
- Dockerfile path: `apps/api/Dockerfile`

This repo now includes a backend Dockerfile, so Koyeb can build the API without extra build/run command wiring.

Expose HTTP port:

- use platform `PORT`
- API now reads `PORT` from env automatically

### Backend env

Set these on Koyeb:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB?schema=public
PORT=8000
AUTH_SESSION_TTL_HOURS=12
AUTH_MAX_ACTIVE_SESSIONS=5
AUTH_COOKIE_SAME_SITE=lax
AUTH_COOKIE_SECURE=true
AUTH_ALLOW_MISSING_ORIGIN=false
AUTH_ALLOWED_ORIGINS=https://YOUR-VERCEL-DOMAIN.vercel.app
UPLOAD_MAX_BYTES=26214400
UPLOAD_ALLOWED_IMAGE_MIME_TYPES=image/png,image/jpeg,image/webp,image/gif
UPLOAD_ALLOWED_VIDEO_MIME_TYPES=video/mp4,video/webm
UPLOAD_ALLOWED_FILE_MIME_TYPES=application/pdf,text/plain
STORAGE_PROVIDER=local
LOCAL_UPLOADS_DIR=uploads
LOCAL_UPLOADS_PUBLIC_PREFIX=/uploads
LOG_HTTP_REQUESTS=true
LOG_ERROR_STACKS=false
```

Optional:

```env
LOG_FILE_PATH=
```

### First deploy after backend starts

Run migrations and seed once:

```bash
npx prisma migrate deploy
npm --workspace @game-game/api run prisma:seed
```

You can run these in a temporary Koyeb shell/job or locally against the same database.

## 2. Frontend On Vercel

Create a Vercel project from the same GitHub repository.

Use monorepo settings:

- Root Directory: `apps/web`
- `apps/web/vercel.json` is already included in the repo

Build command:

```bash
npm install && npm run build
```

Install command:

```bash
npm install
```

### Frontend env

Set these on Vercel:

```env
NEXT_PUBLIC_API_URL=https://YOUR-KOYEB-BACKEND-DOMAIN/api
NEXT_PUBLIC_SOCKET_URL=https://YOUR-KOYEB-BACKEND-DOMAIN
```

After Vercel gives you a production URL, add that URL into backend env:

```env
AUTH_ALLOWED_ORIGINS=https://YOUR-VERCEL-DOMAIN.vercel.app
```

Then redeploy backend.

## 3. Minimum Release Flow

1. Deploy backend on Koyeb
2. Apply migrations
3. Seed baseline data
4. Deploy frontend on Vercel
5. Update backend `AUTH_ALLOWED_ORIGINS` with the Vercel URL
6. Redeploy backend
7. Verify:
   - `GET /api/health/details`
   - login
   - join flow
   - trainer page
   - admin page

## 4. Test Credentials

After seed:

- `admin@example.com / admin123`
- `trainer@example.com / trainer123`

Replace these before a real production rollout.

## 5. Notes

- `STORAGE_PROVIDER=local` is acceptable for testing, but uploaded files live on the backend instance filesystem.
- If Koyeb restarts or replaces the instance, local uploads may be lost.
- For durable production storage, switch later to `s3`.
- If your frontend uses a custom domain, add that exact origin to `AUTH_ALLOWED_ORIGINS`.
