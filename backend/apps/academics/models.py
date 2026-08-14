"""
FaceAttend — Academic Models: AcademicYear, Semester, Section (Phase 3)
"""
import uuid
from django.db import models


class AcademicYear(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    label = models.CharField(max_length=20, unique=True,
                             help_text="e.g. '2024-25'")
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "academic_years"
        ordering = ["-start_date"]

    def __str__(self):
        return self.label

    def save(self, *args, **kwargs):
        # Ensure only one academic year is marked current
        if self.is_current:
            AcademicYear.objects.exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)


class SemesterStatus(models.TextChoices):
    UPCOMING = "UPCOMING", "Upcoming"
    ACTIVE = "ACTIVE", "Active"
    COMPLETED = "COMPLETED", "Completed"


class Semester(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    department = models.ForeignKey(
        "departments.Department",
        on_delete=models.CASCADE,
        related_name="semesters",
    )
    academic_year = models.ForeignKey(
        AcademicYear,
        on_delete=models.CASCADE,
        related_name="semesters",
    )
    name = models.CharField(max_length=50,
                            help_text="e.g. 'Semester 3', '3rd Semester'")
    number = models.PositiveSmallIntegerField(
        help_text="Semester number (1–8) for ordering.",
        null=True, blank=True,
    )
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=SemesterStatus.choices,
                              default=SemesterStatus.UPCOMING, db_index=True)
    is_current = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "semesters"
        unique_together = [("department", "academic_year", "name")]
        ordering = ["department", "number", "name"]

    def __str__(self):
        return f"{self.department.code} — {self.name} ({self.academic_year.label})"


class SectionStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    INACTIVE = "INACTIVE", "Inactive"


class Section(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    semester = models.ForeignKey(
        Semester,
        on_delete=models.CASCADE,
        related_name="sections",
    )
    name = models.CharField(max_length=10,
                            help_text="e.g. 'A', 'B', 'CS-A'")
    capacity = models.PositiveSmallIntegerField(default=60)
    status = models.CharField(max_length=20, choices=SectionStatus.choices,
                              default=SectionStatus.ACTIVE, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sections"
        unique_together = [("semester", "name")]
        ordering = ["semester", "name"]

    def __str__(self):
        return f"{self.semester} / Section {self.name}"

    @property
    def department(self):
        return self.semester.department
