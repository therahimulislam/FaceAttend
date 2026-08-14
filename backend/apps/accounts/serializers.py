"""
FaceAttend — Accounts Serializers (Phase 2)
"""
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, UserRole, UserStatus


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

class StudentRegisterSerializer(serializers.Serializer):
    """Serializer for student self-registration (Phase 2)."""

    # User fields
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    # Student profile fields
    full_name = serializers.CharField(max_length=150)
    student_id = serializers.CharField(max_length=50)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    department_name = serializers.CharField(max_length=100)
    semester_name = serializers.CharField(max_length=50)
    section_name = serializers.CharField(max_length=50)

    def validate_email(self, value):
        if User.objects.filter(email=value.lower()).exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )
        return value.lower()

    def validate_student_id(self, value):
        from apps.students.models import Student
        if Student.objects.filter(student_id=value).exists():
            raise serializers.ValidationError(
                "This student ID is already registered."
            )
        return value

    def validate(self, data):
        if data["password"] != data["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )
        validate_password(data["password"])
        return data

    def create(self, validated_data):
        from django.db import transaction
        from apps.students.models import Student

        validated_data.pop("confirm_password")

        with transaction.atomic():
            user = User.objects.create_user(
                email=validated_data["email"],
                password=validated_data["password"],
                role=UserRole.STUDENT,
            )
            Student.objects.create(
                user=user,
                student_id=validated_data["student_id"],
                full_name=validated_data["full_name"],
                phone=validated_data.get("phone", ""),
                department_name=validated_data["department_name"],
                semester_name=validated_data["semester_name"],
                section_name=validated_data["section_name"],
            )

        return user


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

class LoginSerializer(serializers.Serializer):
    """Email + password login. Returns JWT tokens + user data."""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        email = data["email"].lower()
        password = data["password"]

        # Check if user exists first for a clear error code
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError(
                {"code": "AUTH_INVALID_CREDENTIALS", "detail": "Invalid email or password."}
            )

        # Check account status before authenticating
        if user.status == UserStatus.SUSPENDED:
            raise serializers.ValidationError(
                {"code": "AUTH_ACCOUNT_SUSPENDED", "detail": "Your account has been suspended. Contact support."}
            )

        # Check if student account is rejected
        if user.role == UserRole.STUDENT:
            try:
                if user.student_profile.approval_status == "REJECTED":
                    raise serializers.ValidationError(
                        {"code": "AUTH_ACCOUNT_REJECTED", "detail": "Your registration was rejected. Contact the department administrator."}
                    )
            except AttributeError:
                pass  # No student profile yet — allow login

        # Authenticate credentials
        authenticated_user = authenticate(request=self.context.get("request"), username=email, password=password)
        if not authenticated_user:
            raise serializers.ValidationError(
                {"code": "AUTH_INVALID_CREDENTIALS", "detail": "Invalid email or password."}
            )

        if not authenticated_user.is_active:
            raise serializers.ValidationError(
                {"code": "AUTH_ACCOUNT_INACTIVE", "detail": "This account is inactive."}
            )

        data["user"] = authenticated_user
        return data


# ---------------------------------------------------------------------------
# User Profile
# ---------------------------------------------------------------------------

class UserProfileSerializer(serializers.ModelSerializer):
    """Public user data — safe to expose to the client."""
    student_info = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "email", "role", "status", "created_at", "last_login", "student_info")
        read_only_fields = fields

    def get_student_info(self, obj):
        if obj.role != UserRole.STUDENT:
            return None
        try:
            profile = obj.student_profile
            return {
                "student_id": profile.student_id,
                "full_name": profile.full_name,
                "department_name": profile.department_name,
                "semester_name": profile.semester_name,
                "section_name": profile.section_name,
                "approval_status": profile.approval_status,
            }
        except Exception:
            return None


# ---------------------------------------------------------------------------
# Password Reset
# ---------------------------------------------------------------------------

class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        # Don't reveal whether email exists (security)
        return value.lower()


class ResetPasswordSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, data):
        if data["new_password"] != data["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )

        try:
            uid = force_str(urlsafe_base64_decode(data["uid"]))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError(
                {"uid": "Invalid password reset link."}
            )

        if not default_token_generator.check_token(user, data["token"]):
            raise serializers.ValidationError(
                {"token": "This password reset link has expired or is invalid."}
            )

        data["user"] = user
        return data

    def save(self):
        user = self.validated_data["user"]
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        # Blacklist all existing refresh tokens for this user for security
        return user


# ---------------------------------------------------------------------------
# Token Refresh (wrapper for response standardization)
# ---------------------------------------------------------------------------

class TokenRefreshResponseSerializer(serializers.Serializer):
    """Used only for documenting the response shape."""
    access = serializers.CharField()
