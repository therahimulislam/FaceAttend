"""
FaceAttend — Attendance Models (Phase 6)

AttendanceSession  — A live class session created by faculty.
AttendanceRecord   — Per-student attendance for a session (marked in Phase 7+).

Session lifecycle:
  SCHEDULED → ACTIVE → COMPLETED
                     → CANCELLED

A session is ACTIVE during the window [valid_from, valid_until].
Students may only submit attendance while the session is ACTIVE.

Session code: unique 6-char uppercase alphanumeric code generated
at session start, used by students to locate the session.
"""
import uuid
import random
import string
from django.db import models
from django.conf import settings
from django.utils import timezone


def _generate_session_code():
    """Generate a unique 6-char uppercase session code."""
    chars = string.ascii_uppercase + string.digits
    for _ in range(20):  # retry on collision
        code = "".join(random.choices(chars, k=6))
        if not AttendanceSession.objects.filter(session_code=code).exists():
            return code
    return uuid.uuid4().hex[:6].upper()


class SessionStatus(models.TextChoices):
    SCHEDULED = "SCHEDULED", "Scheduled"
    ACTIVE = "ACTIVE", "Active"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class AttendanceSession(models.Model):
    """
    A faculty-created attendance session for a specific class.

    May be linked to a TimetableEntry (for scheduled classes) or
    created ad-hoc (for make-up classes, extra sessions, etc.).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Linked timetable slot (optional — ad-hoc sessions skip this)
    timetable_entry = models.ForeignKey(
        "timetable.TimetableEntry",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="attendance_sessions",
    )

    # Denormalized for ad-hoc sessions and for fast querying
    section = models.ForeignKey(
        "academics.Section",
        on_delete=models.CASCADE,
        related_name="attendance_sessions",
    )
    subject = models.ForeignKey(
        "academics.Subject",
        on_delete=models.CASCADE,
        related_name="attendance_sessions",
    )
    faculty = models.ForeignKey(
        "faculty.Faculty",
        on_delete=models.CASCADE,
        related_name="attendance_sessions",
    )
    room = models.ForeignKey(
        "academics.Room",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="attendance_sessions",
    )

    date = models.DateField(db_index=True)

    # Session access window
    session_code = models.CharField(
        max_length=6, unique=True, null=True, blank=True, db_index=True,
        help_text="6-char code generated at session start.",
    )
    valid_from = models.DateTimeField(
        null=True, blank=True,
        help_text="Students can mark attendance from this time.",
    )
    valid_until = models.DateTimeField(
        null=True, blank=True,
        help_text="Attendance window closes at this time.",
    )
    duration_minutes = models.PositiveSmallIntegerField(
        default=60,
        help_text="Duration of the attendance window in minutes.",
    )

    status = models.CharField(
        max_length=20,
        choices=SessionStatus.choices,
        default=SessionStatus.SCHEDULED,
        db_index=True,
    )

    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    notes = models.CharField(max_length=250, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="created_attendance_sessions",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "attendance_sessions"
        ordering = ["-date", "-started_at"]
        indexes = [
            models.Index(fields=["faculty", "date"]),
            models.Index(fields=["section", "date"]),
            models.Index(fields=["status", "date"]),
        ]

    def __str__(self):
        return f"{self.subject.code} | {self.section} | {self.date} [{self.status}]"

    # ---- Session Actions ----

    def start(self, duration_minutes=None):
        """Activate the session: generate code, open attendance window."""
        if self.status != SessionStatus.SCHEDULED:
            raise ValueError(f"Cannot start a session with status '{self.status}'.")
        now = timezone.now()
        self.session_code = _generate_session_code()
        self.status = SessionStatus.ACTIVE
        self.started_at = now
        if duration_minutes:
            self.duration_minutes = duration_minutes
        self.valid_from = now
        self.valid_until = now + timezone.timedelta(minutes=self.duration_minutes)
        self.save(update_fields=[
            "session_code", "status", "started_at",
            "valid_from", "valid_until", "duration_minutes", "updated_at",
        ])

    def end(self):
        """Complete the session and close the attendance window."""
        if self.status != SessionStatus.ACTIVE:
            raise ValueError(f"Cannot end a session with status '{self.status}'.")
        now = timezone.now()
        self.status = SessionStatus.COMPLETED
        self.ended_at = now
        self.valid_until = now  # Close window immediately
        self.save(update_fields=["status", "ended_at", "valid_until", "updated_at"])

    def cancel(self):
        """Cancel the session (before or after starting)."""
        if self.status == SessionStatus.COMPLETED:
            raise ValueError("Cannot cancel a completed session.")
        now = timezone.now()
        self.status = SessionStatus.CANCELLED
        self.ended_at = now
        self.save(update_fields=["status", "ended_at", "updated_at"])

    @property
    def is_open(self):
        """True if students can currently mark attendance."""
        if self.status != SessionStatus.ACTIVE:
            return False
        now = timezone.now()
        return (self.valid_from or now) <= now <= (self.valid_until or now)

    @property
    def attendance_count(self):
        return self.records.filter(status="PRESENT").count()

    @property
    def total_students(self):
        return self.records.count()


# ---------------------------------------------------------------------------
# Attendance Record (per-student, per-session)
# ---------------------------------------------------------------------------

class AttendanceStatus(models.TextChoices):
    PRESENT = "PRESENT", "Present"
    ABSENT = "ABSENT", "Absent"
    LATE = "LATE", "Late"
    EXCUSED = "EXCUSED", "Excused"


class VerificationMethod(models.TextChoices):
    FACE_GPS = "FACE_GPS", "Face + GPS"
    FACE = "FACE", "Face Only"
    GPS = "GPS", "GPS Only"
    MANUAL = "MANUAL", "Manual Override"
    EXEMPT = "EXEMPT", "Exempted"


class AttendanceRecord(models.Model):
    """
    Individual student attendance for a session.
    Created when a student marks attendance (Phase 7) or
    when faculty manually overrides (Phase 6 manual mark).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        AttendanceSession,
        on_delete=models.CASCADE,
        related_name="records",
    )
    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="attendance_records",
    )
    status = models.CharField(
        max_length=20,
        choices=AttendanceStatus.choices,
        default=AttendanceStatus.PRESENT,
        db_index=True,
    )
    verification_method = models.CharField(
        max_length=20,
        choices=VerificationMethod.choices,
        default=VerificationMethod.MANUAL,
    )
    face_verified = models.BooleanField(default=False)
    gps_verified = models.BooleanField(default=False)
    liveness_verified = models.BooleanField(
        default=False,
        help_text="True if the student passed the liveness challenge (Phase 11).",
    )

    marked_at = models.DateTimeField(default=timezone.now)
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="manually_marked_records",
        help_text="Null = student self-marked; set = faculty/admin override.",
    )

    # GPS coordinates at time of marking (for audit)
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)

    rejection_reason = models.CharField(
        max_length=250, blank=True,
        help_text="Reason for ABSENT or EXCUSED status.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "attendance_records"
        unique_together = [("session", "student")]
        ordering = ["-marked_at"]
        indexes = [
            models.Index(fields=["session", "status"]),
            models.Index(fields=["student", "session"]),
        ]

    def __str__(self):
        return f"{self.student} | {self.session.date} | {self.status}"
