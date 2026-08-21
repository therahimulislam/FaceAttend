"""
FaceAttend — Phase 17: Audit Log Model
"""
import uuid
from django.db import models
from django.conf import settings


class AuditEventType(models.TextChoices):
    STUDENT_APPROVED      = "STUDENT_APPROVED",      "Student Approved"
    STUDENT_REJECTED      = "STUDENT_REJECTED",      "Student Rejected"
    ATTENDANCE_CORRECTION = "ATTENDANCE_CORRECTION", "Attendance Correction"
    ROLE_CHANGE           = "ROLE_CHANGE",           "Role Change"
    SUBJECT_CHANGE        = "SUBJECT_CHANGE",        "Subject Change"
    TIMETABLE_CHANGE      = "TIMETABLE_CHANGE",      "Timetable Change"
    SECURITY_EVENT        = "SECURITY_EVENT",        "Security Event"
    SUSPICIOUS_ATTEMPT    = "SUSPICIOUS_ATTEMPT",    "Suspicious Attempt"


class AuditSeverity(models.TextChoices):
    INFO     = "INFO",     "Info"
    WARNING  = "WARNING",  "Warning"
    CRITICAL = "CRITICAL", "Critical"


class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    event_type = models.CharField(
        max_length=30,
        choices=AuditEventType.choices,
        db_index=True,
    )
    severity = models.CharField(
        max_length=10,
        choices=AuditSeverity.choices,
        default=AuditSeverity.INFO,
        db_index=True,
    )

    # Who performed the action (nullable — system-generated events have no actor)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_actions",
        db_index=True,
    )
    # Who was affected (student being approved, etc.)
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_targets",
    )

    description = models.TextField()

    # Before/after snapshots for corrections and changes
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)

    # Request metadata
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default="")

    # Extra structured data (student_id, subject_code, etc.)
    metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["event_type", "created_at"]),
            models.Index(fields=["actor", "created_at"]),
            models.Index(fields=["severity", "created_at"]),
        ]

    def __str__(self):
        actor_str = str(self.actor_id) if self.actor_id else "system"
        return f"[{self.event_type}] {actor_str} — {self.description[:60]}"
