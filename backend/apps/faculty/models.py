"""
FaceAttend — Faculty Model (Phase 3)
"""
import uuid
from django.db import models
from django.conf import settings


class Faculty(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="faculty_profile",
    )
    employee_id = models.CharField(max_length=50, unique=True, db_index=True)
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20, blank=True)
    department = models.ForeignKey(
        "departments.Department",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="faculty_members",
    )
    designation = models.CharField(max_length=100, blank=True,
                                   help_text="e.g. 'Assistant Professor', 'HOD'")
    is_hod = models.BooleanField(default=False,
                                  help_text="Is this faculty member the Head of Department?")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "faculty"
        ordering = ["full_name"]
        verbose_name_plural = "Faculty"

    def __str__(self):
        return f"{self.full_name} ({self.employee_id})"

    @property
    def email(self):
        return self.user.email
