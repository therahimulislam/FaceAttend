# FaceAttend

**Smart Attendance. Verified Presence.**

FaceAttend is a production-oriented web application and Progressive Web App (PWA) for university attendance management. It uses facial recognition, liveness detection, GPS campus geofencing, and faculty-controlled attendance sessions to verify that the correct student is physically present on campus during the correct class.

---

## The Core Problem

A basic facial-recognition attendance website has a critical weakness:

> A student could sit at home, open the website, show their face, and potentially mark attendance.

FaceAttend solves this by requiring all three conditions to pass simultaneously before recording attendance:

| Question | Technology |
|----------|-----------|
| **WHO** — Is this the registered student? | Facial recognition + liveness detection |
| **WHERE** — Is the student on campus? | GPS geofencing (browser geolocation) |
| **WHEN** — Is this the right class and time? | Timetable + faculty attendance session |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| State & Data | TanStack Query, Zustand |
| Animations | Framer Motion |
| Charts | Recharts |
| PWA | vite-plugin-pwa |
| Backend | Python 3.12, Django 5, Django REST Framework |
| Real-time | Django Channels (WebSocket) |
| Background jobs | Celery |
| ASGI server | Daphne |
| Database | PostgreSQL 16 |
| Cache / Queue | Redis 7 / Valkey |
| Computer Vision | MediaPipe + face-api.js (browser-side) |
| Infrastructure | Docker, Docker Compose |

---

## User Roles

| Role | Description |
|------|-------------|
| **STUDENT** | Register, enroll face, mark attendance, view attendance history |
| **FACULTY** | Start attendance sessions, monitor live attendance, view reports |
| **DEPARTMENT_ADMIN** | Approve students, manage academics, view department reports |
| **SUPER_ADMIN** | Full system access, audit logs, system configuration |

---

## Quick Start

### Prerequisites

- Docker Desktop ≥ 4.x
- Docker Compose ≥ 2.x

### Setup

```bash
# Clone
git clone <repository-url>
cd faceattend

# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Start all services
docker compose up

# In a separate terminal — create a super admin
docker compose exec backend python manage.py createsuperuser
```

### Access

| Service | URL |
|---------|-----|
| Frontend (React) | http://localhost:5173 |
| Backend API | http://localhost:8000/api/v1/ |
| Django Admin | http://localhost:8000/admin/ |

---

## Architecture

```
React PWA (Browser)
       │
       │  HTTPS — REST API + WebSocket
       ▼
Django + DRF + Django Channels (ASGI / Daphne)
       │
       ├── PostgreSQL 16    — Primary data store
       ├── Redis 7          — Cache, Celery broker, Channels layer
       └── Celery           — Background tasks
```

The backend is the **final authority** for all attendance decisions. The frontend collects data (GPS coordinates, face embeddings, session challenge) and submits it to the backend. The backend independently validates every claim.

---

## Attendance Verification Pipeline

```
Student Attendance Request
          │
     [1] Account approved?
     [2] Correct timetable slot?
     [3] Faculty session active?
     [4] Session not expired?
     [5] GPS within campus geofence?
     [6] Exactly one face detected?
     [7] Liveness check passed?
     [8] Face matches enrolled student?
     [9] Dynamic challenge valid?
    [10] Not already marked?
          │
    ATTENDANCE RECORDED ✓
```

Any failing step returns a specific error code and the attempt is logged.

---

## Fraud Defense

| Attack | Rejected at | Reason |
|--------|-------------|--------|
| Student marks from home | Step 5 | GPS outside geofence |
| Friend marks for student | Step 8 | Face mismatch |
| Photo held up to camera | Step 7 | Liveness check failed |
| Old session screenshot | Step 9 | Challenge expired |
| Wrong subject | Step 2 | Timetable mismatch |
| Marking twice | Step 10 | Duplicate prevention |

---

## Project Structure

```
faceattend/
├── frontend/            # React PWA
├── backend/             # Django API
│   ├── config/          # Django settings
│   └── apps/
│       ├── accounts/    # Users, JWT auth, roles
│       ├── students/    # Student profiles, approval
│       ├── faculty/     # Faculty profiles
│       ├── departments/ # Depts, semesters, sections, rooms
│       ├── academics/   # Subjects, enrollments
│       ├── timetable/   # Timetable entries
│       ├── attendance/  # Sessions, records, duplicate enforcement
│       ├── verification/# GPS, face, liveness validation
│       ├── notifications/
│       ├── analytics/
│       ├── audit/
│       └── common/      # Shared utilities
├── docs/                # Architecture, API, DB schema, setup
├── docker/              # Dockerfiles
├── tests/               # Integration and E2E tests
└── docker-compose.yml
```

---

## Development Phases

| Phase | Name | Status |
|-------|------|--------|
| 0 | Planning & Repository Foundation | ✅ Complete |
| 1 | Project Setup | ⬜ Pending |
| 2 | Authentication | ⬜ Pending |
| 3 | Student & User Management | ⬜ Pending |
| 4 | Academic Management | ⬜ Pending |
| 5 | Timetable | ⬜ Pending |
| 6 | Faculty Attendance Sessions | ⬜ Pending |
| 7 | Student Attendance UI | ⬜ Pending |
| 8 | GPS Geofence | ⬜ Pending |
| 9 | Face Enrollment | ⬜ Pending |
| 10 | Face Recognition | ⬜ Pending |
| 11 | Liveness Detection | ⬜ Pending |
| 12 | Complete Verification Pipeline | ⬜ Pending |
| 13 | Real-Time Attendance | ⬜ Pending |
| 14 | Dashboards | ⬜ Pending |
| 15 | Reports | ⬜ Pending |
| 16 | Notifications | ⬜ Pending |
| 17 | Audit & Security | ⬜ Pending |
| 18 | AI Intelligence | ⬜ Pending |
| 19 | PWA | ⬜ Pending |
| 20 | Production Deployment | ⬜ Pending |

---

## Deployment

| Service | Platform | Notes |
|---------|----------|-------|
| Frontend (React PWA) | **Vercel** | Auto-deploys from `frontend/` directory |
| Backend API (Django) | **Render** | Web service — Daphne ASGI |
| Celery Worker | **Render** | Background worker service |
| PostgreSQL | **Supabase** | Managed PostgreSQL — external to Render |
| Redis | **Render** | Managed Redis instance |

- Local development uses Docker Compose (PostgreSQL runs in a local container).
- `render.yaml` defines the Render Blueprint (web service, worker, Redis — no Render DB).
- `DATABASE_URL` is set manually in Render using the Supabase connection string.
- `frontend/vercel.json` configures SPA routing, security headers, and asset caching.

See [Deployment Guide](docs/development/deployment.md) for step-by-step instructions.

---

## Documentation

- [System Architecture](docs/architecture/system-overview.md)
- [API Endpoints](docs/api/endpoints.md)
- [Database Schema](docs/database/schema.md)
- [Development Setup](docs/development/setup.md)
- [Deployment Guide](docs/development/deployment.md)

---

## Security Notes

- The backend validates all attendance claims independently — the frontend is never trusted for security decisions.
- Face embeddings are stored server-side only and never transmitted to the frontend.
- Raw camera footage is not stored.
- All sensitive actions are recorded in the audit log.
- Duplicate attendance is prevented at both application and database level (unique constraint).
- All attendance sessions expire server-side after a configurable duration.

---

## License

Private. All rights reserved.
