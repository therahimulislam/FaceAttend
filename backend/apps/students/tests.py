"""
FaceAttend — Student Management Tests (Phase 3)
"""
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.test import TestCase

from apps.accounts.models import User, UserRole
from apps.departments.models import Department
from apps.academics.models import AcademicYear, Semester, Section
from apps.faculty.models import Faculty
from .models import Student, ApprovalStatus


def make_admin():
    return User.objects.create_user(
        email="admin@test.com", password="pass", role=UserRole.DEPARTMENT_ADMIN
    )

def make_faculty_user():
    return User.objects.create_faculty(email="faculty@test.com", password="pass")

def make_student_user(email="student@test.com"):
    user = User.objects.create_user(email=email, password="pass", role=UserRole.STUDENT)
    student = Student.objects.create(
        user=user, student_id=email.split("@")[0].upper(),
        full_name="Test Student", department_name="CS",
        semester_name="Sem 1", section_name="A",
    )
    return user, student

def auth_client(user):
    from rest_framework_simplejwt.tokens import RefreshToken
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


class DepartmentViewSetTest(TestCase):
    """Tests for /api/v1/departments/"""

    def setUp(self):
        self.admin = make_admin()
        self.admin_client = auth_client(self.admin)
        self.public_client = APIClient()
        self.dept = Department.objects.create(name="Computer Science", code="CS")

    def test_public_can_list_departments(self):
        res = self.public_client.get(reverse("department-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_admin_can_create_department(self):
        res = self.admin_client.post(
            reverse("department-list"),
            {"name": "Electronics", "code": "ECE"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_anonymous_cannot_create_department(self):
        res = self.public_client.post(
            reverse("department-list"),
            {"name": "Electronics", "code": "ECE"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_department_soft_delete(self):
        res = self.admin_client.delete(
            reverse("department-detail", args=[self.dept.id])
        )
        self.dept.refresh_from_db()
        self.assertEqual(self.dept.status, "INACTIVE")


class SemesterSectionViewSetTest(TestCase):
    """Tests for /api/v1/academics/semesters/ and sections/"""

    def setUp(self):
        self.admin = make_admin()
        self.admin_client = auth_client(self.admin)
        self.public_client = APIClient()
        self.dept = Department.objects.create(name="CS", code="CS")
        self.year = AcademicYear.objects.create(
            label="2024-25", start_date="2024-07-01", end_date="2025-06-30", is_current=True
        )
        self.sem = Semester.objects.create(
            department=self.dept, academic_year=self.year,
            name="Semester 3", number=3
        )
        self.section = Section.objects.create(semester=self.sem, name="A", capacity=60)

    def test_public_list_semesters(self):
        res = self.public_client.get(reverse("semester-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_filter_semesters_by_department(self):
        res = self.public_client.get(
            reverse("semester-list"), {"department": str(self.dept.id)}
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["data"]["count"], 1)

    def test_list_sections_by_semester(self):
        res = self.public_client.get(
            reverse("section-list"), {"semester": str(self.sem.id)}
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["data"]["count"], 1)

    def test_admin_creates_section(self):
        res = self.admin_client.post(
            reverse("section-list"),
            {"semester": str(self.sem.id), "name": "B", "capacity": 55},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)


class FacultyViewSetTest(TestCase):
    """Tests for /api/v1/faculty/"""

    def setUp(self):
        self.admin = make_admin()
        self.admin_client = auth_client(self.admin)
        self.dept = Department.objects.create(name="CS", code="CS")

    def test_admin_creates_faculty(self):
        res = self.admin_client.post(
            reverse("faculty-list"),
            {
                "email": "prof@test.com",
                "password": "StrongPass123!",
                "employee_id": "FAC001",
                "full_name": "Prof. Jane",
                "department": str(self.dept.id),
                "designation": "Assistant Professor",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(email="prof@test.com", role=UserRole.FACULTY).exists())
        self.assertTrue(Faculty.objects.filter(employee_id="FAC001").exists())

    def test_duplicate_employee_id_rejected(self):
        user = make_faculty_user()
        Faculty.objects.create(user=user, employee_id="FAC001", full_name="Existing Faculty")
        res = self.admin_client.post(
            reverse("faculty-list"),
            {"email": "new@test.com", "password": "Pass123!", "employee_id": "FAC001", "full_name": "New"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_anonymous_cannot_list_faculty(self):
        res = APIClient().get(reverse("faculty-list"))
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


class StudentManagementTest(TestCase):
    """Tests for /api/v1/students/"""

    def setUp(self):
        self.admin = make_admin()
        self.admin_client = auth_client(self.admin)
        _, self.student = make_student_user()
        self.student_client = auth_client(self.student.user)
        self.dept = Department.objects.create(name="CS", code="CS")
        self.year = AcademicYear.objects.create(
            label="2024-25", start_date="2024-07-01", end_date="2025-06-30"
        )
        self.sem = Semester.objects.create(
            department=self.dept, academic_year=self.year, name="Sem 1", number=1
        )
        self.section = Section.objects.create(semester=self.sem, name="A")

    def test_admin_lists_students(self):
        res = self.admin_client.get(reverse("student-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["data"]["count"], 1)

    def test_filter_students_by_status(self):
        res = self.admin_client.get(
            reverse("student-list"), {"approval_status": "PENDING"}
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["data"]["count"], 1)

    def test_admin_approves_student(self):
        url = reverse("student-approve", args=[self.student.id])
        res = self.admin_client.post(url, {
            "department": str(self.dept.id),
            "semester": str(self.sem.id),
            "section": str(self.section.id),
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.student.refresh_from_db()
        self.assertEqual(self.student.approval_status, ApprovalStatus.APPROVED)
        self.assertEqual(self.student.department, self.dept)
        self.assertIsNotNone(self.student.approved_at)

    def test_admin_rejects_student(self):
        url = reverse("student-reject", args=[self.student.id])
        res = self.admin_client.post(url, {"rejection_reason": "Invalid ID"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.student.refresh_from_db()
        self.assertEqual(self.student.approval_status, ApprovalStatus.REJECTED)
        self.assertEqual(self.student.rejection_reason, "Invalid ID")

    def test_student_views_own_profile(self):
        res = self.student_client.get(reverse("student-me"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["data"]["student_id"], self.student.student_id)

    def test_student_cannot_list_all_students(self):
        res = self.student_client.get(reverse("student-list"))
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_suspends_student(self):
        url = reverse("student-suspend", args=[self.student.id])
        res = self.admin_client.post(url, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.student.refresh_from_db()
        self.assertEqual(self.student.approval_status, ApprovalStatus.SUSPENDED)

    def test_double_approve_returns_error(self):
        self.student.approval_status = ApprovalStatus.APPROVED
        self.student.save()
        res = self.admin_client.post(reverse("student-approve", args=[self.student.id]), {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
