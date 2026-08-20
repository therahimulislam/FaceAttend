"""
FaceAttend — Phase 16: Notification Model
"""
import uuid
from django.db import models
from django.conf import settings


class NotificationCategory(models.TextChoices):
    REGISTRATION_APPROVED = "REGISTRATION_APPROVED", "Registration Approved"
    REGISTRATION_REJECTED = "REGISTRATION_REJECTED", "Registration Rejected"
    ATTENDANCE_SUCCESS    = "ATTENDANCE_SUCCESS",    "Attendance Success"
    ATTENDANCE_FAILED     = "ATTENDANCE_FAILED",     "Attendance Failed"
    LOW_ATTENDANCE        = "LOW_ATTENDANCE",        "Low Attendance"
    UPCOMING_CLASS        = "UPCOMING_CLASS",        "Upcoming Class"
    SUSPICIOUS_ATTEMPT    = "SUSPICIOUS_ATTEMPT",    "Suspicious Attempt"


class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
        db_index=True,
    )
    category = models.CharField(
        max_length=30,
        choices=NotificationCategory.choices,
        db_index=True,
    )
    title = models.CharField(max_length=150)
    body = models.TextField()
    is_read = models.BooleanField(default=False, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "is_read"]),
            models.Index(fields=["recipient", "created_at"]),
        ]

    def __str__(self):
        return f"[{self.category}] → {self.recipient_id} | {self.title[:40]}"
