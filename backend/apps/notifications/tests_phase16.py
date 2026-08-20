"""
FaceAttend — Phase 16: Notification Tests

Covers:
  - Model: creation, defaults, ordering
  - API: list (own only), unread_count, mark_read, mark_all_read, unauthenticated
  - Service: convenience methods create correct category
  - Trigger: registration approved/rejected creates notification
"""
import uuid
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from apps.accounts.models import User, UserRole
from apps.departments.models import Department
from apps.students.models import Student, ApprovalStatus
from apps.notifications.models import Notification, NotificationCategory
from apps.notifications.service import NotificationService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(role, email=None):
    email = email or f"n16_{uuid.uuid4().hex[:8]}@test.com"
    return User.objects.create_user(email=email, password="pass", role=role, is_active=True)


def auth_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def make_notif(user, category="ATTENDANCE_SUCCESS", is_read=False):
    return Notification.objects.create(
        recipient=user,
        category=category,
        title="Test",
        body="Test body",
        is_read=is_read,
    )


# ---------------------------------------------------------------------------
# Model Tests
# ---------------------------------------------------------------------------

class NotificationModelTest(APITestCase):

    def test_create_notification(self):
        user = make_user(UserRole.STUDENT)
        n = Notification.objects.create(
            recipient=user,
            category=NotificationCategory.ATTENDANCE_SUCCESS,
            title="Attendance marked",
            body="You have been marked present.",
        )
        self.assertFalse(n.is_read)
        self.assertEqual(n.category, "ATTENDANCE_SUCCESS")

    def test_default_ordering_newest_first(self):
        user = make_user(UserRole.STUDENT)
        n1 = make_notif(user)
        n2 = make_notif(user)
        qs = list(Notification.objects.filter(recipient=user))
        # n2 created later — should be first
        self.assertEqual(qs[0].id, n2.id)

    def test_metadata_default_empty_dict(self):
        user = make_user(UserRole.STUDENT)
        n = Notification.objects.create(
            recipient=user, category="ATTENDANCE_SUCCESS",
            title="T", body="B",
        )
        self.assertEqual(n.metadata, {})


# ---------------------------------------------------------------------------
# API Tests
# ---------------------------------------------------------------------------

class NotificationAPITest(APITestCase):

    def setUp(self):
        self.user = make_user(UserRole.STUDENT)
        self.other = make_user(UserRole.STUDENT)
        self.client = auth_client(self.user)

        # Create 3 notifications for self, 1 for other
        make_notif(self.user, "ATTENDANCE_SUCCESS")
        make_notif(self.user, "LOW_ATTENDANCE")
        make_notif(self.user, "REGISTRATION_APPROVED", is_read=True)
        make_notif(self.other, "ATTENDANCE_SUCCESS")

    def _url(self, name, **kwargs):
        return reverse(name, kwargs=kwargs)

    def test_unauthenticated_returns_401(self):
        res = APIClient().get(reverse("notification-list"))
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_returns_own_only(self):
        res = self.client.get(reverse("notification-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Paginated envelope: { success, data: { results: [...], count, ... } }
        data = res.json().get("data", {})
        results = data.get("results", data) if isinstance(data, dict) else data
        if isinstance(results, dict):
            results = results.get("results", [])
        self.assertEqual(len(results), 3)

    def test_unread_count_accurate(self):
        res = self.client.get(reverse("notification-unread-count"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["data"]["count"], 2)  # 2 unread

    def test_mark_read(self):
        notif = Notification.objects.filter(recipient=self.user, is_read=False).first()
        url = reverse("notification-mark-read", kwargs={"pk": str(notif.id)})
        res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        notif.refresh_from_db()
        self.assertTrue(notif.is_read)

    def test_mark_read_returns_notification_data(self):
        notif = Notification.objects.filter(recipient=self.user, is_read=False).first()
        url = reverse("notification-mark-read", kwargs={"pk": str(notif.id)})
        res = self.client.post(url)
        self.assertIn("is_read", res.json()["data"])
        self.assertTrue(res.json()["data"]["is_read"])

    def test_mark_all_read(self):
        res = self.client.post(reverse("notification-mark-all-read"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["data"]["marked_read"], 2)
        # Confirm all unread are now read
        self.assertEqual(
            Notification.objects.filter(recipient=self.user, is_read=False).count(), 0
        )

    def test_cannot_mark_other_users_notification(self):
        other_notif = Notification.objects.filter(recipient=self.other).first()
        url = reverse("notification-mark-read", kwargs={"pk": str(other_notif.id)})
        res = self.client.post(url)
        # Should 404 (queryset is scoped to own notifications)
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# Service Tests
# ---------------------------------------------------------------------------

class NotificationServiceTest(APITestCase):

    def setUp(self):
        uid = uuid.uuid4().hex[:6]
        self.stu_user = make_user(UserRole.STUDENT, f"svc_{uid}@t.com")
        self.dept = Department.objects.create(name=f"D{uid}", code=f"C{uid[:3]}")
        self.student = Student.objects.create(
            user=self.stu_user,
            student_id=f"S{uid}",
            full_name="Test Student",
            department_name="D",
            semester_name="S",
            section_name="A",
        )

    def test_registration_approved_creates_notification(self):
        NotificationService.registration_approved(self.student)
        n = Notification.objects.filter(
            recipient=self.stu_user,
            category=NotificationCategory.REGISTRATION_APPROVED,
        ).first()
        self.assertIsNotNone(n)
        self.assertFalse(n.is_read)

    def test_registration_rejected_creates_notification(self):
        NotificationService.registration_rejected(self.student, reason="ID mismatch")
        n = Notification.objects.filter(
            recipient=self.stu_user,
            category=NotificationCategory.REGISTRATION_REJECTED,
        ).first()
        self.assertIsNotNone(n)
        self.assertIn("ID mismatch", n.body)

    def test_attendance_success_creates_notification(self):
        NotificationService.attendance_success(
            self.student, "Data Structures", "DS", "PRESENT", "2026-01-10"
        )
        n = Notification.objects.filter(
            recipient=self.stu_user,
            category=NotificationCategory.ATTENDANCE_SUCCESS,
        ).first()
        self.assertIsNotNone(n)
        self.assertIn("DS", n.title)

    def test_low_attendance_creates_notification(self):
        NotificationService.low_attendance(self.student, "OS", "OS101", 68.5)
        n = Notification.objects.filter(
            recipient=self.stu_user,
            category=NotificationCategory.LOW_ATTENDANCE,
        ).first()
        self.assertIsNotNone(n)
        self.assertIn("68.5%", n.body)

    def test_suspicious_attempt_creates_notification(self):
        NotificationService.suspicious_attempt(self.student, "Java", "JAVA", "Face mismatch")
        n = Notification.objects.filter(
            recipient=self.stu_user,
            category=NotificationCategory.SUSPICIOUS_ATTEMPT,
        ).first()
        self.assertIsNotNone(n)

    def test_send_error_does_not_raise(self):
        """Notification errors must never propagate."""
        # Pass None as recipient — should log and swallow, not raise
        try:
            NotificationService.send(None, "ATTENDANCE_SUCCESS", "T", "B")
        except Exception:
            self.fail("NotificationService.send() raised an exception — it must not.")


# ---------------------------------------------------------------------------
# Trigger Integration Tests
# ---------------------------------------------------------------------------

class ApprovalNotificationTriggerTest(APITestCase):

    def setUp(self):
        uid = uuid.uuid4().hex[:6]
        self.dept = Department.objects.create(name=f"Dept{uid}", code=f"D{uid[:3]}")
        self.adm_user = make_user(UserRole.DEPARTMENT_ADMIN, f"adm_{uid}@t.com")
        self.adm_client = auth_client(self.adm_user)

        self.stu_user = make_user(UserRole.STUDENT, f"stu_{uid}@t.com")
        self.student = Student.objects.create(
            user=self.stu_user,
            student_id=f"STNT{uid}",
            full_name="Pending Student",
            department_name="D",
            semester_name="S",
            section_name="A",
            department=self.dept,
            approval_status=ApprovalStatus.PENDING,
        )

    def test_approve_sends_notification(self):
        url = reverse("student-approve", kwargs={"pk": str(self.student.id)})
        self.adm_client.post(url)
        n = Notification.objects.filter(
            recipient=self.stu_user,
            category=NotificationCategory.REGISTRATION_APPROVED,
        ).first()
        self.assertIsNotNone(n)

    def test_reject_sends_notification(self):
        url = reverse("student-reject", kwargs={"pk": str(self.student.id)})
        self.adm_client.post(url, {"rejection_reason": "Duplicate entry"}, format="json")
        n = Notification.objects.filter(
            recipient=self.stu_user,
            category=NotificationCategory.REGISTRATION_REJECTED,
        ).first()
        self.assertIsNotNone(n)
        self.assertIn("Duplicate entry", n.body)
