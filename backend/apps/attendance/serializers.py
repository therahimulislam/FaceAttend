"""
FaceAttend — Attendance Serializers (Phase 6)
"""
from django.utils import timezone
from rest_framework import serializers
from .models import AttendanceSession, AttendanceRecord, SessionStatus


# ---------------------------------------------------------------------------
# Attendance Record
# ---------------------------------------------------------------------------

class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    student_id = serializers.CharField(source="student.student_id", read_only=True)
    marked_by_email = serializers.CharField(source="marked_by.email", read_only=True, default=None)

    class Meta:
        model = AttendanceRecord
        fields = (
            "id", "session", "student", "student_name", "student_id",
            "status", "verification_method",
            "face_verified", "gps_verified",
            "marked_at", "marked_by", "marked_by_email",
            "latitude", "longitude",
            "rejection_reason", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "marked_at", "face_verified", "gps_verified",
            "student_name", "student_id", "marked_by_email",
            "created_at", "updated_at",
        )


class ManualMarkSerializer(serializers.Serializer):
    """Used by faculty to manually mark a student's attendance."""
    student = serializers.UUIDField()
    status = serializers.ChoiceField(choices=["PRESENT", "ABSENT", "LATE", "EXCUSED"])
    rejection_reason = serializers.CharField(required=False, allow_blank=True)


# ---------------------------------------------------------------------------
# Attendance Session
# ---------------------------------------------------------------------------

class SessionSummarySerializer(serializers.ModelSerializer):
    """Compact summary for list views."""
    subject_code = serializers.CharField(source="subject.code", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    section_name = serializers.CharField(source="section.name", read_only=True)
    semester_name = serializers.CharField(source="section.semester.name", read_only=True)
    department_name = serializers.CharField(source="section.semester.department.name", read_only=True)
    faculty_name = serializers.CharField(source="faculty.full_name", read_only=True)
    room_name = serializers.SerializerMethodField()
    attendance_count = serializers.IntegerField(read_only=True)
    total_students = serializers.IntegerField(read_only=True)
    is_open = serializers.BooleanField(read_only=True)

    # Geofence info (Phase 8)
    room_latitude = serializers.SerializerMethodField()
    room_longitude = serializers.SerializerMethodField()
    room_geofence_radius = serializers.SerializerMethodField()
    room_has_gps = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceSession
        fields = (
            "id", "date", "status", "session_code", "is_open",
            "subject_code", "subject_name", "section_name",
            "semester_name", "department_name", "faculty_name",
            "room_name", "room_latitude", "room_longitude",
            "room_geofence_radius", "room_has_gps",
            "valid_from", "valid_until",
            "started_at", "ended_at", "duration_minutes",
            "attendance_count", "total_students",
            "timetable_entry", "notes", "created_at",
        )

    def get_room_name(self, obj):
        return obj.room.name if obj.room else None

    def get_room_latitude(self, obj):
        return str(obj.room.latitude) if obj.room and obj.room.latitude else None

    def get_room_longitude(self, obj):
        return str(obj.room.longitude) if obj.room and obj.room.longitude else None

    def get_room_geofence_radius(self, obj):
        return obj.room.geofence_radius if obj.room else None

    def get_room_has_gps(self, obj):
        return bool(obj.room and obj.room.has_gps)


class SessionDetailSerializer(SessionSummarySerializer):
    """Full detail with attendance records."""
    records = AttendanceRecordSerializer(many=True, read_only=True)

    class Meta(SessionSummarySerializer.Meta):
        fields = SessionSummarySerializer.Meta.fields + ("records",)


class CreateSessionSerializer(serializers.ModelSerializer):
    """Validates session creation. Accepts either a timetable_entry or manual fields."""

    class Meta:
        model = AttendanceSession
        fields = (
            "id", "timetable_entry",
            "section", "subject", "faculty", "room",
            "date", "duration_minutes", "notes",
        )
        read_only_fields = ("id",)

    def validate(self, attrs):
        timetable_entry = attrs.get("timetable_entry")
        if timetable_entry:
            # Auto-fill from timetable entry
            attrs.setdefault("section", timetable_entry.section)
            attrs.setdefault("subject", timetable_entry.subject)
            attrs.setdefault("faculty", timetable_entry.faculty)
            attrs.setdefault("room", timetable_entry.room)
        else:
            # Manual: require section, subject, faculty
            for field in ("section", "subject", "faculty"):
                if not attrs.get(field):
                    raise serializers.ValidationError(
                        {field: "This field is required when not using a timetable entry."}
                    )
        # Default date to today
        if not attrs.get("date"):
            attrs["date"] = timezone.localdate()
        return attrs

    def to_representation(self, instance):
        return SessionSummarySerializer(instance, context=self.context).data


class StartSessionSerializer(serializers.Serializer):
    """Optional payload when starting a session."""
    duration_minutes = serializers.IntegerField(min_value=5, max_value=180, default=60, required=False)


# ---------------------------------------------------------------------------
# Phase 7 — Student-side serializers
# ---------------------------------------------------------------------------

class StudentSubmitSerializer(serializers.Serializer):
    """
    Payload from a student when self-marking attendance.
    GPS coordinates are optional (enforced by Phase 8 geofence if room has GPS).
    face_image is optional (used in Phase 10 face recognition if student enrolled).
    """
    latitude = serializers.DecimalField(
        max_digits=10, decimal_places=7,
        required=False, allow_null=True,
    )
    longitude = serializers.DecimalField(
        max_digits=10, decimal_places=7,
        required=False, allow_null=True,
    )
    # Phase 10: optional live face photo for biometric verification
    face_image = serializers.ImageField(
        required=False, allow_null=True,
        help_text="Live face photo (JPEG/PNG). Required when face verification is requested.",
    )


class MyAttendanceRecordSerializer(serializers.ModelSerializer):
    """Student-facing view of a single attendance record."""
    session_date = serializers.DateField(source="session.date", read_only=True)
    subject_code = serializers.CharField(source="session.subject.code", read_only=True)
    subject_name = serializers.CharField(source="session.subject.name", read_only=True)
    faculty_name = serializers.CharField(source="session.faculty.full_name", read_only=True)
    section_name = serializers.CharField(source="session.section.name", read_only=True)
    session_id = serializers.UUIDField(source="session.id", read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = (
            "id", "session_id", "session_date",
            "subject_code", "subject_name",
            "faculty_name", "section_name",
            "status", "verification_method",
            "face_verified", "gps_verified",
            "marked_at", "rejection_reason",
            "created_at",
        )
        read_only_fields = fields
