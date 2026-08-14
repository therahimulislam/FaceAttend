from rest_framework import serializers
from .models import Department


class DepartmentSerializer(serializers.ModelSerializer):
    student_count = serializers.SerializerMethodField()
    faculty_count = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = ("id", "name", "code", "description", "status",
                  "student_count", "faculty_count", "created_at")
        read_only_fields = ("id", "created_at", "student_count", "faculty_count")

    def get_student_count(self, obj):
        return obj.students.filter(
            approval_status="APPROVED"
        ).count() if hasattr(obj, "students") else 0

    def get_faculty_count(self, obj):
        return obj.faculty_members.count() if hasattr(obj, "faculty_members") else 0


class DepartmentMinimalSerializer(serializers.ModelSerializer):
    """Minimal representation for nested use and registration dropdowns."""
    class Meta:
        model = Department
        fields = ("id", "name", "code", "status")
