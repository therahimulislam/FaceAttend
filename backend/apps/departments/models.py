"""
FaceAttend — Department Model (Phase 3)
"""
import uuid
from django.db import models
from django.conf import settings


class DepartmentStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    INACTIVE = "INACTIVE", "Inactive"


class Department(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150, unique=True)
    code = models.CharField(max_length=20, unique=True, db_index=True,
                            help_text="Short identifier, e.g. 'CS', 'ECE'.")
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=DepartmentStatus.choices,
                              default=DepartmentStatus.ACTIVE, db_index=True)
    # Head of department — set once Faculty model is created
    head = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="headed_departments",
        limit_choices_to={"role__in": ["FACULTY", "DEPARTMENT_ADMIN"]},
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "departments"
        ordering = ["name"]

    def __str__(self):
        return f"{self.code} — {self.name}"

    @property
    def is_active(self):
        return self.status == DepartmentStatus.ACTIVE
