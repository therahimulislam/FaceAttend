# FaceAttend — System Architecture Overview

## Product Summary

FaceAttend is a web-based and PWA attendance management platform for universities.
It solves the problem of remote and proxy attendance by combining multiple independent verification layers.

## Core Security Question

> How can the system verify that the correct student is physically present on campus during the correct class?

FaceAttend answers this by requiring all three conditions to pass simultaneously:

| Layer | Technology | Question answered |
|-------|-----------|------------------|
| WHO | Facial recognition + liveness detection | Is this the registered student? |
| WHERE | GPS geofencing (browser geolocation) | Is the student on campus? |
| WHEN | Timetable + faculty attendance session | Is this the right class and time? |

## Architectural Principle

**The backend is the final authority.**

The frontend collects data (GPS coordinates, face embedding, session challenge response) and submits it to the backend. The backend independently validates all claims. The frontend is never trusted to determine whether attendance is valid.

## User Roles

| Role | Primary interface | Key actions |
|------|------------------|-------------|
| STUDENT | Mobile browser / PWA | Register, enroll face, mark attendance, view records |
| FACULTY | Desktop browser | Start sessions, monitor live attendance, correct records |
| DEPARTMENT_ADMIN | Desktop browser | Approve students, manage academics, view reports |
| SUPER_ADMIN | Desktop browser | Full system access |

## System Components

```
React PWA (HTTPS)
       │
       │  REST API (JSON)
       │  WebSocket (real-time)
       ▼
Django + DRF + Django Channels (ASGI / Daphne)
       │
       ├── PostgreSQL 16 (primary data store)
       ├── Redis 7 / Valkey (cache, Celery broker, Channels layer)
       └── Celery (background tasks: session expiry, notifications)
```

## Attendance Verification Pipeline

```
Student Request
      │
      ▼
[1] Account approved? ──── NO ──→ REJECT (AUTH_ACCOUNT_PENDING)
      │ YES
      ▼
[2] Timetable valid? ────── NO ──→ REJECT (ATTENDANCE_NO_ACTIVE_CLASS)
      │ YES
      ▼
[3] Faculty session active? NO ──→ REJECT (ATTENDANCE_SESSION_NOT_ACTIVE)
      │ YES
      ▼
[4] Session not expired? ── NO ──→ REJECT (ATTENDANCE_SESSION_EXPIRED)
      │ YES
      ▼
[5] GPS inside geofence? ── NO ──→ REJECT (LOCATION_OUTSIDE_GEOFENCE)
      │ YES
      ▼
[6] Face detected (1 face)? NO ──→ REJECT (FACE_NOT_DETECTED / FACE_MULTIPLE)
      │ YES
      ▼
[7] Liveness passed? ────── NO ──→ REJECT (LIVENESS_FAILED)
      │ YES
      ▼
[8] Face matches student? ─ NO ──→ REJECT (FACE_MISMATCH)
      │ YES
      ▼
[9] Challenge valid? ────── NO ──→ REJECT (CHALLENGE_INVALID / CHALLENGE_EXPIRED)
      │ YES
      ▼
[10] Not duplicate? ─────── NO ──→ REJECT (ATTENDANCE_ALREADY_MARKED)
      │ YES
      ▼
ATTENDANCE RECORDED ✓
```

## Fraud Defense

| Attack | Failure point | Error code |
|--------|--------------|-----------|
| Student marks from home | Step 5 — GPS | LOCATION_OUTSIDE_GEOFENCE |
| Proxy (different person) | Step 8 — Face | FACE_MISMATCH |
| Photograph attack | Step 7 — Liveness | LIVENESS_FAILED |
| Old screenshot replay | Step 9 — Challenge | CHALLENGE_EXPIRED |
| Wrong subject | Step 2 — Timetable | ATTENDANCE_NO_ACTIVE_CLASS |
| Mark twice | Step 10 — Duplicate | ATTENDANCE_ALREADY_MARKED |

## Database Schema (High Level)

```
users → students / faculty
departments → semesters → sections
subjects → timetable_entries → attendance_sessions
students → enrollments → subjects
attendance_sessions → attendance_records
attendance_records → verification_attempts
all sensitive actions → audit_logs
students → face_profiles (embeddings only, no raw images)
```

## Biometric Data Policy

- Face embeddings are stored server-side only.
- Raw camera images are not stored.
- Embeddings are never transmitted to the frontend.
- Embeddings are versioned by `FACE_MODEL_VERSION` to support re-enrollment on model updates.
- In production, the embeddings column is encrypted at rest.

## API Design

Base URL: `/api/v1/`

Standard response envelope:

```json
// Success
{ "success": true, "message": "...", "data": {} }

// Error
{ "success": false, "message": "Human-readable message", "code": "ERROR_CODE" }
```

No raw stack traces are ever exposed to clients.
