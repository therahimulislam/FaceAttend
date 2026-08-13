# FaceAttend — Deployment Guide

## Deployment Architecture

| Environment | Frontend | Backend | Database | Cache |
|-------------|----------|---------|----------|-------|
| **Development** | Vite dev server (localhost:5173) | Daphne (localhost:8000) | PostgreSQL in Docker | Redis in Docker |
| **Production** | Vercel | Render (web service) | Render Managed PostgreSQL | Render Redis |

Docker Compose is **only** used for local development. Production uses managed cloud services.

---

## Frontend → Vercel

### First-time Setup

1. Push your repository to GitHub.
2. Go to [vercel.com](https://vercel.com) and click **Add New Project**.
3. Import your repository.
4. Set the **Root Directory** to `frontend/`.
5. Vercel will auto-detect Vite. Build settings:
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

> **Important:** The `vercel.json` in `frontend/` includes SPA routing rewrites so React Router works correctly.

### Custom Domain (Optional)

In Vercel dashboard → Settings → Domains → Add your custom domain.

---

## Backend → Render

### Automatic Deployment via Blueprint

The `render.yaml` in the repository root defines all backend services.

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **New** → **Blueprint**
3. Connect your GitHub repository
4. Render reads `render.yaml` and creates:
   - `faceattend-api` — Django web service
   - `faceattend-celery` — Celery worker
   - `faceattend-db` — PostgreSQL 16
   - `faceattend-redis` — Redis

### Required Environment Variables (Set Manually in Render Dashboard)

After blueprint deployment, go to **faceattend-api → Environment** and set:

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | Django secret key — generate with `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `ALLOWED_HOSTS` | `faceattend-api.onrender.com` (add custom domain if any) |
| `CORS_ALLOWED_ORIGINS` | `https://faceattend.vercel.app` (your Vercel URL) |
| `CAMPUS_LATITUDE` | Campus center latitude |
| `CAMPUS_LONGITUDE` | Campus center longitude |
| `CAMPUS_GEOFENCE_RADIUS_METERS` | Allowed radius in metres (e.g., `500`) |
| `EMAIL_BACKEND` | `django.core.mail.backends.smtp.EmailBackend` |
| `EMAIL_HOST` | SMTP host (e.g., `smtp.gmail.com`) |
| `EMAIL_PORT` | `587` |
| `EMAIL_USE_TLS` | `True` |
| `EMAIL_HOST_USER` | Your email address |
| `EMAIL_HOST_PASSWORD` | Your SMTP password or App Password |
| `DEFAULT_FROM_EMAIL` | `FaceAttend <noreply@yourdomain.com>` |

> `DATABASE_URL` and `REDIS_URL` are auto-injected by Render from the database/redis services — do not set these manually.

### Manual Backend Deployment (Without Blueprint)

If you prefer to configure services manually on Render:

1. **PostgreSQL** — New → PostgreSQL → free plan
2. **Redis** — New → Redis → free plan
3. **Web Service** (Django):
   - Runtime: Python 3.12
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements/production.txt && python manage.py collectstatic --noinput && python manage.py migrate --noinput`
   - Start Command: `daphne -b 0.0.0.0 -p $PORT config.asgi:application`
4. **Background Worker** (Celery):
   - Same as above but Start Command: `celery -A config worker --loglevel=info`

---

## WebSocket Support on Render

Render supports WebSocket connections natively on web services. Django Channels + Daphne works without any additional configuration.

> **Important:** The Render free plan spins down after 15 minutes of inactivity. WebSocket connections will be dropped on spin-down. Use the **Starter plan** ($7/month) for persistent connections in production.

---

## Media Files (Important Limitation)

Render free and starter plans do **not** provide persistent disk storage across deployments.

For production media storage (e.g., any admin-uploaded files), use a cloud storage provider:

- **Cloudinary** — Easiest setup, good free tier
- **AWS S3 + django-storages** — More control
- **Backblaze B2** — Cheap S3-compatible

> **Note:** Face embeddings are stored as database fields (JSON/binary), not as files, so they are not affected by this limitation.

This will be configured in **Phase 20 — Production Deployment**.

---

## CORS Configuration

Your Render backend must allow requests from your Vercel domain.

In `backend/.env` (production), set:

```
CORS_ALLOWED_ORIGINS=https://faceattend.vercel.app
```

Or if you have a custom domain:

```
CORS_ALLOWED_ORIGINS=https://faceattend.vercel.app,https://yourdomain.com
```

---

## Deployment Checklist

- [ ] `SECRET_KEY` is a long random string (never the development default)
- [ ] `DEBUG=False` in production settings
- [ ] `ALLOWED_HOSTS` includes the Render domain
- [ ] `CORS_ALLOWED_ORIGINS` includes the Vercel domain
- [ ] Campus coordinates are set
- [ ] Email SMTP is configured
- [ ] All feature flags are enabled (`VITE_FEATURE_*=true`)
- [ ] Verify `/api/v1/health/` returns 200 after deployment
