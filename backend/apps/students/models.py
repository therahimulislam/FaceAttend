"""
FaceAttend — Student Model (Phase 3 — FK fields added)

The text fields (department_name, semester_name, section_name) from Phase 2
are kept for reference. The FK fields are the source of truth going forward.
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
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="student_profile",
    )
    student_id = models.CharField(max_length=50, unique=True, db_index=True)
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20, blank=True)

    # --- FK fields (Phase 3) — source of truth ---
    department = models.ForeignKey(
        "departments.Department",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="students",
    )
    semester = models.ForeignKey(
        "academics.Semester",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="students",
    )
    section = models.ForeignKey(
        "academics.Section",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="students",
    )

    # --- Text fields (Phase 2 legacy — kept for reference during registration) ---
    department_name = models.CharField(max_length=100, blank=True)
    semester_name = models.CharField(max_length=50, blank=True)
    section_name = models.CharField(max_length=50, blank=True)

    # Approval workflow
    approval_status = models.CharField(
        max_length=20, choices=ApprovalStatus.choices,
        default=ApprovalStatus.PENDING, db_index=True,
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="approved_students",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "students"
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

    @property
    def display_department(self):
        """Return department name from FK or fallback to text field."""
        if self.department:
            return self.department.name
        return self.department_name

    @property
    def display_semester(self):
        if self.semester:
            return self.semester.name
        return self.semester_name

    @property
    def display_section(self):
        if self.section:
            return self.section.name
        return self.section_name
