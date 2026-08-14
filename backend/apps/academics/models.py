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


# ---------------------------------------------------------------------------
# Subject (Phase 4)
# ---------------------------------------------------------------------------

class SubjectStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    INACTIVE = "INACTIVE", "Inactive"


class Subject(models.Model):
    """
    An academic subject taught in a department.
    Linked to timetable entries in Phase 5.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(
        max_length=20, unique=True, db_index=True,
        help_text="Subject code, e.g. 'CS301', 'MA201'."
    )
    name = models.CharField(max_length=150)
    department = models.ForeignKey(
        "departments.Department",
        on_delete=models.CASCADE,
        related_name="subjects",
    )
    credits = models.PositiveSmallIntegerField(default=3)
    hours_per_week = models.PositiveSmallIntegerField(
        default=3,
        help_text="Number of lecture hours per week.",
    )
    status = models.CharField(
        max_length=20, choices=SubjectStatus.choices,
        default=SubjectStatus.ACTIVE, db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "subjects"
        ordering = ["department", "code"]
        unique_together = [("department", "name")]

    def __str__(self):
        return f"{self.code} — {self.name}"


# ---------------------------------------------------------------------------
# Room (Phase 4)
# ---------------------------------------------------------------------------

class RoomStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    INACTIVE = "INACTIVE", "Inactive"
    UNDER_MAINTENANCE = "UNDER_MAINTENANCE", "Under Maintenance"


class Room(models.Model):
    """
    A physical classroom/lab used in timetable entries.
    Stores GPS coordinates for geofence-based attendance verification (Phase 8).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True,
                            help_text="e.g. 'CS-101', 'Lab-3', 'Seminar Hall'")
    building = models.CharField(max_length=100, blank=True)
    floor = models.SmallIntegerField(default=0,
                                     help_text="0 = ground floor, negative = basement")
    capacity = models.PositiveSmallIntegerField(default=60)

    # GPS coordinates for geofence attendance (Phase 8)
    latitude = models.DecimalField(
        max_digits=10, decimal_places=7,
        null=True, blank=True,
        help_text="Center latitude of the room/building (WGS84).",
    )
    longitude = models.DecimalField(
        max_digits=10, decimal_places=7,
        null=True, blank=True,
        help_text="Center longitude of the room/building (WGS84).",
    )
    geofence_radius = models.PositiveSmallIntegerField(
        default=50,
        help_text="Geofence radius in meters. Students must be within this range to mark attendance.",
    )

    status = models.CharField(
        max_length=30, choices=RoomStatus.choices,
        default=RoomStatus.ACTIVE, db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rooms"
        ordering = ["building", "name"]

    def __str__(self):
        return f"{self.name} ({self.building})" if self.building else self.name

    @property
    def has_gps(self):
        return self.latitude is not None and self.longitude is not None
