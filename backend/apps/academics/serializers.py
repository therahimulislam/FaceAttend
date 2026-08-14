from rest_framework import serializers
from .models import AcademicYear, Semester, Section


class AcademicYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicYear
        fields = ("id", "label", "start_date", "end_date", "is_current", "created_at")
        read_only_fields = ("id", "created_at")


class SectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = ("id", "name", "capacity", "status", "semester")
        read_only_fields = ("id",)


class SemesterSerializer(serializers.ModelSerializer):
    sections = SectionSerializer(many=True, read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    academic_year_label = serializers.CharField(source="academic_year.label", read_only=True)

    class Meta:
        model = Semester
        fields = ("id", "name", "number", "department", "department_name",
                  "academic_year", "academic_year_label", "start_date",
                  "end_date", "status", "is_current", "sections", "created_at")
        read_only_fields = ("id", "created_at", "sections",
                            "department_name", "academic_year_label")


class SemesterMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Semester
        fields = ("id", "name", "number", "status", "is_current")


class SubjectSerializer(serializers.ModelSerializer):
    from rest_framework import serializers as _s
    department_name = _s.CharField(source="department.name", read_only=True)
    department_code = _s.CharField(source="department.code", read_only=True)

    class Meta:
        from .models import Subject
        model = Subject
        fields = ("id", "code", "name", "department", "department_name",
                  "department_code", "credits", "hours_per_week", "status",
                  "created_at", "updated_at")
        read_only_fields = ("id", "department_name", "department_code",
                            "created_at", "updated_at")


class SubjectMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import Subject
        model = Subject
        fields = ("id", "code", "name", "credits", "status")


class RoomSerializer(serializers.ModelSerializer):
    has_gps = serializers.BooleanField(read_only=True)

    class Meta:
        from .models import Room
        model = Room
        fields = ("id", "name", "building", "floor", "capacity",
                  "latitude", "longitude", "geofence_radius",
                  "has_gps", "status", "created_at", "updated_at")
        read_only_fields = ("id", "has_gps", "created_at", "updated_at")


class RoomMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import Room
        model = Room
        fields = ("id", "name", "building", "floor", "capacity", "status")
