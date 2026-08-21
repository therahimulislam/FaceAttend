"""
FaceAttend — Accounts Views (Phase 2)
Auth endpoints: register, login, logout, refresh, forgot-password, reset-password, me
"""
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.conf import settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.views import TokenRefreshView as SimpleJWTRefreshView

from apps.common.responses import (
    success_response, created_response, error_response, unauthorized_response
)
from .models import User
from .serializers import (
    StudentRegisterSerializer,
    LoginSerializer,
    UserProfileSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
)


def _get_tokens_for_user(user):
    """Generate JWT refresh + access tokens for a user."""
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }


class RegisterView(APIView):
    """
    POST /api/v1/auth/register/
    Student self-registration. Creates User + Student profile (status=PENDING).
    Requires admin approval before the student can mark attendance.
    """
    permission_classes = [AllowAny]

    def post(self, request: Request):
        serializer = StudentRegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                message="Registration failed. Please check the details.",
                code="VALIDATION_ERROR",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        user = serializer.save()
        user.update_last_login()

        tokens = _get_tokens_for_user(user)
        profile_data = UserProfileSerializer(user).data

        return created_response(
            data={
                "user": profile_data,
                "tokens": tokens,
            },
            message="Registration successful. Your account is pending admin approval.",
        )


class LoginView(APIView):
    """
    POST /api/v1/auth/login/
    Returns JWT tokens + user profile data.
    The role field in the response determines which dashboard to show.
    """
    permission_classes = [AllowAny]

    def post(self, request: Request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            errors = serializer.errors
            # Serializer raises ValidationError with {"code": [...], "detail": [...]}
            code = "AUTH_INVALID_CREDENTIALS"
            message = "Invalid credentials."
            if isinstance(errors, dict):
                if "code" in errors:
                    code_val = errors["code"]
                    code = str(code_val[0]) if isinstance(code_val, list) else str(code_val)
                if "detail" in errors:
                    detail_val = errors["detail"]
                    message = str(detail_val[0]) if isinstance(detail_val, list) else str(detail_val)
                elif "non_field_errors" in errors:
                    for err in errors["non_field_errors"]:
                        if hasattr(err, "code") and err.code != "invalid":
                            code = err.code
                        message = str(err)
                        break
            # Phase 17 — audit security event on login failure
            try:
                from apps.audit.service import AuditService
                email_attempt = request.data.get("email", "unknown")
                AuditService.security_event(
                    request=request,
                    description=f"Failed login attempt for '{email_attempt}'. Code: {code}",
                    metadata={"email": email_attempt, "code": code},
                )
            except Exception:
                pass
            return error_response(
                message=message,
                code=code,
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        user = serializer.validated_data["user"]
        user.update_last_login()

        tokens = _get_tokens_for_user(user)
        profile_data = UserProfileSerializer(user).data

        return success_response(
            data={
                "user": profile_data,
                "tokens": tokens,
            },
            message="Login successful.",
        )


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/
    Blacklists the provided refresh token (requires Authentication).
    Body: {"refresh": "<refresh_token>"}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return error_response(
                message="Refresh token is required.",
                code="MISSING_REFRESH_TOKEN",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            # Token already blacklisted or invalid — still return success
            pass

        return success_response(message="Logout successful.")


class TokenRefreshView(SimpleJWTRefreshView):
    """
    POST /api/v1/auth/refresh/
    Wraps simplejwt's TokenRefreshView in the standard envelope.
    Body: {"refresh": "<refresh_token>"}
    Returns: {"access": "<new_access_token>", "refresh": "<new_refresh_token>"}
    """
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            return success_response(
                data=response.data,
                message="Token refreshed successfully.",
            )
        return error_response(
            message="Invalid or expired refresh token.",
            code="TOKEN_INVALID",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


class MeView(APIView):
    """
    GET  /api/v1/auth/me/  — Return current authenticated user's profile.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        serializer = UserProfileSerializer(request.user)
        return success_response(data=serializer.data)


class ForgotPasswordView(APIView):
    """
    POST /api/v1/auth/forgot-password/
    Sends a password reset email. Always returns 200 to prevent email enumeration.
    """
    permission_classes = [AllowAny]

    def post(self, request: Request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]

        try:
            user = User.objects.get(email=email)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)

            # Build the reset link (points to the frontend reset page)
            frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
            reset_link = f"{frontend_url}/reset-password?uid={uid}&token={token}"

            send_mail(
                subject="FaceAttend — Password Reset Request",
                message=(
                    f"Hello,\n\n"
                    f"You requested a password reset for your FaceAttend account ({email}).\n\n"
                    f"Click the link below to reset your password (valid for 24 hours):\n\n"
                    f"{reset_link}\n\n"
                    f"If you did not request this, you can safely ignore this email.\n\n"
                    f"— FaceAttend Team"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=True,
            )
        except User.DoesNotExist:
            pass  # Don't reveal whether the email exists

        # Always return success to prevent email enumeration
        return success_response(
            message="If an account with that email exists, a password reset link has been sent.",
        )


class ResetPasswordView(APIView):
    """
    POST /api/v1/auth/reset-password/
    Validates the reset token and sets the new password.
    Body: {"uid": "...", "token": "...", "new_password": "...", "confirm_password": "..."}
    """
    permission_classes = [AllowAny]

    def post(self, request: Request):
        serializer = ResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                message="Invalid or expired reset link.",
                code="RESET_TOKEN_INVALID",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        serializer.save()
        return success_response(
            message="Password reset successful. You can now log in with your new password.",
        )
