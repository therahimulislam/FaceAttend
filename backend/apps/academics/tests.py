"""
FaceAttend — Academic Management Tests (Phase 4)
Tests for Subject and Room CRUD, plus Department/Semester/Section
management updates.
"""
import uuid
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.test import TestCase

from apps.accounts.models import User, UserRole
from apps.departments.models import Department
from apps.academics.models import AcademicYear, Semester, Section, Subject, Room


def make_admin():
    return User.objects.create_user(
        email=f"admin-{uuid.uuid4().hex[:6]}@test.com",
        password="pass",
        role=UserRole.DEPARTMENT_ADMIN,
    )


def make_faculty():
    return User.objects.create_user(
        email=f"faculty-{uuid.uuid4().hex[:6]}@test.com",
        password="pass",
        role=UserRole.FACULTY,
    )


def auth_client(user):
    from rest_framework_simplejwt.tokens import RefreshToken
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


class SubjectViewSetTest(TestCase):
    """Tests for /api/v1/academics/subjects/"""

    def setUp(self):
        self.admin = make_admin()
        self.admin_client = auth_client(self.admin)
        self.public = APIClient()
        self.dept = Department.objects.create(name="Computer Science", code="CS")

    # ---- CREATE ----
    def test_admin_creates_subject(self):
        res = self.admin_client.post(
            reverse("subject-list"),
            {
                "code": "CS301",
                "name": "Data Structures",
                "department": str(self.dept.id),
                "credits": 4,
                "hours_per_week": 4,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        body = res.json()
        self.assertEqual(body["code"], "CS301")
        self.assertEqual(body["department_name"], "Computer Science")

    def test_duplicate_code_rejected(self):
        Subject.objects.create(code="CS301", name="DS", department=self.dept)
        res = self.admin_client.post(
            reverse("subject-list"),
            {"code": "CS301", "name": "Other", "department": str(self.dept.id)},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_anonymous_cannot_create_subject(self):
        res = self.public.post(
            reverse("subject-list"),
            {"code": "CS999", "name": "X", "department": str(self.dept.id)},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    # ---- LIST / FILTER ----
    def test_public_can_list_subjects(self):
        Subject.objects.create(code="CS301", name="DS", department=self.dept)
        Subject.objects.create(code="CS302", name="OOP", department=self.dept)
        res = self.public.get(reverse("subject-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["data"]["count"], 2)

    def test_filter_subjects_by_department(self):
        dept2 = Department.objects.create(name="Electronics", code="ECE")
        Subject.objects.create(code="CS301", name="DS", department=self.dept)
        Subject.objects.create(code="EC201", name="Circuits", department=dept2)
        res = self.public.get(reverse("subject-list"), {"department": str(self.dept.id)})
        self.assertEqual(res.json()["data"]["count"], 1)

    def test_search_subjects(self):
        Subject.objects.create(code="CS301", name="Data Structures", department=self.dept)
        Subject.objects.create(code="CS302", name="Algorithms", department=self.dept)
        res = self.public.get(reverse("subject-list"), {"search": "Data"})
        self.assertEqual(res.json()["data"]["count"], 1)

    # ---- UPDATE ----
    def test_admin_updates_subject(self):
        subject = Subject.objects.create(code="CS301", name="DS", department=self.dept)
        res = self.admin_client.patch(
            reverse("subject-detail", args=[subject.id]),
            {"credits": 5},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        subject.refresh_from_db()
        self.assertEqual(subject.credits, 5)

    # ---- SOFT DELETE ----
    def test_admin_soft_deletes_subject(self):
        subject = Subject.objects.create(code="CS301", name="DS", department=self.dept)
        res = self.admin_client.delete(reverse("subject-detail", args=[subject.id]))
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        subject.refresh_from_db()
        self.assertEqual(subject.status, "INACTIVE")


class RoomViewSetTest(TestCase):
    """Tests for /api/v1/academics/rooms/"""

    def setUp(self):
        self.admin = make_admin()
        self.admin_client = auth_client(self.admin)
        self.faculty = make_faculty()
        self.faculty_client = auth_client(self.faculty)
        self.public = APIClient()

    # ---- CREATE ----
    def test_admin_creates_room(self):
        res = self.admin_client.post(
            reverse("room-list"),
            {
                "name": "CS-101",
                "building": "Block A",
                "floor": 1,
                "capacity": 60,
                "latitude": "11.0168",
                "longitude": "76.9558",
                "geofence_radius": 50,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        body = res.json()
        self.assertEqual(body["name"], "CS-101")
        self.assertTrue(body["has_gps"])

    def test_room_without_gps(self):
        res = self.admin_client.post(
            reverse("room-list"),
            {"name": "Library Hall", "capacity": 100},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertFalse(res.json()["has_gps"])

    def test_duplicate_room_name_rejected(self):
        Room.objects.create(name="CS-101", capacity=60)
        res = self.admin_client.post(
            reverse("room-list"),
            {"name": "CS-101", "capacity": 30},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_anonymous_cannot_list_rooms(self):
        res = self.public.get(reverse("room-list"))
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_faculty_can_list_rooms(self):
        Room.objects.create(name="CS-101", capacity=60)
        res = self.faculty_client.get(reverse("room-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    # ---- FILTER ----
    def test_filter_rooms_by_status(self):
        Room.objects.create(name="CS-101", capacity=60, status="ACTIVE")
        Room.objects.create(name="CS-102", capacity=60, status="UNDER_MAINTENANCE")
        res = self.admin_client.get(reverse("room-list"), {"status": "ACTIVE"})
        self.assertEqual(res.json()["data"]["count"], 1)

    def test_search_rooms(self):
        Room.objects.create(name="CS-101", building="Block A", capacity=60)
        Room.objects.create(name="Lab-3", building="Block B", capacity=40)
        res = self.admin_client.get(reverse("room-list"), {"search": "CS"})
        self.assertEqual(res.json()["data"]["count"], 1)

    # ---- UPDATE ----
    def test_admin_updates_room_gps(self):
        room = Room.objects.create(name="CS-101", capacity=60)
        res = self.admin_client.patch(
            reverse("room-detail", args=[room.id]),
            {"latitude": "11.0168", "longitude": "76.9558"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        room.refresh_from_db()
        self.assertTrue(room.has_gps)

    # ---- SOFT DELETE ----
    def test_admin_soft_deletes_room(self):
        room = Room.objects.create(name="CS-101", capacity=60)
        res = self.admin_client.delete(reverse("room-detail", args=[room.id]))
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        room.refresh_from_db()
        self.assertEqual(room.status, "INACTIVE")

    def test_faculty_cannot_create_room(self):
        res = self.faculty_client.post(
            reverse("room-list"),
            {"name": "New Room", "capacity": 30},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
