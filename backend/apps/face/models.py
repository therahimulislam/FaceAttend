"""
FaceAttend — Face Models (Phase 9 + 11)

FaceEnrollment (Phase 9):
  Each student can have one active face enrollment.
  Stores the 512-d ArcFace embedding vector for recognition (Phase 10).

LivenessChallenge (Phase 11):
  Each attendance submit attempt issues a single-use liveness challenge.
  The challenge type (BLINK, NOD, TURN_LEFT, TURN_RIGHT) is randomized.
  A nonce + expiry prevents replay attacks.
  After the student performs the challenge and frames are verified, the
  challenge is marked liveness_verified=True and the ID is passed with
  the attendance submit request.

Design decisions:
  - One ACTIVE enrollment per student (new enrollment replaces old)
  - Image stored in media/face_enrollments/{student_id}/
  - Embedding stored as JSONField (list of floats)
  - Admin can manually revoke (status=REVOKED) without deleting
  - Challenges expire after 60 seconds and are single-use
"""
import uuid
import secrets
from datetime import timedelta
from django.conf import settings
from django.db import models
from django.utils import timezone


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


# ---------------------------------------------------------------------------
# Phase 11 — Liveness Challenge
# ---------------------------------------------------------------------------

class ChallengeType(models.TextChoices):
    BLINK       = "BLINK",       "Blink"
    NOD         = "NOD",         "Nod your head"
    TURN_LEFT   = "TURN_LEFT",   "Turn head left"
    TURN_RIGHT  = "TURN_RIGHT",  "Turn head right"


CHALLENGE_INSTRUCTIONS = {
    ChallengeType.BLINK:       "Slowly blink both eyes twice.",
    ChallengeType.NOD:         "Slowly nod your head up and down.",
    ChallengeType.TURN_LEFT:   "Slowly turn your head to the left.",
    ChallengeType.TURN_RIGHT:  "Slowly turn your head to the right.",
}

CHALLENGE_TTL_SECONDS = 60


class LivenessChallenge(models.Model):
    """
    A single-use, time-limited liveness challenge issued to a student before
    attendance submission.

    Lifecycle:
      1. POST /face/liveness/challenge/ → creates this, returns {id, type, instruction, expires_at}
      2. Student performs challenge on webcam (client-side)
      3. POST /face/liveness/verify/ with frames + challenge_id
         → sets liveness_verified=True/False, is_used=True
      4. Student includes challenge_id in attendance submit payload
      5. submit view validates the challenge was verified and not stale
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="liveness_challenges",
    )

    challenge_type = models.CharField(
        max_length=20,
        choices=ChallengeType.choices,
        default=ChallengeType.BLINK,
    )

    # Cryptographic nonce to prevent replay of identical challenge responses
    nonce = models.CharField(
        max_length=64,
        default=secrets.token_hex,
        help_text="Random 32-byte hex nonce. Single-use; prevents response replay.",
    )

    # Link to the attendance session this challenge was issued for (optional but preferred)
    session_code = models.CharField(
        max_length=6, blank=True, default="",
        help_text="Attendance session code challenge was requested for.",
        db_index=True,
    )

    expires_at = models.DateTimeField(
        help_text=f"Challenge expires {CHALLENGE_TTL_SECONDS}s after creation.",
    )

    is_used = models.BooleanField(
        default=False,
        help_text="True after the verify endpoint processes this challenge (pass or fail).",
    )

    liveness_verified = models.BooleanField(
        null=True,
        help_text="Null=pending, True=passed, False=failed.",
    )

    # Diagnostic fields — stored for audit / model tuning
    variance = models.FloatField(null=True, blank=True)
    confidence = models.FloatField(null=True, blank=True)
    frames_analyzed = models.IntegerField(null=True, blank=True)
    faces_detected = models.IntegerField(null=True, blank=True)
    fail_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "face_liveness_challenges"
        ordering = ["-created_at"]

    def __str__(self):
        return (
            f"LivenessChallenge({self.student.student_id}, "
            f"{self.challenge_type}, verified={self.liveness_verified})"
        )

    @property
    def is_expired(self) -> bool:
        return timezone.now() > self.expires_at

    @property
    def instruction(self) -> str:
        return CHALLENGE_INSTRUCTIONS.get(self.challenge_type, "Perform the requested action.")

    @classmethod
    def create_for_student(cls, student, session_code: str = "") -> "LivenessChallenge":
        """Factory: create a new randomized challenge for a student."""
        import random
        challenge_type = random.choice(list(ChallengeType.values))
        return cls.objects.create(
            student=student,
            challenge_type=challenge_type,
            session_code=session_code,
            expires_at=timezone.now() + timedelta(seconds=CHALLENGE_TTL_SECONDS),
        )
