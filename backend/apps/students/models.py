"""
FaceAttend — Student Model (Phase 2)

Phase 2 stores department/semester/section as text fields.
Phase 3 will add proper FK models (Department, Semester, Section)
and migrate these to foreign key relationships.
"""
import uuid
from django.db import models
from django.conf import settings


class ApprovalStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"
    SUSPENDED = "SUSPENDED", "Suspended"


class Student(models.Model):
    """
    Student profile linked to a User account.
    Created automatically during student self-registration.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="student_profile",
    )

    # Student identification
    student_id = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="University roll number or student ID.",
    )
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20, blank=True)

    # Academic placement — Phase 2 uses text; Phase 3 replaces with FKs
    department_name = models.CharField(
        max_length=100,
        help_text="Department name (text — will be linked to Department model in Phase 3).",
    )
    semester_name = models.CharField(
        max_length=50,
        help_text="Semester name (text — will be linked to Semester model in Phase 3).",
    )
    section_name = models.CharField(
        max_length=50,
        help_text="Section name (text — will be linked to Section model in Phase 3).",
    )

    # Approval workflow
    approval_status = models.CharField(
        max_length=20,
        choices=ApprovalStatus.choices,
        default=ApprovalStatus.PENDING,
        db_index=True,
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_students",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "students"
        verbose_name = "Student"
        verbose_name_plural = "Students"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.full_name} ({self.student_id})"

    @property
    def is_approved(self):
        return self.approval_status == ApprovalStatus.APPROVED

    @property
    def is_pending(self):
        return self.approval_status == ApprovalStatus.PENDING

    @property
    def is_rejected(self):
        return self.approval_status == ApprovalStatus.REJECTED
