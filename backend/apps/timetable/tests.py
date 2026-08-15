"""
FaceAttend — Timetable Tests (Phase 5)
Tests for TimetableEntry CRUD and conflict detection.
"""
import uuid
from datetime import time
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.test import TestCase

from apps.accounts.models import User, UserRole
from apps.departments.models import Department
from apps.academics.models import AcademicYear, Semester, Section, Subject, Room
from apps.faculty.models import Faculty
from apps.timetable.models import TimetableEntry


# ---- Helpers ----

def make_user(role, email=None):
    email = email or f"{uuid.uuid4().hex[:6]}@test.com"
    return User.objects.create_user(email=email, password="pass", role=role)


def auth_client(user):
    from rest_framework_simplejwt.tokens import RefreshToken
    c = APIClient()
    t = RefreshToken.for_user(user)
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {t.access_token}")
    return c


def setup_academic_structure():
    """Build a minimal academic structure and return all parts."""
    dept = Department.objects.create(name="CS", code="CS")
    year = AcademicYear.objects.create(
        label="2024-25", start_date="2024-07-01", end_date="2025-06-30", is_current=True
    )
    semester = Semester.objects.create(
        department=dept, academic_year=year, name="Semester 3", number=3
    )
    section = Section.objects.create(semester=semester, name="A", capacity=60)
    subject = Subject.objects.create(code="CS301", name="Data Structures", department=dept)
    subject2 = Subject.objects.create(code="CS302", name="Algorithms", department=dept)
    room = Room.objects.create(name="CS-101", capacity=60)
    room2 = Room.objects.create(name="CS-102", capacity=60)
    faculty_user = make_user(UserRole.FACULTY)
    faculty = Faculty.objects.create(
        user=faculty_user, employee_id="FAC001", full_name="Prof. Jane", department=dept
    )
    faculty_user2 = make_user(UserRole.FACULTY)
    faculty2 = Faculty.objects.create(
        user=faculty_user2, employee_id="FAC002", full_name="Prof. John", department=dept
    )
    return {
        "dept": dept, "year": year, "semester": semester, "section": section,
        "subject": subject, "subject2": subject2,
        "room": room, "room2": room2,
        "faculty": faculty, "faculty2": faculty2,
    }


def make_entry(s, *, day="MON", start="09:00", end="10:00", **overrides):
    """Create a TimetableEntry from structure dict s with optional overrides."""
    return TimetableEntry.objects.create(
        section=s.get("section", overrides.pop("section", None)) or s["section"],
        subject=s.get("subject", overrides.pop("subject", None)) or s["subject"],
        faculty=s.get("faculty", overrides.pop("faculty", None)) or s["faculty"],
        room=s.get("room", overrides.pop("room", None)) or s["room"],
        day=day,
        start_time=time(*map(int, start.split(":"))),
        end_time=time(*map(int, end.split(":"))),
        **overrides,
    )


def entry_payload(s, *, day="MON", start="09:00", end="10:00"):
    return {
        "section": str(s["section"].id),
        "subject": str(s["subject"].id),
        "faculty": str(s["faculty"].id),
        "room": str(s["room"].id),
        "day": day,
        "start_time": start,
        "end_time": end,
    }


# ---- Tests ----

class TimetableCreateTest(TestCase):
    def setUp(self):
        self.admin = make_user(UserRole.DEPARTMENT_ADMIN)
        self.admin_client = auth_client(self.admin)
        self.s = setup_academic_structure()

    def test_admin_creates_entry(self):
        res = self.admin_client.post(
            reverse("timetable-list"),
            entry_payload(self.s),
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        body = res.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["subject_code"], "CS301")
        self.assertEqual(body["data"]["day"], "MON")

    def test_anonymous_cannot_create(self):
        res = APIClient().post(
            reverse("timetable-list"),
            entry_payload(self.s),
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_faculty_cannot_create(self):
        faculty_user = make_user(UserRole.FACULTY)
        res = auth_client(faculty_user).post(
            reverse("timetable-list"),
            entry_payload(self.s),
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_end_before_start_rejected(self):
        payload = entry_payload(self.s, start="10:00", end="09:00")
        res = self.admin_client.post(reverse("timetable-list"), payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class TimetableConflictTest(TestCase):
    def setUp(self):
        self.admin = make_user(UserRole.DEPARTMENT_ADMIN)
        self.admin_client = auth_client(self.admin)
        self.s = setup_academic_structure()
        # Create an existing entry: Mon 09:00–10:00
        make_entry(self.s, day="MON", start="09:00", end="10:00")

    def test_section_conflict_rejected(self):
        """Same section, same day, overlapping time → 409."""
        payload = entry_payload(self.s, day="MON", start="09:30", end="10:30")
        # Use a different subject & faculty & room to isolate section conflict
        payload["subject"] = str(self.s["subject2"].id)
        payload["room"] = str(self.s["room2"].id)
        payload["faculty"] = str(self.s["faculty2"].id)
        res = self.admin_client.post(reverse("timetable-list"), payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertFalse(res.json()["success"])

    def test_faculty_conflict_rejected(self):
        """Same faculty, same day, overlapping time → 409."""
        # Create a second section
        sem2 = self.s["semester"]
        section2 = Section.objects.create(semester=sem2, name="B", capacity=60)
        payload = entry_payload(self.s, day="MON", start="09:00", end="10:00")
        payload["section"] = str(section2.id)
        payload["room"] = str(self.s["room2"].id)
        res = self.admin_client.post(reverse("timetable-list"), payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)

    def test_room_conflict_rejected(self):
        """Same room, same day, overlapping time → 409."""
        section2 = Section.objects.create(semester=self.s["semester"], name="C", capacity=60)
        payload = entry_payload(self.s, day="MON", start="09:00", end="10:00")
        payload["section"] = str(section2.id)
        payload["faculty"] = str(self.s["faculty2"].id)
        res = self.admin_client.post(reverse("timetable-list"), payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)

    def test_no_conflict_different_day(self):
        """Same time but different day → no conflict."""
        payload = entry_payload(self.s, day="TUE", start="09:00", end="10:00")
        res = self.admin_client.post(reverse("timetable-list"), payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_no_conflict_adjacent_slots(self):
        """Exactly adjacent (10:00–11:00 after 09:00–10:00) → no conflict."""
        payload = entry_payload(self.s, day="MON", start="10:00", end="11:00")
        payload["subject"] = str(self.s["subject2"].id)
        res = self.admin_client.post(reverse("timetable-list"), payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)


class TimetableListFilterTest(TestCase):
    def setUp(self):
        self.admin = make_user(UserRole.DEPARTMENT_ADMIN)
        self.admin_client = auth_client(self.admin)
        self.faculty_user = make_user(UserRole.FACULTY)
        self.faculty_client = auth_client(self.faculty_user)
        self.s = setup_academic_structure()
        # Add a second section in a different semester
        dept2 = Department.objects.create(name="ECE", code="ECE")
        year2 = AcademicYear.objects.create(label="2024-25b", start_date="2024-07-01", end_date="2025-06-30")
        sem2 = Semester.objects.create(department=dept2, academic_year=year2, name="Sem 1", number=1)
        self.section2 = Section.objects.create(semester=sem2, name="A", capacity=60)
        subject2 = Subject.objects.create(code="EC201", name="Circuits", department=dept2)
        room2 = Room.objects.create(name="EC-101", capacity=60)
        faculty_user2 = make_user(UserRole.FACULTY)
        self.faculty2 = Faculty.objects.create(
            user=faculty_user2, employee_id="FAC003", full_name="Prof. Patel", department=dept2
        )
        # CS entry — MON 09:00
        make_entry(self.s, day="MON", start="09:00", end="10:00")
        # ECE entry — TUE 10:00
        TimetableEntry.objects.create(
            section=self.section2, subject=subject2, faculty=self.faculty2,
            room=room2, day="TUE", start_time=time(10, 0), end_time=time(11, 0)
        )

    def test_list_all_admin(self):
        res = self.admin_client.get(reverse("timetable-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["data"]["count"], 2)

    def test_filter_by_section(self):
        res = self.admin_client.get(
            reverse("timetable-list"),
            {"section": str(self.s["section"].id)},
        )
        self.assertEqual(res.json()["data"]["count"], 1)

    def test_filter_by_faculty(self):
        res = self.admin_client.get(
            reverse("timetable-list"),
            {"faculty": str(self.s["faculty"].id)},
        )
        self.assertEqual(res.json()["data"]["count"], 1)

    def test_filter_by_day(self):
        res = self.admin_client.get(reverse("timetable-list"), {"day": "MON"})
        self.assertEqual(res.json()["data"]["count"], 1)

    def test_faculty_user_can_list(self):
        res = self.faculty_client.get(reverse("timetable-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_anonymous_cannot_list(self):
        res = APIClient().get(reverse("timetable-list"))
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


class TimetableSoftDeleteTest(TestCase):
    def setUp(self):
        self.admin = make_user(UserRole.DEPARTMENT_ADMIN)
        self.admin_client = auth_client(self.admin)
        self.s = setup_academic_structure()
        self.entry = make_entry(self.s)

    def test_soft_delete(self):
        res = self.admin_client.delete(
            reverse("timetable-detail", args=[self.entry.id])
        )
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.entry.refresh_from_db()
        self.assertFalse(self.entry.is_active)

    def test_deleted_entry_hidden_from_list(self):
        self.entry.is_active = False
        self.entry.save()
        res = self.admin_client.get(reverse("timetable-list"))
        self.assertEqual(res.json()["data"]["count"], 0)

    def test_days_action(self):
        res = self.admin_client.get(reverse("timetable-days"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("MON", res.json()["data"])
