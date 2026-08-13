# FaceAttend — Deployment Guide

## Deployment Architecture

| Environment | Frontend | Backend | Database | Cache |
|-------------|----------|---------|----------|-------|
| **Development** | Vite dev server (localhost:5173) | Daphne (localhost:8000) | PostgreSQL in Docker | Redis in Docker |
| **Production** | Vercel | Render (web service) | **Supabase** (PostgreSQL) | Render Redis |

Docker Compose is **only** used for local development. Production uses managed cloud services.

---

## 1. Database → Supabase

Supabase provides managed PostgreSQL. Django connects via a standard `DATABASE_URL`.

### Setup

1. Go to [supabase.com](https://supabase.com) and click **New Project**.
2. Choose a name (e.g., `faceattend`), set a strong database password, and pick a region close to your Render region (Oregon → US West).
3. Wait for the project to provision (~2 minutes).
4. Go to **Project Settings → Database → Connection string**.

### Connection Strings

Supabase provides two types of connection:

| Type | Port | Use for |
|------|------|---------|
| **Direct** | 5432 | Migrations (Django `manage.py migrate`) |
| **Transaction Pooler** | 6543 | Production app traffic (recommended) |
| **Session Pooler** | 5432 (different host) | If transaction pooler causes issues with Django |

> **Recommendation for FaceAttend (Render):**
> - Set `DATABASE_URL` to the **Transaction Pooler** URL (`port 6543`).
> - Run migrations using the **Direct** URL only (one-off Render job or via local machine connected to Supabase).

### Finding your connection strings

In Supabase dashboard:
- **Settings → Database → Connection string → URI**
- Toggle between "Direct connection" and "Connection pooling"

Direct connection URL format:
```
postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

Transaction pooler URL format:
```
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

> **Important:** Replace `[YOUR-PASSWORD]` and `[PROJECT-REF]` with your actual values. Never commit these to git.

### Supabase + Django Notes

- Supabase PostgreSQL is fully compatible with Django — no special packages needed.
- Django's `psycopg2` (or `psycopg2-binary`) works without modification.
- The transaction pooler does not support prepared statements. Add `?options=--no-prepared-statements` to the URL, or use `DISABLE_SERVER_SIDE_CURSORS=True` in Django database settings. This will be configured in the production settings (Phase 20).
- For local development, the Docker Compose PostgreSQL is used — no Supabase dependency locally.

---

## 2. Frontend → Vercel

### First-time Setup

1. Push your repository to GitHub.
2. Go to [vercel.com](https://vercel.com) → **Add New Project**.
3. Import your repository.
4. Set the **Root Directory** to `frontend/`.
5. Vercel auto-detects Vite. Build settings:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm ci`

### Environment Variables (Vercel Dashboard → Settings → Environment Variables)

| Variable | Example Value | Description |
|----------|--------------|-------------|
| `VITE_API_BASE_URL` | `https://faceattend-api.onrender.com/api/v1` | Backend API URL |
| `VITE_WS_BASE_URL` | `wss://faceattend-api.onrender.com/ws` | WebSocket URL |
| `VITE_APP_NAME` | `FaceAttend` | App name |
| `VITE_APP_TAGLINE` | `Smart Attendance. Verified Presence.` | Tagline |
| `VITE_FEATURE_FACE_RECOGNITION` | `true` | Enable face recognition |
| `VITE_FEATURE_LIVENESS_DETECTION` | `true` | Enable liveness |
| `VITE_FEATURE_GPS_VERIFICATION` | `true` | Enable GPS |

> `frontend/vercel.json` handles SPA routing (React Router), security headers, and asset caching.

---

## 3. Backend → Render

### Automatic Deployment via Blueprint

The `render.yaml` in the repository root defines all backend services.

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **New** → **Blueprint**
3. Connect your GitHub repository
4. Render reads `render.yaml` and creates:
   - `faceattend-api` — Django web service (Daphne ASGI)
   - `faceattend-celery` — Celery worker
   - `faceattend-redis` — Redis managed instance

### Required Environment Variables (Set Manually in Render Dashboard)

After blueprint deployment, go to **faceattend-api → Environment** and set:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | Supabase transaction pooler URL | From Supabase Project Settings → Database |
| `SECRET_KEY` | Long random string | `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `ALLOWED_HOSTS` | `faceattend-api.onrender.com` | Add custom domain if any |
| `CORS_ALLOWED_ORIGINS` | `https://faceattend.vercel.app` | Your Vercel URL |
| `CAMPUS_LATITUDE` | e.g. `12.9716` | Campus center latitude |
| `CAMPUS_LONGITUDE` | e.g. `77.5946` | Campus center longitude |
| `CAMPUS_GEOFENCE_RADIUS_METERS` | e.g. `500` | Allowed radius in metres |
| `EMAIL_BACKEND` | `django.core.mail.backends.smtp.EmailBackend` | |
| `EMAIL_HOST` | `smtp.gmail.com` | |
| `EMAIL_PORT` | `587` | |
| `EMAIL_USE_TLS` | `True` | |
| `EMAIL_HOST_USER` | your email | |
| `EMAIL_HOST_PASSWORD` | SMTP App Password | |
| `DEFAULT_FROM_EMAIL` | `FaceAttend <noreply@yourdomain.com>` | |

> `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, and `DJANGO_CHANNELS_LAYER_URL` are auto-injected from `faceattend-redis` — do not set manually.

### Running Migrations Against Supabase

Migrations must run against the **direct connection** (not the pooler) to avoid prepared statement issues during schema changes.

**Option A — Run from Render (one-off job):**

In the Render dashboard → `faceattend-api` → **Shell**:
```bash
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
python manage.py migrate
```

**Option B — Run from local machine:**
```bash
cd backend
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
python manage.py migrate
```

The `render.yaml` build command runs `migrate --noinput` using whatever `DATABASE_URL` is set, so for initial deploy set the **direct URL**, then switch to the **pooler URL** after migrations are done.

---

## Service Summary

| Service | Platform | Cost | Notes |
|---------|----------|------|-------|
| Frontend | Vercel | Free | 100GB bandwidth/month |
| Backend API | Render | Free / $7 | Free spins down after 15min |
| Celery Worker | Render | Free | Free tier available |
| Redis | Render | Free | 25MB RAM on free tier |
| PostgreSQL | Supabase | Free | 500MB, 2 projects on free tier |

### Render Free Plan Limitation

> Render free web services spin down after 15 minutes of inactivity. WebSocket connections will be dropped on spin-down. Use the **Starter plan ($7/month)** for always-on production.

---

## CORS Configuration

The Render backend must allow requests from Vercel:

```
CORS_ALLOWED_ORIGINS=https://faceattend.vercel.app
```

With custom domain:
```
CORS_ALLOWED_ORIGINS=https://faceattend.vercel.app,https://yourdomain.com
```

---

## Deployment Checklist

- [ ] Supabase project created and connection strings obtained
- [ ] `SECRET_KEY` is a long random string (never the development default)
- [ ] `DATABASE_URL` is set to Supabase transaction pooler URL in Render
- [ ] Migrations run successfully against Supabase direct connection
- [ ] `ALLOWED_HOSTS` includes the Render domain
- [ ] `CORS_ALLOWED_ORIGINS` includes the Vercel domain
- [ ] Campus coordinates set correctly
- [ ] Email SMTP configured
- [ ] All feature flags enabled (`VITE_FEATURE_*=true`) in Vercel env vars
- [ ] `GET /api/v1/health/` returns 200 after Render deploy
- [ ] Frontend deployed to Vercel and loads correctly
- [ ] API calls from Vercel to Render succeed (check browser console for CORS errors)
