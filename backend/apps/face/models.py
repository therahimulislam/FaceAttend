"""
FaceAttend — Face Enrollment Models (Phase 9)

FaceEnrollment:
  Each student can have one active face enrollment.
  A face enrollment stores the 128/512-d embedding vector (JSON) derived from
  a reference image. At recognition time (Phase 10) the live frame's embedding
  is compared against this stored vector using cosine similarity.

Design decisions:
  - One ACTIVE enrollment per student (new enrollment replaces old)
  - Image stored in media/face_enrollments/{student_id}/
  - Embedding stored as JSONField (list of floats)
  - Created/reviewed timestamps for audit trail
  - Admin can manually revoke (is_active=False) without deleting
"""
import uuid
from django.conf import settings
from django.db import models


def enrollment_upload_path(instance, filename):
    """Store reference images by student ID for easy audit."""
    ext = filename.rsplit(".", 1)[-1].lower()
    return f"face_enrollments/{instance.student.student_id}/{instance.id}.{ext}"


class EnrollmentStatus(models.TextChoices):
    PENDING   = "PENDING",   "Pending Processing"
    ACTIVE    = "ACTIVE",    "Active"
    FAILED    = "FAILED",    "Processing Failed"
    REVOKED   = "REVOKED",   "Revoked by Admin"


class FaceEnrollment(models.Model):
    """
    Stores a student's face reference image and its computed embedding vector.
    Used during attendance (Phase 10) for real-time face matching.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    student = models.OneToOneField(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="face_enrollment",
    )

    # Reference image — kept for audit/re-processing
    image = models.ImageField(
        upload_to=enrollment_upload_path,
        help_text="Clear frontal face photo (JPEG/PNG, min 200×200px).",
    )

    # 512-d InsightFace ArcFace embedding stored as a JSON list of floats
    embedding = models.JSONField(
        null=True, blank=True,
        help_text="Face embedding vector (512-d ArcFace). Null until processing succeeds.",
    )

    status = models.CharField(
        max_length=20,
        choices=EnrollmentStatus.choices,
        default=EnrollmentStatus.PENDING,
        db_index=True,
    )
    error_message = models.TextField(blank=True)

    # Who revoked (if revoked)
    revoked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="revoked_enrollments",
    )
    revoked_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "face_enrollments"
        ordering = ["-created_at"]

    def __str__(self):
        return f"FaceEnrollment({self.student.student_id}, {self.status})"

    @property
    def is_active(self):
        return self.status == EnrollmentStatus.ACTIVE
