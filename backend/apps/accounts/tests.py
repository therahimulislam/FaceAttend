"""
FaceAttend — Auth Tests (Phase 2)
Covers: register, login, logout, refresh, me, forgot-password, reset-password
"""
from django.urls import reverse
from django.test import TestCase
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient
from rest_framework import status

from .models import User, UserRole, UserStatus
from apps.students.models import Student, ApprovalStatus


def make_student_payload(**kwargs):
    """Helper: default valid student registration payload."""
    base = {
        "email": "student@test.com",
        "password": "StrongPass123!",
        "confirm_password": "StrongPass123!",
        "full_name": "Test Student",
        "student_id": "CS2024001",
        "phone": "9876543210",
        "department_name": "Computer Science",
        "semester_name": "Semester 3",
        "section_name": "A",
    }
    base.update(kwargs)
    return base


class UserModelTest(TestCase):
    """Tests for the User model (basic sanity checks from Phase 1)."""

    def test_create_student_user(self):
        user = User.objects.create_user(email="student@example.com", password="testpass123")
        self.assertEqual(user.role, UserRole.STUDENT)
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)

    def test_create_superuser(self):
        user = User.objects.create_superuser(email="admin@example.com", password="adminpass123")
        self.assertEqual(user.role, UserRole.SUPER_ADMIN)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)

    def test_email_is_username_field(self):
        self.assertEqual(User.USERNAME_FIELD, "email")

    def test_user_str(self):
        user = User.objects.create_user(email="test@example.com", password="testpass123")
        self.assertIn("test@example.com", str(user))


class RegisterViewTest(TestCase):
    """Tests for POST /api/v1/auth/register/"""

    def setUp(self):
        self.client = APIClient()
        self.url = reverse("auth-register")

    def test_successful_registration(self):
        res = self.client.post(self.url, make_student_payload(), format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertIn("tokens", data["data"])
        self.assertIn("access", data["data"]["tokens"])
        self.assertIn("refresh", data["data"]["tokens"])
        self.assertEqual(data["data"]["user"]["role"], "STUDENT")
        # Verify DB records
        user = User.objects.get(email="student@test.com")
        self.assertEqual(user.role, UserRole.STUDENT)
        student = Student.objects.get(user=user)
        self.assertEqual(student.approval_status, ApprovalStatus.PENDING)

    def test_duplicate_email_rejected(self):
        User.objects.create_user(email="student@test.com", password="pass")
        res = self.client.post(self.url, make_student_payload(), format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(res.json()["success"])

    def test_duplicate_student_id_rejected(self):
        user = User.objects.create_user(email="other@test.com", password="pass")
        Student.objects.create(
            user=user, student_id="CS2024001", full_name="Other",
            department_name="CS", semester_name="1", section_name="A",
        )
        payload = make_student_payload(email="new@test.com")
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_mismatch_rejected(self):
        payload = make_student_payload(confirm_password="WrongPass!")
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_required_fields(self):
        res = self.client.post(self.url, {"email": "test@test.com"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class LoginViewTest(TestCase):
    """Tests for POST /api/v1/auth/login/"""

    def setUp(self):
        self.client = APIClient()
        self.url = reverse("auth-login")
        self.user = User.objects.create_user(
            email="user@test.com", password="StrongPass123!"
        )
        Student.objects.create(
            user=self.user, student_id="CS001", full_name="Test User",
            department_name="CS", semester_name="1", section_name="A",
        )

    def test_successful_login(self):
        res = self.client.post(self.url, {"email": "user@test.com", "password": "StrongPass123!"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertIn("access", data["data"]["tokens"])
        self.assertIn("refresh", data["data"]["tokens"])

    def test_wrong_password(self):
        res = self.client.post(self.url, {"email": "user@test.com", "password": "WrongPass"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(res.json()["success"])

    def test_nonexistent_user(self):
        res = self.client.post(self.url, {"email": "nobody@test.com", "password": "pass"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_rejected_student_cannot_login(self):
        self.user.student_profile.approval_status = ApprovalStatus.REJECTED
        self.user.student_profile.save()
        res = self.client.post(self.url, {"email": "user@test.com", "password": "StrongPass123!"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(res.json()["code"], "AUTH_ACCOUNT_REJECTED")

    def test_suspended_user_cannot_login(self):
        self.user.status = UserStatus.SUSPENDED
        self.user.save()
        res = self.client.post(self.url, {"email": "user@test.com", "password": "StrongPass123!"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(res.json()["code"], "AUTH_ACCOUNT_SUSPENDED")

    def test_pending_student_can_login(self):
        """PENDING students can log in — they just can't mark attendance."""
        res = self.client.post(self.url, {"email": "user@test.com", "password": "StrongPass123!"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        student_info = res.json()["data"]["user"]["student_info"]
        self.assertEqual(student_info["approval_status"], "PENDING")


class LogoutViewTest(TestCase):
    """Tests for POST /api/v1/auth/logout/"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email="user@test.com", password="pass123")
        from rest_framework_simplejwt.tokens import RefreshToken
        self.refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.refresh.access_token}")

    def test_logout_blacklists_token(self):
        res = self.client.post(
            reverse("auth-logout"),
            {"refresh": str(self.refresh)},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Verify refresh token is blacklisted
        res2 = self.client.post(
            reverse("auth-refresh"),
            {"refresh": str(self.refresh)},
            format="json",
        )
        self.assertEqual(res2.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_requires_auth(self):
        client = APIClient()  # no credentials
        res = client.post(reverse("auth-logout"), {"refresh": "token"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


class MeViewTest(TestCase):
    """Tests for GET /api/v1/auth/me/"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email="me@test.com", password="pass123")
        from rest_framework_simplejwt.tokens import RefreshToken
        token = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")

    def test_me_returns_user_data(self):
        res = self.client.get(reverse("auth-me"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["data"]["email"], "me@test.com")

    def test_me_unauthenticated(self):
        client = APIClient()
        res = client.get(reverse("auth-me"))
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


class ForgotPasswordViewTest(TestCase):
    """Tests for POST /api/v1/auth/forgot-password/"""

    def setUp(self):
        self.client = APIClient()
        self.url = reverse("auth-forgot-password")
        self.user = User.objects.create_user(email="forgot@test.com", password="pass123")

    def test_existing_email_returns_200(self):
        res = self.client.post(self.url, {"email": "forgot@test.com"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_nonexistent_email_also_returns_200(self):
        """Must not reveal whether email exists."""
        res = self.client.post(self.url, {"email": "nobody@test.com"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)


class ResetPasswordViewTest(TestCase):
    """Tests for POST /api/v1/auth/reset-password/"""

    def setUp(self):
        self.client = APIClient()
        self.url = reverse("auth-reset-password")
        self.user = User.objects.create_user(email="reset@test.com", password="OldPass123!")
        self.uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        self.token = default_token_generator.make_token(self.user)

    def test_valid_reset(self):
        res = self.client.post(self.url, {
            "uid": self.uid,
            "token": self.token,
            "new_password": "NewPass456!",
            "confirm_password": "NewPass456!",
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Verify can now login with new password
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewPass456!"))

    def test_invalid_token_rejected(self):
        res = self.client.post(self.url, {
            "uid": self.uid,
            "token": "invalid-token",
            "new_password": "NewPass456!",
            "confirm_password": "NewPass456!",
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
