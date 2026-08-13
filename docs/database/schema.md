# FaceAttend — Database Schema Reference

> This document is updated as migrations are applied in each phase.
> Database: PostgreSQL 16

## Core Tables

### users
Primary authentication table. Extended by `students` and `faculty`.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| email | VARCHAR (unique) | Login identifier |
| password_hash | VARCHAR | argon2 / bcrypt |
| role | ENUM | STUDENT, FACULTY, DEPARTMENT_ADMIN, SUPER_ADMIN |
| status | ENUM | ACTIVE, INACTIVE, SUSPENDED |
| is_active | BOOLEAN | Django standard |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |
| last_login | TIMESTAMP | |

### students
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | FK → users | OneToOne |
| student_id | VARCHAR (unique) | University roll number |
| full_name | VARCHAR | |
| phone | VARCHAR | |
| department_id | FK → departments | |
| semester_id | FK → semesters | |
| section_id | FK → sections | |
| approval_status | ENUM | PENDING, APPROVED, REJECTED, SUSPENDED |
| approved_by | FK → users (nullable) | |
| approved_at | TIMESTAMP (nullable) | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### faculty
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | FK → users | OneToOne |
| employee_id | VARCHAR (unique) | |
| full_name | VARCHAR | |
| department_id | FK → departments | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### departments
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| name | VARCHAR | |
| code | VARCHAR (unique) | e.g., BCA, MCA |
| description | TEXT | |
| status | ENUM | ACTIVE, INACTIVE |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### semesters
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| name | VARCHAR | e.g., Semester 3 |
| academic_year | VARCHAR | e.g., 2025-26 |
| start_date | DATE | |
| end_date | DATE | |
| status | ENUM | ACTIVE, INACTIVE, COMPLETED |

### sections
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| name | VARCHAR | e.g., BCA 2A |
| department_id | FK → departments | |
| semester_id | FK → semesters | |
| capacity | INTEGER | |

### subjects
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| name | VARCHAR | |
| code | VARCHAR (unique) | |
| department_id | FK → departments | |
| semester_id | FK → semesters | |
| credits | INTEGER | |
| status | ENUM | ACTIVE, INACTIVE |

### rooms
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| name | VARCHAR | |
| building | VARCHAR | |
| floor | INTEGER | |
| capacity | INTEGER | |
| latitude | DECIMAL (nullable) | Reference only |
| longitude | DECIMAL (nullable) | Reference only |
| status | ENUM | ACTIVE, INACTIVE |

### timetable_entries
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| subject_id | FK → subjects | |
| faculty_id | FK → faculty | |
| section_id | FK → sections | |
| room_id | FK → rooms | |
| day_of_week | ENUM | MON–SUN |
| start_time | TIME | |
| end_time | TIME | |
| status | ENUM | ACTIVE, INACTIVE |

### enrollments
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| student_id | FK → students | |
| subject_id | FK → subjects | |
| semester_id | FK → semesters | |
| status | ENUM | ACTIVE, DROPPED |
| created_at | TIMESTAMP | |
| UNIQUE | (student_id, subject_id, semester_id) | No duplicate enrollments |

### face_profiles
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| student_id | FK → students (unique) | OneToOne |
| embedding | JSON / BINARY | Face vector — never expose to frontend |
| model_version | VARCHAR | Tracks which model version generated this |
| status | ENUM | PENDING, ACTIVE, INACTIVE |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### attendance_sessions
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| timetable_entry_id | FK → timetable_entries | |
| faculty_id | FK → faculty | |
| subject_id | FK → subjects | |
| section_id | FK → sections | |
| room_id | FK → rooms | |
| challenge | VARCHAR | Short-lived random token |
| started_at | TIMESTAMP | |
| expires_at | TIMESTAMP | |
| status | ENUM | CREATED, ACTIVE, EXPIRED, CLOSED, CANCELLED |
| created_at | TIMESTAMP | |

### attendance_records
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| attendance_session_id | FK → attendance_sessions | |
| student_id | FK → students | |
| status | ENUM | PRESENT, ABSENT, LATE, EXCUSED, MANUALLY_CORRECTED |
| verification_status | ENUM | VERIFIED, FAILED, SUSPICIOUS |
| marked_at | TIMESTAMP | |
| verification_metadata | JSON | Location accuracy, face score, etc. |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |
| UNIQUE | (attendance_session_id, student_id) | Duplicate prevention at DB level |

### verification_attempts
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| student_id | FK → students | |
| attendance_session_id | FK → attendance_sessions | |
| face_result | ENUM | MATCH, MISMATCH, NO_FACE, MULTIPLE_FACES, ERROR |
| liveness_result | ENUM | PASSED, FAILED, SKIPPED |
| location_result | ENUM | VALID, OUTSIDE_GEOFENCE, UNAVAILABLE, DENIED, UNRELIABLE |
| challenge_result | ENUM | VALID, EXPIRED, INVALID |
| final_result | ENUM | SUCCESS, FAILED |
| failure_reason | VARCHAR (nullable) | Error code |
| created_at | TIMESTAMP | |

### notifications
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | FK → users | |
| type | ENUM | See notification categories |
| title | VARCHAR | |
| message | TEXT | |
| is_read | BOOLEAN | |
| created_at | TIMESTAMP | |

### audit_logs
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| actor_id | FK → users | Who performed the action |
| action | VARCHAR | APPROVE_STUDENT, REJECT_STUDENT, etc. |
| entity_type | VARCHAR | students, attendance_records, etc. |
| entity_id | VARCHAR | PK of the affected entity |
| old_value | JSON (nullable) | Before state |
| new_value | JSON (nullable) | After state |
| reason | TEXT (nullable) | Provided justification |
| ip_address | INET | |
| user_agent | TEXT | |
| created_at | TIMESTAMP | Immutable — no updates allowed |
