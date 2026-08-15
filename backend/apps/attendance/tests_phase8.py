"""
FaceAttend — GPS Geofence Tests (Phase 8)

Tests the haversine utility and the full geofence enforcement in the
student attendance submit endpoint.
"""
import math
from datetime import date
from django.urls import reverse
from django.test import TestCase, SimpleTestCase
from rest_framework.test import APIClient
from rest_framework import status
import uuid

from apps.common.gps import haversine_distance, check_geofence, GeofenceResult
from apps.accounts.models import User, UserRole
from apps.departments.models import Department
from apps.academics.models import AcademicYear, Semester, Section, Subject, Room
from apps.faculty.models import Faculty
from apps.students.models import Student, ApprovalStatus
from apps.attendance.models import AttendanceSession


# ============================================================================
# Unit tests — Haversine formula
# ============================================================================

class HaversineTest(SimpleTestCase):
    """Verify haversine distance accuracy against known values."""

    def test_same_point_is_zero(self):
        d = haversine_distance(11.0168, 76.9558, 11.0168, 76.9558)
        self.assertAlmostEqual(d, 0.0, places=3)

    def test_known_distance_coimbatore_chennai(self):
        # Coimbatore → Chennai: approximately 427 km (straight line haversine)
        d = haversine_distance(11.0168, 76.9558, 13.0827, 80.2707)
        self.assertAlmostEqual(d / 1000, 427, delta=10)

    def test_100m_north_shift(self):
        # Moving 0.0009 degrees north ≈ 100m
        lat1, lon = 11.0168, 76.9558
        lat2 = lat1 + 0.0009
        d = haversine_distance(lat1, lon, lat2, lon)
        self.assertAlmostEqual(d, 100, delta=5)


class CheckGeofenceTest(SimpleTestCase):
    """Verify GeofenceResult for within/outside scenarios."""

    ROOM_LAT = 11.0168
    ROOM_LON = 76.9558

    def test_student_inside_geofence(self):
        # 20m north of room — within 50m radius
        result = check_geofence(
            student_lat=self.ROOM_LAT + 0.00018,
            student_lon=self.ROOM_LON,
            room_lat=self.ROOM_LAT,
            room_lon=self.ROOM_LON,
            radius_meters=50,
        )
        self.assertTrue(result.within)
        self.assertLess(result.distance_meters, 50)
        self.assertEqual(result.exceeded_by_meters, 0)

    def test_student_exactly_on_boundary(self):
        # Exactly on 50m radius boundary
        result = check_geofence(
            student_lat=self.ROOM_LAT + 0.00045,  # ~50m north
            student_lon=self.ROOM_LON,
            room_lat=self.ROOM_LAT,
            room_lon=self.ROOM_LON,
            radius_meters=50,
        )
        # Allow delta due to spherical approximation
        self.assertAlmostEqual(result.distance_meters, 50, delta=5)

    def test_student_outside_geofence(self):
        # 500m north of room — outside 50m radius
        result = check_geofence(
            student_lat=self.ROOM_LAT + 0.0045,
            student_lon=self.ROOM_LON,
            room_lat=self.ROOM_LAT,
            room_lon=self.ROOM_LON,
            radius_meters=50,
        )
        self.assertFalse(result.within)
        self.assertGreater(result.exceeded_by_meters, 400)


# ============================================================================
# Integration tests — Submit with geofence
# ============================================================================

def make_user(role, email=None):
    email = email or f"{uuid.uuid4().hex[:6]}@test.com"
    return User.objects.create_user(email=email, password="pass", role=role)


def auth_client(user):
    from rest_framework_simplejwt.tokens import RefreshToken
    c = APIClient()
    t = RefreshToken.for_user(user)
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {t.access_token}")
    return c


def build_world(room_lat=None, room_lon=None, radius=50):
    dept = Department.objects.create(name="CS", code="CS")
    year = AcademicYear.objects.create(label="2024-25", start_date="2024-07-01", end_date="2025-06-30")
    semester = Semester.objects.create(department=dept, academic_year=year, name="Sem 3", number=3)
    section = Section.objects.create(semester=semester, name="A", capacity=60)
    subject = Subject.objects.create(code="CS301", name="Data Structures", department=dept)
    room = Room.objects.create(
        name="CS-101", capacity=60,
        latitude=room_lat, longitude=room_lon,
        geofence_radius=radius,
    )
    fac_user = make_user(UserRole.FACULTY, "fac@test.com")
    faculty = Faculty.objects.create(
        user=fac_user, employee_id="FAC001", full_name="Prof", department=dept
    )
    stu_user = make_user(UserRole.STUDENT, "stu@test.com")
    student = Student.objects.create(
        user=stu_user, student_id="CS001", full_name="Alice",
        department_name="CS", semester_name="Sem 3", section_name="A",
        department=dept, semester=semester, section=section,
        approval_status=ApprovalStatus.APPROVED,
    )
    sess = AttendanceSession.objects.create(
        section=section, subject=subject, faculty=faculty, room=room,
        date=date.today(), duration_minutes=60,
    )
    sess.start()
    return {"session": sess, "student_user": stu_user, "student": student, "room": room}


# Real coordinates: Coimbatore ~ 11.0168°N, 76.9558°E
ROOM_LAT = 11.0168
ROOM_LON = 76.9558


class GeofenceSubmitTest(TestCase):
    def test_inside_geofence_accepted(self):
        w = build_world(room_lat=ROOM_LAT, room_lon=ROOM_LON, radius=100)
        c = auth_client(w["student_user"])
        # Student 20m north of room
        res = c.post(
            reverse("attendance-session-submit", args=[w["session"].id]),
            {"latitude": str(ROOM_LAT + 0.00018), "longitude": str(ROOM_LON)},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.json()["data"]["gps_verified"])

    def test_outside_geofence_rejected(self):
        w = build_world(room_lat=ROOM_LAT, room_lon=ROOM_LON, radius=50)
        c = auth_client(w["student_user"])
        # Student 500m north of room
        res = c.post(
            reverse("attendance-session-submit", args=[w["session"].id]),
            {"latitude": str(ROOM_LAT + 0.0045), "longitude": str(ROOM_LON)},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        body = res.json()
        self.assertEqual(body["code"], "GEOFENCE_VIOLATION")
        self.assertIn("distance_meters", body["errors"])
        self.assertGreater(body["errors"]["exceeded_by"], 400)

    def test_no_gps_no_room_coords_accepted_as_manual(self):
        # Room has no GPS — student submits without coords
        w = build_world(room_lat=None, room_lon=None)
        c = auth_client(w["student_user"])
        res = c.post(
            reverse("attendance-session-submit", args=[w["session"].id]),
            {},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        body = res.json()["data"]
        self.assertEqual(body["verification_method"], "MANUAL")
        self.assertFalse(body["gps_verified"])

    def test_gps_provided_but_room_has_no_coords_accepted(self):
        # Room has no GPS — student shares location anyway — skip enforcement
        w = build_world(room_lat=None, room_lon=None)
        c = auth_client(w["student_user"])
        res = c.post(
            reverse("attendance-session-submit", args=[w["session"].id]),
            {"latitude": str(ROOM_LAT + 0.0001), "longitude": str(ROOM_LON)},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        body = res.json()["data"]
        # GPS captured as GPS method but not verified (no room coords to verify against)
        self.assertEqual(body["verification_method"], "GPS")
        self.assertFalse(body["gps_verified"])
        self.assertIn("_geofence_warning", res.json()["data"])

    def test_session_with_no_room_accepts_without_gps(self):
        # Session has no room at all
        dept = Department.objects.create(name="EE", code="EE")
        year = AcademicYear.objects.create(label="2024-25b", start_date="2024-07-01", end_date="2025-06-30")
        semester = Semester.objects.create(department=dept, academic_year=year, name="Sem 1", number=1)
        section = Section.objects.create(semester=semester, name="A", capacity=60)
        subject = Subject.objects.create(code="EE101", name="Circuits", department=dept)
        fac_user = make_user(UserRole.FACULTY, "fac2@test.com")
        faculty = Faculty.objects.create(user=fac_user, employee_id="F002", full_name="Dr X", department=dept)
        stu_user = make_user(UserRole.STUDENT, "stu2@test.com")
        student = Student.objects.create(
            user=stu_user, student_id="EE001", full_name="Bob",
            department_name="EE", semester_name="Sem 1", section_name="A",
            department=dept, semester=semester, section=section,
            approval_status=ApprovalStatus.APPROVED,
        )
        sess = AttendanceSession.objects.create(
            section=section, subject=subject, faculty=faculty, room=None,
            date=date.today(), duration_minutes=60,
        )
        sess.start()
        c = auth_client(stu_user)
        res = c.post(
            reverse("attendance-session-submit", args=[sess.id]),
            {}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
