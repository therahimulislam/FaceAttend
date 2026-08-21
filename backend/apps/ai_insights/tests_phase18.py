"""
FaceAttend — Phase 18: AI Insights Tests

Covers:
  - Engine: Risk LOW/MEDIUM/HIGH based on percentages
  - Engine: Consecutive absence bumps severity
  - Engine: Anomaly detection (absence spike, late, suspicious attempts)
  - Engine: InsightsEngine trend + shortage prediction
  - API: Student own risk/anomalies/insights, admin ?student_id=, overview
"""
import uuid
from datetime import date, timedelta
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase, APIClient
from django.urls import reverse

from apps.accounts.models import User, UserRole
from apps.departments.models import Department
from apps.academics.models import Subject, Section, Semester, AcademicYear, Room
from apps.students.models import Student, ApprovalStatus
from apps.faculty.models import Faculty
from apps.attendance.models import (
    AttendanceSession, AttendanceRecord, SessionStatus
)
from apps.ai_insights.engine import (
    AttendanceRiskEngine, AnomalyDetector, InsightsEngine
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def uid():
    return uuid.uuid4().hex[:6]


def make_user(role, email=None):
    email = email or f"ai18_{uid()}@t.com"
    return User.objects.create_user(email=email, password="pass", role=role, is_active=True)


def auth_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


class BaseAITest(APITestCase):
    """Sets up full academic structure + student + faculty for AI tests."""

    def setUp(self):
        u = uid()
        self.dept = Department.objects.create(name=f"D{u}", code=f"C{u[:3]}")
        year = AcademicYear.objects.create(
            label=f"Y{u}", start_date="2024-07-01", end_date="2025-06-30"
        )
        self.semester = Semester.objects.create(
            department=self.dept, academic_year=year, name=f"Sem{u}", number=1
        )
        self.section = Section.objects.create(
            semester=self.semester, name="A", capacity=60
        )
        self.room = Room.objects.create(name=f"R{u}", capacity=30)
        self.subject = Subject.objects.create(
            name="Data Structures", code=f"DS{u[:3]}",
            credits=3, department=self.dept
        )

        # Faculty
        self.fac_user = make_user(UserRole.FACULTY, f"fac_{u}@t.com")
        self.faculty = Faculty.objects.create(
            user=self.fac_user, employee_id=f"F{u}",
            full_name="Prof AI", department=self.dept,
        )

        # Student linked to section
        self.stu_user = make_user(UserRole.STUDENT, f"stu_{u}@t.com")
        self.student = Student.objects.create(
            user=self.stu_user,
            student_id=f"S{u}",
            full_name="AI Test Student",
            department_name="D",
            semester_name="1",
            section_name="A",
            department=self.dept,
            semester=self.semester,
            section=self.section,
            approval_status=ApprovalStatus.APPROVED,
        )
        self.admin_user = make_user(UserRole.SUPER_ADMIN, f"adm_{u}@t.com")

    def _make_session(self, session_date: date):
        return AttendanceSession.objects.create(
            section=self.section,
            subject=self.subject,
            faculty=self.faculty,
            room=self.room,
            date=session_date,
            status=SessionStatus.SCHEDULED,
            duration_minutes=60,
        )

    def _make_record(self, session, status_val: str):
        return AttendanceRecord.objects.create(
            session=session,
            student=self.student,
            status=status_val,
            verification_method="MANUAL",
        )

    def _populate(self, statuses: list):
        """Create sessions+records for a list of status strings."""
        base = date.today() - timedelta(days=len(statuses))
        for i, s in enumerate(statuses):
            sess = self._make_session(base + timedelta(days=i))
            self._make_record(sess, s)


# ---------------------------------------------------------------------------
# Engine: Risk Tests
# ---------------------------------------------------------------------------

class RiskEngineTest(BaseAITest):

    def test_low_risk_above_80(self):
        self._populate(["PRESENT"] * 9 + ["ABSENT"])  # 90%
        result = AttendanceRiskEngine.assess(self.student)
        self.assertEqual(result["overall_risk"], "LOW")

    def test_medium_risk_between_65_80(self):
        # 70% without consecutive absences at end
        self._populate(["ABSENT"] * 3 + ["PRESENT"] * 7)  # 70%, no trailing absents
        result = AttendanceRiskEngine.assess(self.student)
        self.assertEqual(result["overall_risk"], "MEDIUM")

    def test_high_risk_below_65(self):
        self._populate(["ABSENT"] * 5 + ["PRESENT"] * 5)  # 50%, no trailing absents
        result = AttendanceRiskEngine.assess(self.student)
        self.assertEqual(result["overall_risk"], "HIGH")

    def test_consecutive_absences_bump_severity(self):
        # 70% overall but LAST 3 sessions (newest) are absent → bump MEDIUM → HIGH
        # _populate inserts in chronological order; engine reads newest first
        self._populate(["PRESENT"] * 7 + ["ABSENT"] * 3)
        result = AttendanceRiskEngine.assess(self.student)
        self.assertEqual(result["overall_risk"], "HIGH")

    def test_no_records_returns_low(self):
        result = AttendanceRiskEngine.assess(self.student)
        self.assertEqual(result["overall_risk"], "LOW")
        self.assertEqual(result["subjects"], [])

    def test_subject_breakdown_present(self):
        self._populate(["PRESENT"] * 8 + ["ABSENT"] * 2)
        result = AttendanceRiskEngine.assess(self.student)
        self.assertEqual(len(result["subjects"]), 1)
        self.assertIn("percentage", result["subjects"][0])


# ---------------------------------------------------------------------------
# Engine: Anomaly Tests
# ---------------------------------------------------------------------------

class AnomalyEngineTest(BaseAITest):

    def test_no_anomalies_clean_record(self):
        self._populate(["PRESENT"] * 8)
        result = AnomalyDetector.detect(self.student)
        self.assertEqual(result["risk"], "LOW")
        self.assertEqual(result["anomaly_count"], 0)

    def test_absence_spike_detected(self):
        # Last 3 sessions chronologically are ABSENT (engine reads newest first)
        self._populate(["PRESENT"] * 5 + ["ABSENT"] * 3)
        result = AnomalyDetector.detect(self.student)
        types = [a["type"] for a in result["anomalies"]]
        self.assertIn("ABSENCE_SPIKE", types)

    def test_repeated_late_detected(self):
        self._populate(["PRESENT"] * 2 + ["LATE"] * 3)
        result = AnomalyDetector.detect(self.student)
        types = [a["type"] for a in result["anomalies"]]
        self.assertIn("REPEATED_LATE", types)

    def test_suspicious_attempts_flagged(self):
        from apps.audit.models import AuditLog
        for _ in range(3):
            AuditLog.objects.create(
                event_type="SUSPICIOUS_ATTEMPT",
                target_user=self.stu_user,
                description="face mismatch",
                severity="WARNING",
            )
        result = AnomalyDetector.detect(self.student)
        types = [a["type"] for a in result["anomalies"]]
        self.assertIn("REPEATED_FAILURE", types)
        self.assertEqual(result["risk"], "HIGH")


# ---------------------------------------------------------------------------
# Engine: Insights Tests
# ---------------------------------------------------------------------------

class InsightsEngineTest(BaseAITest):

    def test_insights_structure(self):
        self._populate(["PRESENT"] * 6 + ["ABSENT"] * 2)
        result = InsightsEngine.insights(self.student)
        self.assertIn("subjects", result)
        self.assertEqual(len(result["subjects"]), 1)
        subj = result["subjects"][0]
        for field in ["subject_code", "percentage", "trend", "suggestion"]:
            self.assertIn(field, subj)

    def test_trend_values_valid(self):
        self._populate(["ABSENT"] * 5 + ["PRESENT"] * 5)
        result = InsightsEngine.insights(self.student)
        trend = result["subjects"][0]["trend"]
        self.assertIn(trend, ["IMPROVING", "STABLE", "DECLINING"])

    def test_shortage_suggestion_for_low_attendance(self):
        self._populate(["PRESENT"] * 4 + ["ABSENT"] * 6)  # 40%
        result = InsightsEngine.insights(self.student)
        subj = result["subjects"][0]
        self.assertIn("shortage", subj["suggestion"].lower())


# ---------------------------------------------------------------------------
# API Tests
# ---------------------------------------------------------------------------

class AIAPITest(BaseAITest):

    def test_unauthenticated_returns_401(self):
        for url_name in ["ai-risk", "ai-anomalies", "ai-insights"]:
            res = APIClient().get(reverse(url_name))
            self.assertEqual(res.status_code, 401, msg=url_name)

    def test_student_own_risk(self):
        self._populate(["PRESENT"] * 8)
        res = auth_client(self.stu_user).get(reverse("ai-risk"))
        self.assertEqual(res.status_code, 200)
        self.assertIn("overall_risk", res.json()["data"])

    def test_student_own_anomalies(self):
        res = auth_client(self.stu_user).get(reverse("ai-anomalies"))
        self.assertEqual(res.status_code, 200)
        self.assertIn("risk", res.json()["data"])

    def test_student_own_insights(self):
        self._populate(["PRESENT"] * 6)
        res = auth_client(self.stu_user).get(reverse("ai-insights"))
        self.assertEqual(res.status_code, 200)

    def test_admin_with_student_id(self):
        self._populate(["PRESENT"] * 8)
        url = reverse("ai-risk") + f"?student_id={self.student.id}"
        res = auth_client(self.admin_user).get(url)
        self.assertEqual(res.status_code, 200)

    def test_admin_overview(self):
        res = auth_client(self.admin_user).get(reverse("ai-overview"))
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        self.assertIn("summary", data)
        self.assertIn("students", data)

    def test_student_overview_forbidden(self):
        res = auth_client(self.stu_user).get(reverse("ai-overview"))
        self.assertEqual(res.status_code, 403)

    def test_faculty_overview_allowed(self):
        res = auth_client(self.fac_user).get(reverse("ai-overview"))
        self.assertEqual(res.status_code, 200)
