"""
Accounts tests — Phase 2 will add comprehensive auth tests.
"""
from django.test import TestCase
from .models import User, UserRole


class UserModelTest(TestCase):
    def test_create_student_user(self):
        user = User.objects.create_user(
            email="student@example.com",
            password="testpass123",
        )
        self.assertEqual(user.role, UserRole.STUDENT)
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)

    def test_create_superuser(self):
        user = User.objects.create_superuser(
            email="admin@example.com",
            password="adminpass123",
        )
        self.assertEqual(user.role, UserRole.SUPER_ADMIN)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)

    def test_email_is_username_field(self):
        self.assertEqual(User.USERNAME_FIELD, "email")

    def test_user_str(self):
        user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
        )
        self.assertIn("test@example.com", str(user))
