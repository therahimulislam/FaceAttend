# FaceAttend — API Endpoints Reference

> This document is a living specification. It will be updated as each phase is implemented.
> Base URL: `/api/v1/`

## Standard Response Envelope

```json
// Success
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": {}
}

// Error
{
  "success": false,
  "message": "Human-readable error message.",
  "code": "ERROR_CODE"
}
```

## Authentication Endpoints

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| POST | `/auth/register/` | None | Student self-registration |
| POST | `/auth/login/` | None | Login → returns JWT pair |
| POST | `/auth/logout/` | Required | Blacklist refresh token |
| POST | `/auth/refresh/` | None | Refresh access token |
| POST | `/auth/forgot-password/` | None | Send password reset email |
| POST | `/auth/reset-password/` | None | Confirm reset with token |

## Student Endpoints

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| GET | `/students/me/` | Student | Own profile |
| PATCH | `/students/me/` | Student | Update own profile |
| GET | `/students/me/timetable/` | Student | Own timetable |
| GET | `/students/me/attendance/` | Student | Own attendance summary |
| GET | `/students/me/attendance/:subjectId/` | Student | Subject-specific attendance |

## Face Endpoints

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| POST | `/face/enrollment/` | Student | Submit face enrollment data |
| GET | `/face/enrollment/status/` | Student | Enrollment status |
| POST | `/face/verify/` | Student | Verify face during attendance |

## Attendance Endpoints

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| GET | `/attendance/current/` | Student | Get currently active class |
| POST | `/attendance/verify/` | Student | Submit full attendance verification |
| GET | `/attendance/history/` | Student | Own attendance history |
| GET | `/attendance/:id/` | Student/Faculty | Single attendance record |
| POST | `/attendance/sessions/` | Faculty | Start attendance session |
| GET | `/attendance/sessions/:id/` | Faculty | Session status |
| POST | `/attendance/sessions/:id/close/` | Faculty | Close session |
| GET | `/attendance/sessions/:id/records/` | Faculty | Live session records |

## Timetable Endpoints

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| GET | `/timetable/` | Any auth | Timetable list |
| POST | `/timetable/` | Admin | Create entry |
| PATCH | `/timetable/:id/` | Admin | Update entry |
| DELETE | `/timetable/:id/` | Admin | Delete entry |

## Admin Endpoints

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| GET | `/admin/students/pending/` | Admin | Pending registrations |
| POST | `/admin/students/:id/approve/` | Admin | Approve student |
| POST | `/admin/students/:id/reject/` | Admin | Reject student |
| GET | `/admin/students/` | Admin | All students |
| POST | `/admin/faculty/` | Admin | Create faculty |
| GET | `/admin/departments/` | Admin | List departments |
| POST | `/admin/departments/` | Admin | Create department |
| GET | `/admin/subjects/` | Admin | List subjects |
| POST | `/admin/subjects/` | Admin | Create subject |

## Report Endpoints

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| GET | `/reports/student/:id/` | Admin/Faculty | Student attendance report |
| GET | `/reports/subject/:id/` | Admin/Faculty | Subject attendance report |
| GET | `/reports/department/:id/` | Admin | Department report |

## Audit Endpoints

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| GET | `/audit-logs/` | Super Admin | All audit logs |

## Standard Error Codes

```
AUTH_INVALID_CREDENTIALS
AUTH_ACCOUNT_PENDING
AUTH_ACCOUNT_REJECTED
AUTH_ACCOUNT_SUSPENDED
AUTH_TOKEN_EXPIRED
AUTH_UNAUTHORIZED

ATTENDANCE_SESSION_EXPIRED
ATTENDANCE_SESSION_NOT_ACTIVE
ATTENDANCE_ALREADY_MARKED
ATTENDANCE_NO_ACTIVE_CLASS

LOCATION_PERMISSION_DENIED
LOCATION_UNAVAILABLE
LOCATION_OUTSIDE_GEOFENCE
LOCATION_UNRELIABLE

FACE_NOT_DETECTED
FACE_MULTIPLE_DETECTED
FACE_MISMATCH
FACE_NOT_ENROLLED

LIVENESS_FAILED

CHALLENGE_EXPIRED
CHALLENGE_INVALID

VALIDATION_ERROR
PERMISSION_DENIED
NOT_FOUND
SERVER_ERROR
```
