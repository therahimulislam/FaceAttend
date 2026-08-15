"""
FaceAttend — Student Attendance Tests (Phase 7)
Tests for student self-submission, section validation, history, and summary.
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


def build_world():
    """Full academic + student + faculty structure."""
    dept = Department.objects.create(name="CS", code="CS")
    year = AcademicYear.objects.create(label="2024-25", start_date="2024-07-01", end_date="2025-06-30")
    semester = Semester.objects.create(department=dept, academic_year=year, name="Sem 3", number=3)
    section_a = Section.objects.create(semester=semester, name="A", capacity=60)
    section_b = Section.objects.create(semester=semester, name="B", capacity=60)
    subject = Subject.objects.create(code="CS301", name="Data Structures", department=dept)
    subject2 = Subject.objects.create(code="CS302", name="Algorithms", department=dept)
    room = Room.objects.create(name="CS-101", capacity=60)
    faculty_user = make_user(UserRole.FACULTY, "fac@test.com")
    faculty = Faculty.objects.create(
        user=faculty_user, employee_id="FAC001", full_name="Prof. Jane", department=dept
    )
    student_user = make_user(UserRole.STUDENT, "stu@test.com")
    student = Student.objects.create(
        user=student_user, student_id="CS001", full_name="Alice",
        department_name="CS", semester_name="Sem 3", section_name="A",
        department=dept, semester=semester, section=section_a,
        approval_status=ApprovalStatus.APPROVED,
    )
    # Student in section B (wrong section for section A sessions)
    student_b_user = make_user(UserRole.STUDENT, "stub@test.com")
    student_b = Student.objects.create(
        user=student_b_user, student_id="CS002", full_name="Bob",
        department_name="CS", semester_name="Sem 3", section_name="B",
        department=dept, semester=semester, section=section_b,
        approval_status=ApprovalStatus.APPROVED,
    )
    return {
        "dept": dept, "semester": semester,
        "section_a": section_a, "section_b": section_b,
        "subject": subject, "subject2": subject2, "room": room,
        "faculty_user": faculty_user, "faculty": faculty,
        "student_user": student_user, "student": student,
        "student_b_user": student_b_user, "student_b": student_b,
    }


def create_active_session(w):
    sess = AttendanceSession.objects.create(
        section=w["section_a"],
        subject=w["subject"],
        faculty=w["faculty"],
        room=w["room"],
        date=date.today(),
        duration_minutes=60,
    )
    sess.start()
    return sess


class StudentSubmitTest(TestCase):
    def setUp(self):
        self.w = build_world()
        self.student_client = auth_client(self.w["student_user"])
        self.session = create_active_session(self.w)

    def test_student_submits_without_gps(self):
        res = self.student_client.post(
            reverse("attendance-session-submit", args=[self.session.id]),
            {},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        body = res.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["status"], "PRESENT")
        self.assertEqual(body["data"]["verification_method"], "MANUAL")

    def test_student_submits_with_gps(self):
        res = self.student_client.post(
            reverse("attendance-session-submit", args=[self.session.id]),
            {"latitude": "11.0168", "longitude": "76.9558"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        body = res.json()
        self.assertEqual(body["data"]["gps_verified"], True)
        self.assertEqual(body["data"]["verification_method"], "GPS")

    def test_duplicate_submit_is_idempotent(self):
        self.student_client.post(
            reverse("attendance-session-submit", args=[self.session.id]),
            {}, format="json"
        )
        # Second submission updates, not creates
        res = self.student_client.post(
            reverse("attendance-session-submit", args=[self.session.id]),
            {}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(AttendanceRecord.objects.count(), 1)

    def test_wrong_section_rejected(self):
        # Student B is in section B, session is for section A.
        # The queryset filter gives student B a 404 (they can't see section A sessions),
        # which is the correct security behavior (don't leak session existence).
        client_b = auth_client(self.w["student_b_user"])
        res = client_b.post(
            reverse("attendance-session-submit", args=[self.session.id]),
            {}, format="json"
        )
        self.assertIn(res.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    def test_faculty_cannot_submit(self):
        faculty_client = auth_client(self.w["faculty_user"])
        res = faculty_client.post(
            reverse("attendance-session-submit", args=[self.session.id]),
            {}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(res.json()["code"], "NOT_STUDENT")

    def test_closed_session_rejected(self):
        self.session.end()
        res = self.student_client.post(
            reverse("attendance-session-submit", args=[self.session.id]),
            {}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(res.json()["code"], "SESSION_CLOSED")

    def test_anonymous_cannot_submit(self):
        res = APIClient().post(
            reverse("attendance-session-submit", args=[self.session.id]),
            {}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


class MyAttendanceTest(TestCase):
    def setUp(self):
        self.w = build_world()
        self.student_client = auth_client(self.w["student_user"])
        # Create 3 sessions across 2 subjects
        for subject in [self.w["subject"], self.w["subject2"], self.w["subject"]]:
            sess = AttendanceSession.objects.create(
                section=self.w["section_a"],
                subject=subject,
                faculty=self.w["faculty"],
                date=date.today(),
                duration_minutes=60,
            )
            sess.start()
            # Student submits
            AttendanceRecord.objects.create(
                session=sess,
                student=self.w["student"],
                status="PRESENT" if subject == self.w["subject"] else "ABSENT",
                verification_method="MANUAL",
            )

    def test_my_list(self):
        res = self.student_client.get(reverse("my-attendance-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["data"]["count"], 3)

    def test_my_list_contains_subject_info(self):
        res = self.student_client.get(reverse("my-attendance-list"))
        first = res.json()["data"]["results"][0]
        self.assertIn("subject_code", first)
        self.assertIn("faculty_name", first)
        self.assertIn("session_date", first)

    def test_my_summary(self):
        res = self.student_client.get(reverse("my-attendance-summary"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()["data"]
        # 2 subjects: CS301 and CS302
        self.assertEqual(len(data), 2)
        # CS301: 2 present out of 2 = 100%
        cs301 = next(x for x in data if x["subject_code"] == "CS301")
        self.assertEqual(cs301["present"], 2)
        self.assertEqual(cs301["percentage"], 100.0)
        # CS302: 0 present out of 1 = 0%
        cs302 = next(x for x in data if x["subject_code"] == "CS302")
        self.assertEqual(cs302["absent"], 1)
        self.assertEqual(cs302["percentage"], 0.0)

    def test_other_student_sees_own_records_only(self):
        client_b = auth_client(self.w["student_b_user"])
        res = client_b.get(reverse("my-attendance-list"))
        self.assertEqual(res.json()["data"]["count"], 0)
