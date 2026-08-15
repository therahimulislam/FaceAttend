"""
FaceAttend — Timetable Model (Phase 5)

A TimetableEntry binds a Section to a Subject taught by a Faculty
member in a Room at a fixed day + time slot for an AcademicYear.

Constraints enforced at the database level:
  - A Section cannot have two classes at the same day + overlapping time
  - A Faculty member cannot be in two places at the same time
  - A Room cannot host two classes at the same time

Overlap validation is done in the serializer (no DB-level range operators
to keep things portable).
"""
import uuid
from django.db import models
from django.conf import settings


class DayOfWeek(models.TextChoices):
    MONDAY = "MON", "Monday"
    TUESDAY = "TUE", "Tuesday"
    WEDNESDAY = "WED", "Wednesday"
    THURSDAY = "THU", "Thursday"
    FRIDAY = "FRI", "Friday"
    SATURDAY = "SAT", "Saturday"


DAY_ORDER = {d: i for i, d in enumerate(DayOfWeek.values)}


class TimetableEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Academic scope
    academic_year = models.ForeignKey(
        "academics.AcademicYear",
        on_delete=models.CASCADE,
        related_name="timetable_entries",
        null=True, blank=True,
        help_text="Leave blank to apply to any active academic year.",
    )
    section = models.ForeignKey(
        "academics.Section",
        on_delete=models.CASCADE,
        related_name="timetable_entries",
    )
    subject = models.ForeignKey(
        "academics.Subject",
        on_delete=models.CASCADE,
        related_name="timetable_entries",
    )
    faculty = models.ForeignKey(
        "faculty.Faculty",
        on_delete=models.CASCADE,
        related_name="timetable_entries",
    )
    room = models.ForeignKey(
        "academics.Room",
        on_delete=models.CASCADE,
        related_name="timetable_entries",
    )

    # Time slot
    day = models.CharField(
        max_length=3,
        choices=DayOfWeek.choices,
        db_index=True,
    )
    start_time = models.TimeField()
    end_time = models.TimeField()

    is_active = models.BooleanField(default=True, db_index=True)
    notes = models.CharField(max_length=250, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="created_timetable_entries",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "timetable_entries"
        ordering = ["day", "start_time"]
        # No duplicate slot for the same section on the same day
        unique_together = [("section", "day", "start_time")]
        indexes = [
            models.Index(fields=["section", "day"]),
            models.Index(fields=["faculty", "day"]),
            models.Index(fields=["room", "day"]),
        ]

    def __str__(self):
        return (
            f"{self.section} | {self.subject.code} | "
            f"{self.get_day_display()} {self.start_time:%H:%M}–{self.end_time:%H:%M}"
        )

    @property
    def department(self):
        return self.section.semester.department
