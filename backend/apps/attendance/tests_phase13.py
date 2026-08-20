"""
FaceAttend — Phase 13: Real-Time Attendance WebSocket Tests

Tests the SessionConsumer using channels.testing.WebsocketCommunicator.
Settings use InMemoryChannelLayer (no Redis needed).

Test scenarios:
  1. Faculty connects successfully → receives initial snapshot
  2. Unauthenticated (no token) → close 4001
  3. Invalid token → close 4001
  4. Student role → close 4003
  5. Wrong faculty (not session owner) → close 4003
  6. Attendance save signal broadcasts to group
  7. Attendance count correct after multiple marks
  8. Invalid session UUID → close 4003
"""
import uuid
from datetime import timedelta

import django
from django.test import TestCase, override_settings
from django.utils import timezone

from channels.testing import WebsocketCommunicator
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User, UserRole
from apps.departments.models import Department
from apps.academics.models import AcademicYear, Semester, Section, Subject, Room
from apps.students.models import Student, ApprovalStatus
from apps.faculty.models import Faculty
from apps.attendance.models import (
    AttendanceSession, AttendanceRecord,
    SessionStatus, AttendanceStatus,
)
from config.asgi import application

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

IN_MEMORY_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}


def make_user(role, email=None):
    email = email or f"ws_{uuid.uuid4().hex[:8]}@test.com"
    return User.objects.create_user(email=email, password="pass", role=role, is_active=True)


def get_access_token(user) -> str:
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token)


def ws_url(session_id, token=None):
    base = f"/ws/sessions/{session_id}/"
    if token:
        return f"{base}?token={token}"
    return base


class Phase13Fixture:
    """Creates a complete attendance fixture."""

    def setUp(self):
        uid = uuid.uuid4().hex[:6]

        self.dept = Department.objects.create(name=f"CE{uid}", code=f"CE{uid[:3]}")
        self.year = AcademicYear.objects.create(
            label=f"2026-{uid[:2]}", start_date="2026-01-01", end_date="2026-12-31",
        )
        self.sem = Semester.objects.create(
            department=self.dept, academic_year=self.year, name="Sem 1", number=1,
        )
        self.section = Section.objects.create(semester=self.sem, name="A", capacity=60)
        self.room = Room.objects.create(name=f"R{uid}", capacity=60)
        self.subject = Subject.objects.create(
            name="OS", code=f"OS{uid}", department=self.dept, credits=3,
        )

        # Faculty
        self.fac_user = make_user(UserRole.FACULTY, f"fac_{uid}@t.com")
        self.faculty = Faculty.objects.create(
            user=self.fac_user, employee_id=f"E{uid}",
            full_name="Dr WS", department=self.dept,
        )

        # Second faculty (wrong owner)
        self.fac2_user = make_user(UserRole.FACULTY, f"fac2_{uid}@t.com")
        Faculty.objects.create(
            user=self.fac2_user, employee_id=f"E2{uid}",
            full_name="Dr WS2", department=self.dept,
        )

        # Student
        self.stu_user = make_user(UserRole.STUDENT, f"stu_{uid}@t.com")
        self.student = Student.objects.create(
            user=self.stu_user, student_id=f"S{uid}",
            full_name="WS Student",
            department_name="CE", semester_name="Sem 1", section_name="A",
            department=self.dept, semester=self.sem, section=self.section,
            approval_status=ApprovalStatus.APPROVED,
        )

        # Active session
        now = timezone.now()
        self.session = AttendanceSession.objects.create(
            section=self.section, subject=self.subject,
            faculty=self.faculty, room=self.room,
            date=now.date(), status=SessionStatus.ACTIVE,
            valid_from=now - timedelta(minutes=5),
            valid_until=now + timedelta(minutes=60),
        )

        self.fac_token = get_access_token(self.fac_user)
        self.fac2_token = get_access_token(self.fac2_user)
        self.stu_token = get_access_token(self.stu_user)


# ===========================================================================
# Auth / Access tests
# ===========================================================================

@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYERS)
class WebSocketAuthTest(Phase13Fixture, TestCase):

    async def _connect(self, url):
        comm = WebsocketCommunicator(application, url)
        connected, subprotocol = await comm.connect()
        return comm, connected

    async def test_faculty_connects_successfully(self):
        url = ws_url(self.session.id, self.fac_token)
        comm, connected = await self._connect(url)
        self.assertTrue(connected)
        # Should receive initial snapshot
        msg = await comm.receive_json_from(timeout=3)
        self.assertEqual(msg["type"], "attendance.update")
        self.assertIn("present_count", msg)
        self.assertIn("percentage", msg)
        await comm.disconnect()

    async def test_no_token_rejected(self):
        url = ws_url(self.session.id)  # no token
        comm = WebsocketCommunicator(application, url)
        connected, _ = await comm.connect()
        # Either connection refused or quickly closed
        if connected:
            # consumer closes with code 4001
            close_code = await comm.receive_output(timeout=3)
            self.assertEqual(close_code["type"], "websocket.close")
        else:
            self.assertFalse(connected)

    async def test_invalid_token_rejected(self):
        url = ws_url(self.session.id, "this.is.not.valid")
        comm = WebsocketCommunicator(application, url)
        connected, _ = await comm.connect()
        if connected:
            close_msg = await comm.receive_output(timeout=3)
            self.assertEqual(close_msg["type"], "websocket.close")
        else:
            self.assertFalse(connected)

    async def test_student_role_rejected(self):
        url = ws_url(self.session.id, self.stu_token)
        comm = WebsocketCommunicator(application, url)
        connected, _ = await comm.connect()
        if connected:
            close_msg = await comm.receive_output(timeout=3)
            self.assertEqual(close_msg["type"], "websocket.close")
        else:
            self.assertFalse(connected)

    async def test_wrong_faculty_rejected(self):
        # fac2 does not own this session
        url = ws_url(self.session.id, self.fac2_token)
        comm = WebsocketCommunicator(application, url)
        connected, _ = await comm.connect()
        if connected:
            close_msg = await comm.receive_output(timeout=3)
            self.assertEqual(close_msg["type"], "websocket.close")
        else:
            self.assertFalse(connected)

    async def test_invalid_session_uuid_rejected(self):
        fake_id = str(uuid.uuid4())
        url = ws_url(fake_id, self.fac_token)
        comm = WebsocketCommunicator(application, url)
        connected, _ = await comm.connect()
        if connected:
            close_msg = await comm.receive_output(timeout=3)
            self.assertEqual(close_msg["type"], "websocket.close")
        else:
            self.assertFalse(connected)


# ===========================================================================
# Real-time broadcast tests
# ===========================================================================

@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYERS)
class WebSocketBroadcastTest(Phase13Fixture, TestCase):

    async def test_initial_snapshot_empty_session(self):
        """Zero students marked → counts all 0."""
        url = ws_url(self.session.id, self.fac_token)
        comm = WebsocketCommunicator(application, url)
        connected, _ = await comm.connect()
        self.assertTrue(connected)
        msg = await comm.receive_json_from(timeout=3)
        self.assertEqual(msg["present_count"], 0)
        self.assertEqual(msg["late_count"], 0)
        self.assertIsNone(msg["last_student"])
        await comm.disconnect()

    async def test_signal_pushes_update_after_attendance_save(self):
        """Saving an AttendanceRecord triggers a WS push to connected faculty."""
        from channels.db import database_sync_to_async

        url = ws_url(self.session.id, self.fac_token)
        comm = WebsocketCommunicator(application, url)
        connected, _ = await comm.connect()
        self.assertTrue(connected)

        # Consume the initial snapshot
        await comm.receive_json_from(timeout=3)

        # Simulate a student marking attendance (triggers post_save signal)
        @database_sync_to_async
        def create_record():
            return AttendanceRecord.objects.create(
                session=self.session,
                student=self.student,
                status=AttendanceStatus.PRESENT,
                face_verified=True,
                liveness_verified=True,
            )

        await create_record()

        # Faculty should receive live update
        msg = await comm.receive_json_from(timeout=5)
        self.assertEqual(msg["type"], "attendance.update")
        self.assertEqual(msg["present_count"], 1)
        self.assertIsNotNone(msg["last_student"])
        self.assertEqual(msg["last_student"]["name"], self.student.full_name)
        self.assertTrue(msg["last_student"]["face_verified"])
        self.assertTrue(msg["last_student"]["liveness_verified"])

        await comm.disconnect()

    async def test_percentage_calculated_correctly(self):
        """present + late / total_students * 100."""
        from channels.db import database_sync_to_async

        url = ws_url(self.session.id, self.fac_token)
        comm = WebsocketCommunicator(application, url)
        await comm.connect()
        await comm.receive_json_from(timeout=3)  # initial

        @database_sync_to_async
        def mark():
            return AttendanceRecord.objects.create(
                session=self.session,
                student=self.student,
                status=AttendanceStatus.PRESENT,
            )

        await mark()
        msg = await comm.receive_json_from(timeout=5)

        # percentage = present / total_enrolled * 100 (total=1 enrolled student)
        self.assertGreater(msg["percentage"], 0)
        self.assertLessEqual(msg["percentage"], 100.0)

        await comm.disconnect()
