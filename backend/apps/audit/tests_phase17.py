"""
FaceAttend — Phase 17: Audit System Tests

Covers:
  - Model: creation, defaults, ordering
  - API: 401 unauthed, 403 non-admin, paginated admin list
  - API: filter by event_type, severity, date range
  - Service: log() creates correct entry, errors swallowed
  - Triggers: student approval/rejection, login failure, subject change
"""
import uuid
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from apps.accounts.models import User, UserRole
from apps.departments.models import Department
from apps.students.models import Student, ApprovalStatus
from apps.audit.models import AuditLog, AuditEventType, AuditSeverity
from apps.audit.service import AuditService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(role, email=None):
    email = email or f"a17_{uuid.uuid4().hex[:8]}@test.com"
    return User.objects.create_user(email=email, password="pass", role=role, is_active=True)


def auth_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def make_audit(event_type="STUDENT_APPROVED", severity="INFO", actor=None):
    return AuditLog.objects.create(
        event_type=event_type,
        severity=severity,
        actor=actor,
        description="Test audit entry",
    )


# ---------------------------------------------------------------------------
# Model Tests
# ---------------------------------------------------------------------------

class AuditLogModelTest(APITestCase):

    def test_create_audit_log(self):
        user = make_user(UserRole.SUPER_ADMIN)
        log = AuditLog.objects.create(
            event_type=AuditEventType.STUDENT_APPROVED,
            severity=AuditSeverity.INFO,
            actor=user,
            description="Student approved.",
        )
        self.assertEqual(log.event_type, "STUDENT_APPROVED")
        self.assertEqual(log.severity, "INFO")
        self.assertIsNone(log.old_value)
        self.assertEqual(log.metadata, {})

    def test_default_ordering_newest_first(self):
        l1 = make_audit()
        l2 = make_audit("STUDENT_REJECTED")
        qs = list(AuditLog.objects.all())
        self.assertEqual(qs[0].id, l2.id)

    def test_actor_nullable(self):
        log = AuditLog.objects.create(
            event_type="SECURITY_EVENT",
            description="System event",
        )
        self.assertIsNone(log.actor)


# ---------------------------------------------------------------------------
# API Tests
# ---------------------------------------------------------------------------

class AuditLogAPITest(APITestCase):

    def setUp(self):
        self.admin = make_user(UserRole.SUPER_ADMIN)
        self.faculty = make_user(UserRole.FACULTY)
        self.student_u = make_user(UserRole.STUDENT)
        self.admin_client = auth_client(self.admin)

        # Create some log entries
        make_audit("STUDENT_APPROVED", "INFO", actor=self.admin)
        make_audit("STUDENT_REJECTED", "INFO", actor=self.admin)
        make_audit("SECURITY_EVENT", "CRITICAL", actor=None)

    def test_unauthenticated_returns_401(self):
        res = APIClient().get(reverse("auditlog-list"))
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_faculty_returns_403(self):
        res = auth_client(self.faculty).get(reverse("auditlog-list"))
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_student_returns_403(self):
        res = auth_client(self.student_u).get(reverse("auditlog-list"))
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_list(self):
        res = self.admin_client.get(reverse("auditlog-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json().get("data", {})
        results = data.get("results", [])
        self.assertEqual(len(results), 3)

    def test_filter_by_event_type(self):
        res = self.admin_client.get(
            reverse("auditlog-list") + "?event_type=STUDENT_APPROVED"
        )
        data = res.json().get("data", {}).get("results", [])
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["event_type"], "STUDENT_APPROVED")

    def test_filter_by_severity(self):
        res = self.admin_client.get(
            reverse("auditlog-list") + "?severity=CRITICAL"
        )
        data = res.json().get("data", {}).get("results", [])
        self.assertTrue(all(r["severity"] == "CRITICAL" for r in data))

    def test_filter_by_actor_email(self):
        res = self.admin_client.get(
            reverse("auditlog-list") + f"?actor_email={self.admin.email[:5]}"
        )
        data = res.json().get("data", {}).get("results", [])
        self.assertEqual(len(data), 2)  # 2 entries with admin as actor

    def test_response_contains_expected_fields(self):
        res = self.admin_client.get(reverse("auditlog-list"))
        result = res.json()["data"]["results"][0]
        for field in ["id", "event_type", "severity", "description", "created_at"]:
            self.assertIn(field, result)

    def test_read_only_post_not_allowed(self):
        res = self.admin_client.post(reverse("auditlog-list"), {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)


# ---------------------------------------------------------------------------
# Service Tests
# ---------------------------------------------------------------------------

class AuditServiceTest(APITestCase):

    def setUp(self):
        self.user = make_user(UserRole.SUPER_ADMIN)

    def test_log_creates_entry(self):
        AuditService.log(
            event_type="SUBJECT_CHANGE",
            description="Subject CS101 created.",
            actor=self.user,
            new_value={"code": "CS101"},
        )
        log = AuditLog.objects.filter(event_type="SUBJECT_CHANGE").first()
        self.assertIsNotNone(log)
        self.assertEqual(log.actor, self.user)
        self.assertEqual(log.new_value["code"], "CS101")

    def test_default_severity_from_event_type(self):
        AuditService.log(event_type="SECURITY_EVENT", description="Bad login")
        log = AuditLog.objects.filter(event_type="SECURITY_EVENT").first()
        self.assertEqual(log.severity, "CRITICAL")

    def test_override_severity(self):
        AuditService.log(event_type="STUDENT_APPROVED", description="x", severity="WARNING")
        log = AuditLog.objects.filter(event_type="STUDENT_APPROVED").first()
        self.assertEqual(log.severity, "WARNING")

    def test_errors_are_swallowed(self):
        """AuditService must never raise — even if DB is broken."""
        try:
            AuditService.log(
                event_type="INVALID_EVENT_TYPE_THAT_IS_TOO_LONG_FOR_DB" * 5,
                description="x",
            )
        except Exception:
            self.fail("AuditService.log() raised an exception — it must not.")


# ---------------------------------------------------------------------------
# Trigger Integration Tests
# ---------------------------------------------------------------------------

class AuditTriggerTest(APITestCase):

    def setUp(self):
        uid = uuid.uuid4().hex[:6]
        self.dept = Department.objects.create(name=f"D{uid}", code=f"C{uid[:3]}")
        self.adm = make_user(UserRole.DEPARTMENT_ADMIN, f"adm_{uid}@t.com")
        self.adm_client = auth_client(self.adm)

        self.stu_user = make_user(UserRole.STUDENT, f"stu_{uid}@t.com")
        self.student = Student.objects.create(
            user=self.stu_user,
            student_id=f"A17{uid}",
            full_name="Audit Test Student",
            department_name="D",
            semester_name="S",
            section_name="A",
            department=self.dept,
            approval_status=ApprovalStatus.PENDING,
        )

    def test_approve_creates_audit_log(self):
        url = reverse("student-approve", kwargs={"pk": str(self.student.id)})
        self.adm_client.post(url)
        log = AuditLog.objects.filter(
            event_type=AuditEventType.STUDENT_APPROVED,
            target_user=self.stu_user,
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.severity, "INFO")

    def test_reject_creates_audit_log(self):
        url = reverse("student-reject", kwargs={"pk": str(self.student.id)})
        self.adm_client.post(url, {"rejection_reason": "Fake ID"}, format="json")
        log = AuditLog.objects.filter(
            event_type=AuditEventType.STUDENT_REJECTED,
            target_user=self.stu_user,
        ).first()
        self.assertIsNotNone(log)
        self.assertIn("Fake ID", log.description)

    def test_login_failure_creates_security_event(self):
        url = reverse("auth-login")
        APIClient().post(url, {"email": "nonexistent@t.com", "password": "wrong"}, format="json")
        log = AuditLog.objects.filter(event_type=AuditEventType.SECURITY_EVENT).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.severity, "CRITICAL")
