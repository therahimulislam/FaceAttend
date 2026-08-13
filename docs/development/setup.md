# FaceAttend — Development Setup Guide

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Docker Desktop | ≥ 4.x | Container runtime |
| Docker Compose | ≥ 2.x | Multi-container orchestration |
| Node.js | ≥ 20.x | Frontend development (optional without Docker) |
| Python | ≥ 3.12 | Backend development (optional without Docker) |
| Git | Any | Version control |

## Quick Start (Docker — Recommended)

```bash
# 1. Clone the repository
git clone <repository-url>
cd faceattend

# 2. Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Edit backend/.env — update database credentials and SECRET_KEY
#    (defaults work for local development)

# 4. Start all services
docker compose up

# 5. Open the application
#    Frontend: http://localhost:5173
#    Backend API: http://localhost:8000/api/v1/
#    Django Admin: http://localhost:8000/admin/
```

## Create a Super Admin

```bash
docker compose exec backend python manage.py createsuperuser
```

## Local Development (Without Docker)

### Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements/development.txt

# Copy and configure environment
cp .env.example .env
# Edit .env: set POSTGRES_HOST=localhost, REDIS_URL=redis://localhost:6379/0

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Start backend (development server with ASGI)
daphne -b 127.0.0.1 -p 8000 config.asgi:application

# In a separate terminal: start Celery worker
celery -A config worker --loglevel=info
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy environment
cp .env.example .env
# Edit .env: VITE_API_BASE_URL=http://localhost:8000/api/v1

# Start Vite dev server
npm run dev
```

## Service Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend (Vite) | 5173 | http://localhost:5173 |
| Backend (Django/Daphne) | 8000 | http://localhost:8000 |
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |

## Useful Commands

```bash
# View logs for a specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db

# Run Django management commands
docker compose exec backend python manage.py <command>

# Open psql shell
docker compose exec db psql -U faceattend_user -d faceattend

# Open Redis CLI
docker compose exec redis redis-cli

# Run Django tests
docker compose exec backend python manage.py test

# Apply migrations
docker compose exec backend python manage.py migrate

# Create migrations
docker compose exec backend python manage.py makemigrations

# Django shell
docker compose exec backend python manage.py shell
```

## Branch Strategy

```
main          — production-ready code only
develop       — integration branch
feature/*     — feature development
fix/*         — bug fixes
```

## Commit Convention

```
feat: add student registration
fix: resolve timetable overlap validation
refactor: extract geofence logic to service
test: add duplicate attendance prevention tests
security: add rate limiting to attendance endpoint
docs: update API endpoints reference
chore: update dependencies
```
