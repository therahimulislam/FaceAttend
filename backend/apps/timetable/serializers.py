"""
FaceAttend — Timetable Serializers (Phase 5)

CreateTimetableEntrySerializer performs three overlap checks:
  1. Section conflict  — same section teaching two subjects simultaneously
  2. Faculty conflict  — faculty assigned to two classes at the same time
  3. Room conflict     — room double-booked

Overlap definition: entries A and B overlap if A.start < B.end AND A.end > B.start
"""
from rest_framework import serializers
from apps.academics.models import Section, Subject, Room, AcademicYear
from apps.faculty.models import Faculty
from .models import TimetableEntry, DayOfWeek


class TimetableEntryReadSerializer(serializers.ModelSerializer):
    """Full representation for list/retrieve."""
    subject_code = serializers.CharField(source="subject.code", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    faculty_name = serializers.CharField(source="faculty.full_name", read_only=True)
    faculty_id = serializers.UUIDField(source="faculty.id", read_only=True)
    room_name = serializers.CharField(source="room.name", read_only=True)
    section_name = serializers.CharField(source="section.name", read_only=True)
    semester_name = serializers.CharField(source="section.semester.name", read_only=True)
    department_name = serializers.CharField(source="section.semester.department.name", read_only=True)
    day_display = serializers.CharField(source="get_day_display", read_only=True)

    class Meta:
        model = TimetableEntry
        fields = (
            "id", "academic_year",
            "section", "section_name", "semester_name", "department_name",
            "subject", "subject_code", "subject_name",
            "faculty", "faculty_id", "faculty_name",
            "room", "room_name",
            "day", "day_display", "start_time", "end_time",
            "is_active", "notes",
            "created_at", "updated_at",
        )


class TimetableEntryWriteSerializer(serializers.ModelSerializer):
    """Validated creation/update — includes overlap conflict detection."""

    class Meta:
        model = TimetableEntry
        fields = (
            "id", "academic_year",
            "section", "subject", "faculty", "room",
            "day", "start_time", "end_time",
            "is_active", "notes",
        )
        read_only_fields = ("id",)

    def _time_overlaps(self, start_a, end_a, start_b, end_b) -> bool:
        """True if time range A overlaps with time range B."""
        return start_a < end_b and end_a > start_b

    def validate(self, attrs):
        day = attrs.get("day")
        start_time = attrs.get("start_time")
        end_time = attrs.get("end_time")
        section = attrs.get("section")
        faculty = attrs.get("faculty")
        room = attrs.get("room")

        # Reject zero-duration or inverted slots
        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError(
                {"end_time": "End time must be after start time."}
            )

        # Exclude self when updating
        instance_id = self.instance.id if self.instance else None

        # Existing entries for this day (excluding self)
        qs = TimetableEntry.objects.filter(day=day, is_active=True)
        if instance_id:
            qs = qs.exclude(id=instance_id)

        conflicts = []

        for entry in qs:
            overlaps = self._time_overlaps(start_time, end_time, entry.start_time, entry.end_time)
            if not overlaps:
                continue

            if entry.section_id == section.id:
                conflicts.append(
                    f"Section '{section.name}' already has "
                    f"'{entry.subject.code}' at "
                    f"{entry.start_time:%H:%M}–{entry.end_time:%H:%M} on {entry.get_day_display()}."
                )
            if entry.faculty_id == faculty.id:
                conflicts.append(
                    f"Faculty '{faculty.full_name}' is already teaching "
                    f"'{entry.subject.code}' at "
                    f"{entry.start_time:%H:%M}–{entry.end_time:%H:%M} on {entry.get_day_display()}."
                )
            if entry.room_id == room.id:
                conflicts.append(
                    f"Room '{room.name}' is already booked for "
                    f"'{entry.subject.code}' at "
                    f"{entry.start_time:%H:%M}–{entry.end_time:%H:%M} on {entry.get_day_display()}."
                )

        if conflicts:
            raise serializers.ValidationError({"conflicts": conflicts})

        return attrs

    def to_representation(self, instance):
        """Return full read representation after create/update."""
        return TimetableEntryReadSerializer(instance, context=self.context).data
