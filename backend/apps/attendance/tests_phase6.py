"""
FaceAttend — Attendance Session Tests (Phase 6)
"""
import uuid
from datetime import date
from django.urls import reverse
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import User, UserRole
from apps.departments.models import Department
from apps.academics.models import AcademicYear, Semester, Section, Subject, Room
from apps.faculty.models import Faculty
from apps.students.models import Student, ApprovalStatus
from apps.timetable.models import TimetableEntry
from apps.attendance.models import AttendanceSession, AttendanceRecord, SessionStatus


def make_user(role, email=None):
    email = email or f"{uuid.uuid4().hex[:6]}@test.com"
    return User.objects.create_user(email=email, password="pass", role=role)


def auth_client(user):
    from rest_framework_simplejwt.tokens import RefreshToken
    c = APIClient()
    t = RefreshToken.for_user(user)
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {t.access_token}")
    return c


def setup_structure():
    """Build full academic + faculty + student structure."""
    dept = Department.objects.create(name="CS", code="CS")
    year = AcademicYear.objects.create(label="2024-25", start_date="2024-07-01", end_date="2025-06-30")
    semester = Semester.objects.create(department=dept, academic_year=year, name="Sem 3", number=3)
    section = Section.objects.create(semester=semester, name="A", capacity=60)
    subject = Subject.objects.create(code="CS301", name="Data Structures", department=dept)
    room = Room.objects.create(name="CS-101", capacity=60)
    faculty_user = make_user(UserRole.FACULTY, "faculty@test.com")
    faculty = Faculty.objects.create(
        user=faculty_user, employee_id="FAC001", full_name="Prof. Jane", department=dept
    )
    student_user = make_user(UserRole.STUDENT, "student@test.com")
    student = Student.objects.create(
        user=student_user, student_id="CS001", full_name="Alice",
        department_name="CS", semester_name="Sem 3", section_name="A",
        department=dept, semester=semester, section=section,
        approval_status=ApprovalStatus.APPROVED,
    )
    return {
        "dept": dept, "year": year, "semester": semester, "section": section,
        "subject": subject, "room": room,
        "faculty_user": faculty_user, "faculty": faculty,
        "student_user": student_user, "student": student,
    }


def create_session(s, status=SessionStatus.SCHEDULED):
    return AttendanceSession.objects.create(
        section=s["section"],
        subject=s["subject"],
        faculty=s["faculty"],
        room=s["room"],
        date=date.today(),
        status=status,
        duration_minutes=60,
    )


class SessionCreateTest(TestCase):
    def setUp(self):
        self.admin = make_user(UserRole.DEPARTMENT_ADMIN)
        self.s = setup_structure()
        self.admin_client = auth_client(self.admin)
        self.faculty_client = auth_client(self.s["faculty_user"])
        self.student_client = auth_client(self.s["student_user"])

    def test_faculty_creates_session(self):
        res = self.faculty_client.post(
            reverse("attendance-session-list"),
            {
                "section": str(self.s["section"].id),
                "subject": str(self.s["subject"].id),
                "faculty": str(self.s["faculty"].id),
                "room": str(self.s["room"].id),
                "date": str(date.today()),
                "duration_minutes": 60,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        body = res.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["subject_code"], "CS301")
        self.assertEqual(body["data"]["status"], "SCHEDULED")

    def test_student_cannot_create_session(self):
        res = self.student_client.post(
            reverse("attendance-session-list"),
            {
                "section": str(self.s["section"].id),
                "subject": str(self.s["subject"].id),
                "faculty": str(self.s["faculty"].id),
                "date": str(date.today()),
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_cannot_create(self):
        res = APIClient().post(reverse("attendance-session-list"), {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


class SessionLifecycleTest(TestCase):
    def setUp(self):
        self.s = setup_structure()
        self.faculty_client = auth_client(self.s["faculty_user"])
        self.admin = make_user(UserRole.DEPARTMENT_ADMIN)
        self.admin_client = auth_client(self.admin)
        self.session = create_session(self.s)

    def test_start_session_generates_code(self):
        res = self.faculty_client.post(
            reverse("attendance-session-start", args=[self.session.id]),
            {"duration_minutes": 45},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()["data"]
        self.assertEqual(data["status"], "ACTIVE")
        self.assertIsNotNone(data["session_code"])
        self.assertEqual(len(data["session_code"]), 6)
        self.assertIsNotNone(data["valid_from"])
        self.assertIsNotNone(data["valid_until"])

    def test_cannot_start_already_active_session(self):
        self.session.start()
        res = self.faculty_client.post(
            reverse("attendance-session-start", args=[self.session.id]),
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_end_session(self):
        self.session.start()
        res = self.faculty_client.post(
            reverse("attendance-session-end", args=[self.session.id]),
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, SessionStatus.COMPLETED)

    def test_cannot_end_scheduled_session(self):
        res = self.faculty_client.post(
            reverse("attendance-session-end", args=[self.session.id]),
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cancel_session(self):
        res = self.faculty_client.post(
            reverse("attendance-session-cancel", args=[self.session.id]),
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, SessionStatus.CANCELLED)

    def test_cancel_active_session(self):
        self.session.start()
        res = self.faculty_client.post(
            reverse("attendance-session-cancel", args=[self.session.id]),
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, SessionStatus.CANCELLED)

    def test_cannot_cancel_completed_session(self):
        self.session.start()
        self.session.end()
        res = self.faculty_client.post(
            reverse("attendance-session-cancel", args=[self.session.id]),
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class ManualMarkTest(TestCase):
    def setUp(self):
        self.s = setup_structure()
        self.faculty_client = auth_client(self.s["faculty_user"])
        # Create as SCHEDULED then start
        self.session = create_session(self.s)
        self.session.start()

    def test_faculty_manually_marks_present(self):
        res = self.faculty_client.post(
            reverse("attendance-session-mark", args=[self.session.id]),
            {"student": str(self.s["student"].id), "status": "PRESENT"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        record = AttendanceRecord.objects.get(session=self.session, student=self.s["student"])
        self.assertEqual(record.status, "PRESENT")
        self.assertEqual(record.verification_method, "MANUAL")

    def test_faculty_marks_absent_with_reason(self):
        res = self.faculty_client.post(
            reverse("attendance-session-mark", args=[self.session.id]),
            {
                "student": str(self.s["student"].id),
                "status": "ABSENT",
                "rejection_reason": "Student did not attend.",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        record = AttendanceRecord.objects.get(session=self.session, student=self.s["student"])
        self.assertEqual(record.rejection_reason, "Student did not attend.")

    def test_duplicate_mark_updates_not_creates(self):
        self.faculty_client.post(
            reverse("attendance-session-mark", args=[self.session.id]),
            {"student": str(self.s["student"].id), "status": "PRESENT"},
            format="json",
        )
        res = self.faculty_client.post(
            reverse("attendance-session-mark", args=[self.session.id]),
            {"student": str(self.s["student"].id), "status": "LATE"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)  # Updated, not created
        self.assertEqual(AttendanceRecord.objects.count(), 1)

    def test_mark_invalid_student_returns_404(self):
        res = self.faculty_client.post(
            reverse("attendance-session-mark", args=[self.session.id]),
            {"student": str(uuid.uuid4()), "status": "PRESENT"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)


class SessionLookupTest(TestCase):
    def setUp(self):
        self.s = setup_structure()
        self.student_client = auth_client(self.s["student_user"])
        self.session = create_session(self.s)
        self.session.start()

    def test_lookup_by_valid_code(self):
        res = self.student_client.get(
            reverse("attendance-session-by-code"),
            {"code": self.session.session_code},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["data"]["id"], str(self.session.id))

    def test_lookup_invalid_code_returns_404(self):
        res = self.student_client.get(
            reverse("attendance-session-by-code"), {"code": "XXXXXX"}
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_today_endpoint_for_faculty(self):
        faculty_client = auth_client(self.s["faculty_user"])
        res = faculty_client.get(reverse("attendance-session-today"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res.json()["data"]["count"], 1)
