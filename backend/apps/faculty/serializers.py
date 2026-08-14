from rest_framework import serializers
from django.db import transaction
from apps.accounts.models import User, UserRole
from .models import Faculty


class FacultySerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    user_id = serializers.UUIDField(source="user.id", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    user_status = serializers.CharField(source="user.status", read_only=True)

    class Meta:
        model = Faculty
        fields = ("id", "user_id", "email", "user_status", "employee_id",
                  "full_name", "phone", "department", "department_name",
                  "designation", "is_hod", "created_at")
        read_only_fields = ("id", "email", "user_id", "department_name",
                            "user_status", "created_at")


class CreateFacultySerializer(serializers.Serializer):
    """Admin creates a faculty account — generates User + Faculty profile."""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    employee_id = serializers.CharField(max_length=50)
    full_name = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    department = serializers.PrimaryKeyRelatedField(
        queryset=__import__("apps.departments.models", fromlist=["Department"]).Department.objects.all(),
        required=False, allow_null=True,
    )
    designation = serializers.CharField(max_length=100, required=False, allow_blank=True)
    is_hod = serializers.BooleanField(default=False)

    def validate_email(self, value):
        if User.objects.filter(email=value.lower()).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def validate_employee_id(self, value):
        if Faculty.objects.filter(employee_id=value).exists():
            raise serializers.ValidationError("This employee ID is already registered.")
        return value

    def create(self, validated_data):
        with transaction.atomic():
            user = User.objects.create_faculty(
                email=validated_data["email"],
                password=validated_data["password"],
            )
            faculty = Faculty.objects.create(
                user=user,
                employee_id=validated_data["employee_id"],
                full_name=validated_data["full_name"],
                phone=validated_data.get("phone", ""),
                department=validated_data.get("department"),
                designation=validated_data.get("designation", ""),
                is_hod=validated_data.get("is_hod", False),
            )
        return faculty
