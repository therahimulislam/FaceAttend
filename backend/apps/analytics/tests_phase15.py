"""
FaceAttend — Phase 15: Reporting Tests

Tests all four report endpoints:
  - Response structure (JSON)
  - Authentication and role enforcement
  - CSV / Excel / PDF export content-type checks
  - Data accuracy (percentages, counts)
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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(role, email=None):
    email = email or f"r15_{uuid.uuid4().hex[:8]}@test.com"
    return User.objects.create_user(email=email, password="pass", role=role, is_active=True)


def auth_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


class ReportFixture:
    """Creates a full fixture: dept → section → student → session → records."""

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
        self.subject2 = Subject.objects.create(
            name="OS", code=f"OS{uid}", department=self.dept, credits=3
        )

        # Faculty
        self.fac_user = make_user(UserRole.FACULTY, f"fac_{uid}@t.com")
        self.faculty = Faculty.objects.create(
            user=self.fac_user, employee_id=f"E{uid}",
            full_name="Dr Test", department=self.dept,
        )

        # Students
        self.stu_user = make_user(UserRole.STUDENT, f"stu_{uid}@t.com")
        self.student = Student.objects.create(
            user=self.stu_user, student_id=f"STU{uid}", full_name="Test Student",
            department_name="Dept", semester_name="Sem1", section_name="A",
            department=self.dept, semester=self.sem, section=self.section,
            approval_status=ApprovalStatus.APPROVED,
        )

        # Admin
        self.adm_user = make_user(UserRole.DEPARTMENT_ADMIN, f"adm_{uid}@t.com")

        # Two sessions
        now = timezone.now()
        self.session1 = AttendanceSession.objects.create(
            section=self.section, subject=self.subject, faculty=self.faculty,
            room=self.room, date=now.date(), status=SessionStatus.COMPLETED,
        )
        self.session2 = AttendanceSession.objects.create(
            section=self.section, subject=self.subject, faculty=self.faculty,
            room=self.room,
            date=(now - timedelta(days=1)).date(),
            status=SessionStatus.COMPLETED,
        )

        # Records: PRESENT in session1, ABSENT in session2
        AttendanceRecord.objects.create(
            session=self.session1, student=self.student, status=AttendanceStatus.PRESENT
        )
        AttendanceRecord.objects.create(
            session=self.session2, student=self.student, status=AttendanceStatus.ABSENT
        )

        self.stu_client = auth_client(self.stu_user)
        self.fac_client = auth_client(self.fac_user)
        self.adm_client = auth_client(self.adm_user)


# ===========================================================================
# Student Report
# ===========================================================================

class StudentReportTest(ReportFixture, APITestCase):

    def _url(self, **params):
        url = reverse("report-student")
        if params:
            url += "?" + "&".join(f"{k}={v}" for k, v in params.items())
        return url

    def test_unauthenticated_returns_401(self):
        res = APIClient().get(self._url())
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_student_gets_own_report(self):
        res = self.stu_client.get(self._url())
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()["data"]
        self.assertIn("student", data)
        self.assertIn("overall", data)
        self.assertIn("by_subject", data)

    def test_overall_counts_correct(self):
        res = self.stu_client.get(self._url())
        overall = res.json()["data"]["overall"]
        self.assertEqual(overall["total"], 2)
        self.assertEqual(overall["present"], 1)
        self.assertEqual(overall["absent"], 1)
        self.assertEqual(overall["percentage"], 50.0)

    def test_by_subject_has_entry(self):
        res = self.stu_client.get(self._url())
        by_subj = res.json()["data"]["by_subject"]
        self.assertEqual(len(by_subj), 1)
        self.assertEqual(by_subj[0]["subject_code"], self.subject.code)

    def test_admin_can_query_other_student(self):
        res = self.adm_client.get(self._url(student_id=str(self.student.id)))
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_student_cannot_query_other_student(self):
        other_stu_user = make_user(UserRole.STUDENT, f"other_{uuid.uuid4().hex[:4]}@t.com")
        other_stu = Student.objects.create(
            user=other_stu_user, student_id=f"OTHER{uuid.uuid4().hex[:4]}",
            full_name="Other", department_name="D", semester_name="S", section_name="A",
        )
        res = self.stu_client.get(self._url(student_id=str(other_stu.id)))
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_csv_export(self):
        res = self.stu_client.get(self._url(export="csv"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("text/csv", res["Content-Type"])
        self.assertIn("attachment", res["Content-Disposition"])

    def test_xlsx_export(self):
        res = self.stu_client.get(self._url(export="xlsx"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("spreadsheetml", res["Content-Type"])

    def test_pdf_export(self):
        res = self.stu_client.get(self._url(export="pdf"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res["Content-Type"], "application/pdf")


# ===========================================================================
# Subject Report
# ===========================================================================

class SubjectReportTest(ReportFixture, APITestCase):

    def _url(self, **params):
        url = reverse("report-subject")
        params.setdefault("subject_id", str(self.subject.id))
        url += "?" + "&".join(f"{k}={v}" for k, v in params.items())
        return url

    def test_missing_subject_id_returns_400(self):
        res = self.adm_client.get(reverse("report-subject"))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_gets_subject_report(self):
        res = self.adm_client.get(self._url())
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()["data"]
        self.assertIn("by_student", data)
        self.assertIn("subject", data)

    def test_by_student_count(self):
        res = self.adm_client.get(self._url())
        by_student = res.json()["data"]["by_student"]
        self.assertEqual(len(by_student), 1)

    def test_csv_export(self):
        res = self.adm_client.get(self._url(export="csv"))
        self.assertIn("text/csv", res["Content-Type"])

    def test_xlsx_export(self):
        res = self.adm_client.get(self._url(export="xlsx"))
        self.assertIn("spreadsheetml", res["Content-Type"])

    def test_pdf_export(self):
        res = self.adm_client.get(self._url(export="pdf"))
        self.assertEqual(res["Content-Type"], "application/pdf")


# ===========================================================================
# Section Report
# ===========================================================================

class SectionReportTest(ReportFixture, APITestCase):

    def _url(self, **params):
        url = reverse("report-section")
        params.setdefault("section_id", str(self.section.id))
        url += "?" + "&".join(f"{k}={v}" for k, v in params.items())
        return url

    def test_missing_section_id_returns_400(self):
        res = self.adm_client.get(reverse("report-section"))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_gets_section_report(self):
        res = self.adm_client.get(self._url())
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()["data"]
        self.assertIn("rows", data)
        self.assertIn("subjects", data)
        self.assertIn("section", data)

    def test_rows_contain_student(self):
        res = self.adm_client.get(self._url())
        rows = res.json()["data"]["rows"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["student_id"], self.student.student_id)

    def test_csv_export(self):
        res = self.adm_client.get(self._url(export="csv"))
        self.assertIn("text/csv", res["Content-Type"])

    def test_xlsx_export(self):
        res = self.adm_client.get(self._url(export="xlsx"))
        self.assertIn("spreadsheetml", res["Content-Type"])

    def test_pdf_export(self):
        res = self.adm_client.get(self._url(export="pdf"))
        self.assertEqual(res["Content-Type"], "application/pdf")


# ===========================================================================
# Department Report
# ===========================================================================

class DepartmentReportTest(ReportFixture, APITestCase):

    def _url(self, **params):
        url = reverse("report-department")
        params.setdefault("department_id", str(self.dept.id))
        url += "?" + "&".join(f"{k}={v}" for k, v in params.items())
        return url

    def test_student_cannot_access_dept_report(self):
        res = self.stu_client.get(self._url())
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_gets_dept_report(self):
        res = self.adm_client.get(self._url())
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()["data"]
        self.assertIn("department", data)
        self.assertIn("by_section", data)
        self.assertIn("overall_avg", data)

    def test_csv_export(self):
        res = self.adm_client.get(self._url(export="csv"))
        self.assertIn("text/csv", res["Content-Type"])

    def test_xlsx_export(self):
        res = self.adm_client.get(self._url(export="xlsx"))
        self.assertIn("spreadsheetml", res["Content-Type"])

    def test_pdf_export(self):
        res = self.adm_client.get(self._url(export="pdf"))
        self.assertEqual(res["Content-Type"], "application/pdf")
