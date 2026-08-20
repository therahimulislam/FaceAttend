"""
FaceAttend — Phase 14: Dashboard API Tests

Tests all three dashboard endpoints:
  - StudentDashboardView
  - FacultyDashboardView
  - AdminDashboardView

Covers structure, authentication, role enforcement, and data accuracy.
"""
import uuid
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from apps.accounts.models import User, UserRole
from apps.departments.models import Department
from apps.academics.models import AcademicYear, Semester, Section, Subject, Room
from apps.students.models import Student, ApprovalStatus
from apps.faculty.models import Faculty
from apps.attendance.models import (
    AttendanceSession, AttendanceRecord,
    SessionStatus, AttendanceStatus,
)
from apps.timetable.models import TimetableEntry, DayOfWeek


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(role, email=None):
    email = email or f"d14_{uuid.uuid4().hex[:8]}@test.com"
    return User.objects.create_user(email=email, password="pass", role=role, is_active=True)


def auth_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def today_day_abbr():
    weekday = timezone.localtime().weekday()
    return {0: "MON", 1: "TUE", 2: "WED", 3: "THU", 4: "FRI", 5: "SAT"}.get(weekday, "MON")


# ---------------------------------------------------------------------------
# Fixture mixin
# ---------------------------------------------------------------------------

class DashboardFixture:
    def setUp(self):
        uid = uuid.uuid4().hex[:6]
        self.dept = Department.objects.create(name=f"Dept{uid}", code=f"D{uid[:3]}")
        self.year = AcademicYear.objects.create(
            label=f"2026-{uid[:2]}", start_date="2026-01-01", end_date="2026-12-31"
        )
        self.sem = Semester.objects.create(
            department=self.dept, academic_year=self.year, name="Sem1", number=1
        )
        self.section = Section.objects.create(semester=self.sem, name="A", capacity=60)
        self.room = Room.objects.create(name=f"R{uid}", capacity=60)
        self.subject = Subject.objects.create(
            name="DS", code=f"DS{uid}", department=self.dept, credits=3
        )

        # Faculty
        self.fac_user = make_user(UserRole.FACULTY, f"fac_{uid}@t.com")
        self.faculty = Faculty.objects.create(
            user=self.fac_user, employee_id=f"E{uid}",
            full_name="Dr Test Faculty", department=self.dept,
        )

        # Student (approved)
        self.stu_user = make_user(UserRole.STUDENT, f"stu_{uid}@t.com")
        self.student = Student.objects.create(
            user=self.stu_user, student_id=f"STU{uid}",
            full_name="Test Student",
            department_name="Dept", semester_name="Sem1", section_name="A",
            department=self.dept, semester=self.sem, section=self.section,
            approval_status=ApprovalStatus.APPROVED,
        )

        # Admin
        self.admin_user = make_user(UserRole.DEPARTMENT_ADMIN, f"adm_{uid}@t.com")

        # Timetable entry for today
        now = timezone.localtime()
        start = (now - timedelta(minutes=10)).time().replace(second=0, microsecond=0)
        end = (now + timedelta(minutes=50)).time().replace(second=0, microsecond=0)
        self.entry = TimetableEntry.objects.create(
            academic_year=self.year,
            section=self.section,
            subject=self.subject,
            faculty=self.faculty,
            room=self.room,
            day=today_day_abbr(),
            start_time=start,
            end_time=end,
        )

        # Active session
        self.session = AttendanceSession.objects.create(
            section=self.section, subject=self.subject,
            faculty=self.faculty, room=self.room,
            timetable_entry=self.entry,
            date=now.date(), status=SessionStatus.ACTIVE,
            valid_from=now - timedelta(minutes=10),
            valid_until=now + timedelta(minutes=50),
        )

        self.stu_client = auth_client(self.stu_user)
        self.fac_client = auth_client(self.fac_user)
        self.adm_client = auth_client(self.admin_user)


# ===========================================================================
# Student Dashboard Tests
# ===========================================================================

class StudentDashboardTest(DashboardFixture, APITestCase):

    def _url(self):
        return reverse("dashboard-student")

    def test_unauthenticated_returns_401(self):
        res = APIClient().get(self._url())
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_faculty_cannot_access_student_dashboard(self):
        res = self.fac_client.get(self._url())
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_student_gets_200(self):
        res = self.stu_client.get(self._url())
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_response_structure(self):
        res = self.stu_client.get(self._url())
        data = res.json()["data"]
        for key in ("greeting", "overall_percentage", "total_classes",
                    "attended_classes", "current_class", "upcoming_classes",
                    "recent_records"):
            self.assertIn(key, data, f"Missing key: {key}")

    def test_current_class_populated_during_active_slot(self):
        res = self.stu_client.get(self._url())
        data = res.json()["data"]
        # There is an active session overlapping now
        self.assertIsNotNone(data["current_class"])
        cc = data["current_class"]
        self.assertEqual(cc["subject_code"], self.subject.code)
        self.assertIsNotNone(cc["session_id"])

    def test_already_marked_false_before_submit(self):
        res = self.stu_client.get(self._url())
        cc = res.json()["data"]["current_class"]
        self.assertFalse(cc["already_marked"])

    def test_already_marked_true_after_submit(self):
        AttendanceRecord.objects.create(
            session=self.session, student=self.student,
            status=AttendanceStatus.PRESENT,
        )
        res = self.stu_client.get(self._url())
        cc = res.json()["data"]["current_class"]
        self.assertTrue(cc["already_marked"])

    def test_overall_percentage_correct(self):
        # 2 records: 1 PRESENT, 1 ABSENT
        session2 = AttendanceSession.objects.create(
            section=self.section, subject=self.subject, faculty=self.faculty,
            room=self.room, date=timezone.localdate(), status=SessionStatus.COMPLETED,
        )
        AttendanceRecord.objects.create(
            session=self.session, student=self.student, status=AttendanceStatus.PRESENT
        )
        AttendanceRecord.objects.create(
            session=session2, student=self.student, status=AttendanceStatus.ABSENT
        )
        res = self.stu_client.get(self._url())
        data = res.json()["data"]
        self.assertEqual(data["total_classes"], 2)
        self.assertEqual(data["attended_classes"], 1)
        self.assertEqual(data["overall_percentage"], 50.0)

    def test_recent_records_in_response(self):
        AttendanceRecord.objects.create(
            session=self.session, student=self.student,
            status=AttendanceStatus.PRESENT,
            face_verified=True, liveness_verified=True,
        )
        res = self.stu_client.get(self._url())
        records = res.json()["data"]["recent_records"]
        self.assertEqual(len(records), 1)
        self.assertIn("is_fully_verified", records[0])


# ===========================================================================
# Faculty Dashboard Tests
# ===========================================================================

class FacultyDashboardTest(DashboardFixture, APITestCase):

    def _url(self):
        return reverse("dashboard-faculty")

    def test_unauthenticated_returns_401(self):
        res = APIClient().get(self._url())
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_student_cannot_access_faculty_dashboard(self):
        res = self.stu_client.get(self._url())
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_faculty_gets_200(self):
        res = self.fac_client.get(self._url())
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_response_structure(self):
        res = self.fac_client.get(self._url())
        data = res.json()["data"]
        for key in ("greeting", "today_schedule", "active_session",
                    "this_week_sessions", "this_week_avg_attendance"):
            self.assertIn(key, data, f"Missing key: {key}")

    def test_today_schedule_contains_entry(self):
        res = self.fac_client.get(self._url())
        schedule = res.json()["data"]["today_schedule"]
        self.assertEqual(len(schedule), 1)
        self.assertEqual(schedule[0]["subject_code"], self.subject.code)

    def test_active_session_populated(self):
        res = self.fac_client.get(self._url())
        active = res.json()["data"]["active_session"]
        self.assertIsNotNone(active)
        self.assertEqual(active["session_status"], "ACTIVE")


# ===========================================================================
# Admin Dashboard Tests
# ===========================================================================

class AdminDashboardTest(DashboardFixture, APITestCase):

    def _url(self):
        return reverse("dashboard-admin")

    def test_unauthenticated_returns_401(self):
        res = APIClient().get(self._url())
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_student_cannot_access_admin_dashboard(self):
        res = self.stu_client.get(self._url())
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_faculty_cannot_access_admin_dashboard(self):
        res = self.fac_client.get(self._url())
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_gets_200(self):
        res = self.adm_client.get(self._url())
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_response_structure(self):
        res = self.adm_client.get(self._url())
        data = res.json()["data"]
        for key in ("total_students", "pending_approvals", "total_faculty",
                    "total_departments", "active_sessions_now",
                    "today_attendance_count", "pending_face_enrollments",
                    "recent_pending_students"):
            self.assertIn(key, data, f"Missing key: {key}")

    def test_active_sessions_now_count(self):
        res = self.adm_client.get(self._url())
        data = res.json()["data"]
        self.assertGreaterEqual(data["active_sessions_now"], 1)

    def test_pending_approvals_count(self):
        # Create a pending student
        pu = make_user(UserRole.STUDENT, f"pending_{uuid.uuid4().hex[:4]}@t.com")
        Student.objects.create(
            user=pu, student_id=f"P{uuid.uuid4().hex[:6]}",
            full_name="Pending One",
            department_name="Dept", semester_name="Sem1", section_name="A",
            approval_status=ApprovalStatus.PENDING,
        )
        res = self.adm_client.get(self._url())
        data = res.json()["data"]
        self.assertGreaterEqual(data["pending_approvals"], 1)

    def test_recent_pending_students_list(self):
        pu = make_user(UserRole.STUDENT, f"pend2_{uuid.uuid4().hex[:4]}@t.com")
        Student.objects.create(
            user=pu, student_id=f"P2{uuid.uuid4().hex[:6]}",
            full_name="Pending Two",
            department_name="Dept", semester_name="Sem1", section_name="A",
            approval_status=ApprovalStatus.PENDING,
        )
        res = self.adm_client.get(self._url())
        pending_list = res.json()["data"]["recent_pending_students"]
        self.assertIsInstance(pending_list, list)
        self.assertGreaterEqual(len(pending_list), 1)
        self.assertIn("full_name", pending_list[0])
        self.assertIn("created_at", pending_list[0])
