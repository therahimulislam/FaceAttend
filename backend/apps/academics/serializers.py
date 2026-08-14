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
