from rest_framework import serializers
from apps.accounts.models import User
from apps.departments.serializers import DepartmentMinimalSerializer
from .models import Student, ApprovalStatus


class StudentSerializer(serializers.ModelSerializer):
    """Full student representation — used in admin/faculty views."""
    email = serializers.EmailField(source="user.email", read_only=True)
    user_id = serializers.UUIDField(source="user.id", read_only=True)
    user_status = serializers.CharField(source="user.status", read_only=True)
    department_display = serializers.SerializerMethodField()
    semester_display = serializers.SerializerMethodField()
    section_display = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = (
            "id", "user_id", "email", "user_status",
            "student_id", "full_name", "phone",
            "department", "department_display",
            "semester", "semester_display",
            "section", "section_display",
            "department_name", "semester_name", "section_name",
            "approval_status", "approved_at", "rejection_reason",
            "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "user_id", "email", "user_status",
            "department_display", "semester_display", "section_display",
            "created_at", "updated_at",
        )

    def get_department_display(self, obj):
        return obj.display_department

    def get_semester_display(self, obj):
        return obj.display_semester

    def get_section_display(self, obj):
        return obj.display_section


class StudentMinimalSerializer(serializers.ModelSerializer):
    """Compact student info for nested use."""
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = Student
        fields = ("id", "student_id", "full_name", "email", "approval_status")
        read_only_fields = fields


class StudentProfileSerializer(serializers.ModelSerializer):
    """Student's own profile — returned in /auth/me/."""
    email = serializers.EmailField(source="user.email", read_only=True)
    department_display = serializers.SerializerMethodField()
    semester_display = serializers.SerializerMethodField()
    section_display = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = (
            "id", "student_id", "full_name", "phone", "email",
            "department_display", "semester_display", "section_display",
            "approval_status", "created_at",
        )
        read_only_fields = fields

    def get_department_display(self, obj):
        return obj.display_department

    def get_semester_display(self, obj):
        return obj.display_semester

    def get_section_display(self, obj):
        return obj.display_section


class ApproveStudentSerializer(serializers.Serializer):
    """Link student to FK records at approval time."""
    department = serializers.PrimaryKeyRelatedField(
        queryset=__import__("apps.departments.models", fromlist=["Department"]).Department.objects.all(),
        required=False, allow_null=True,
    )
    semester = serializers.PrimaryKeyRelatedField(
        queryset=__import__("apps.academics.models", fromlist=["Semester"]).Semester.objects.all(),
        required=False, allow_null=True,
    )
    section = serializers.PrimaryKeyRelatedField(
        queryset=__import__("apps.academics.models", fromlist=["Section"]).Section.objects.all(),
        required=False, allow_null=True,
    )


class RejectStudentSerializer(serializers.Serializer):
    rejection_reason = serializers.CharField(max_length=500, required=False, allow_blank=True)
