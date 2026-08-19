"""
FaceAttend — Phase 12: Complete Verification Pipeline Tests

Milestone 1 end-to-end scenario:
  Admin creates student → face enrollment → admin approves → timetable entry
  → faculty starts session → student submits GPS + face + liveness
  → attendance record PRESENT with GPS✅ Face✅ Liveness✅ is_fully_verified=True

Additional tests:
  - Duplicate submit blocked (ALREADY_MARKED)
  - Timetable day mismatch adds _timetable_warning
  - Verification summary always present in response
  - Submit without face/liveness (manual) still works
  - is_fully_verified is True only when all three flags True
"""
import uuid
from datetime import timedelta
from unittest.mock import patch, MagicMock

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
from apps.face.models import FaceEnrollment, EnrollmentStatus, LivenessChallenge, ChallengeType, CHALLENGE_TTL_SECONDS
from apps.timetable.models import TimetableEntry, DayOfWeek


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(role, email=None, **kw):
    email = email or f"u_{uuid.uuid4().hex[:6]}@test.com"
    return User.objects.create_user(email=email, password="pass", role=role, is_active=True, **kw)


def auth_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


# ---------------------------------------------------------------------------
# Base mixin
# ---------------------------------------------------------------------------

class Phase12Mixin:
    """
    Creates a complete academic fixture:
    department → year → semester → section → room (with GPS) → subject
    → faculty → student (approved) → face enrollment (active)
    → timetable entry → attendance session (ACTIVE)
    """

    TODAY_DAY = {
        0: DayOfWeek.MONDAY, 1: DayOfWeek.TUESDAY,
        2: DayOfWeek.WEDNESDAY, 3: DayOfWeek.THURSDAY,
        4: DayOfWeek.FRIDAY, 5: DayOfWeek.SATURDAY,
    }.get(timezone.localtime().weekday(), DayOfWeek.MONDAY)

    def setUp(self):
        uid = uuid.uuid4().hex[:6]

        self.dept = Department.objects.create(name=f"CS{uid}", code=f"C{uid[:3]}")
        self.year = AcademicYear.objects.create(
            label=f"2026-{uid[:2]}", start_date="2026-01-01", end_date="2026-12-31",
        )
        self.semester = Semester.objects.create(
            department=self.dept, academic_year=self.year, name="Sem 1", number=1,
        )
        self.section = Section.objects.create(
            semester=self.semester, name="A", capacity=60,
        )
        # Room with GPS
        self.room = Room.objects.create(
            name=f"LH{uid}", capacity=60,
            latitude="13.0827", longitude="80.2707", geofence_radius=150,
        )
        self.subject = Subject.objects.create(
            name="AI", code=f"AI{uid}", department=self.dept, credits=3,
        )

        # Faculty
        self.fac_user = make_user(UserRole.FACULTY, f"fac{uid}@test.com")
        self.faculty = Faculty.objects.create(
            user=self.fac_user, employee_id=f"EMP{uid}",
            full_name="Dr Test", department=self.dept,
        )

        # Student (approved)
        self.stu_user = make_user(UserRole.STUDENT, f"stu{uid}@test.com")
        self.student = Student.objects.create(
            user=self.stu_user, student_id=f"STU{uid}",
            full_name="Test Student",
            department_name="CS", semester_name="Sem 1", section_name="A",
            department=self.dept, semester=self.semester, section=self.section,
            approval_status=ApprovalStatus.APPROVED,
        )

        # Active face enrollment
        self.enrollment = FaceEnrollment.objects.create(
            student=self.student,
            embedding=[0.1] * 512,
            status=EnrollmentStatus.ACTIVE,
        )

        # Timetable entry (today's day so it won't trigger the warning by default)
        self.timetable_entry = TimetableEntry.objects.create(
            academic_year=self.year,
            section=self.section,
            subject=self.subject,
            faculty=self.faculty,
            room=self.room,
            day=self.TODAY_DAY,
            start_time="09:00",
            end_time="10:00",
        )

        # Active attendance session linked to timetable
        now = timezone.now()
        self.session = AttendanceSession.objects.create(
            section=self.section,
            subject=self.subject,
            faculty=self.faculty,
            room=self.room,
            timetable_entry=self.timetable_entry,
            date=now.date(),
            status=SessionStatus.ACTIVE,
            valid_from=now - timedelta(minutes=5),
            valid_until=now + timedelta(minutes=60),
        )

        self.stu_client = auth_client(self.stu_user)
        self.fac_client = auth_client(self.fac_user)

    def _submit_url(self):
        return reverse("attendance-session-submit", args=[self.session.id])

    def _make_verified_liveness(self):
        """Create a pre-verified liveness challenge for self.student."""
        return LivenessChallenge.objects.create(
            student=self.student,
            challenge_type=ChallengeType.BLINK,
            expires_at=timezone.now() + timedelta(seconds=CHALLENGE_TTL_SECONDS),
            is_used=True,
            liveness_verified=True,
        )


# ===========================================================================
# 1. is_fully_verified model property
# ===========================================================================

class IsFullyVerifiedPropertyTest(Phase12Mixin, APITestCase):

    def _make_record(self, gps=False, face=False, liveness=False):
        return AttendanceRecord.objects.create(
            session=self.session,
            student=self.student,
            status=AttendanceStatus.PRESENT,
            gps_verified=gps,
            face_verified=face,
            liveness_verified=liveness,
        )

    def test_all_false_is_not_fully_verified(self):
        rec = self._make_record(gps=False, face=False, liveness=False)
        self.assertFalse(rec.is_fully_verified)

    def test_all_true_is_fully_verified(self):
        rec = self._make_record(gps=True, face=True, liveness=True)
        self.assertTrue(rec.is_fully_verified)

    def test_partial_gps_only_not_fully_verified(self):
        rec = self._make_record(gps=True, face=False, liveness=False)
        self.assertFalse(rec.is_fully_verified)

    def test_partial_gps_and_face_not_fully_verified(self):
        rec = self._make_record(gps=True, face=True, liveness=False)
        self.assertFalse(rec.is_fully_verified)


# ===========================================================================
# 2. Duplicate prevention
# ===========================================================================

class DuplicatePreventionTest(Phase12Mixin, APITestCase):

    def test_first_submit_succeeds(self):
        res = self.stu_client.post(self._submit_url(), {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_duplicate_submit_returns_409_already_marked(self):
        self.stu_client.post(self._submit_url(), {}, format="json")
        res = self.stu_client.post(self._submit_url(), {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(res.json()["code"], "ALREADY_MARKED")

    def test_only_one_record_after_duplicate(self):
        self.stu_client.post(self._submit_url(), {}, format="json")
        self.stu_client.post(self._submit_url(), {}, format="json")
        self.assertEqual(AttendanceRecord.objects.filter(session=self.session, student=self.student).count(), 1)


# ===========================================================================
# 3. Timetable day/time warning
# ===========================================================================

class TimetableWarningTest(Phase12Mixin, APITestCase):

    def test_matching_timetable_day_no_warning(self):
        res = self.stu_client.post(self._submit_url(), {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.json()["data"]
        # No timetable warning (day matches)
        self.assertIsNone(data.get("_timetable_warning"))

    def test_mismatched_timetable_day_adds_warning(self):
        # Change the entry day to a different day
        wrong_day = DayOfWeek.SATURDAY if self.TODAY_DAY != DayOfWeek.SATURDAY else DayOfWeek.MONDAY
        self.timetable_entry.day = wrong_day
        self.timetable_entry.save(update_fields=["day"])

        res = self.stu_client.post(self._submit_url(), {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.json()["data"]
        self.assertIn("_timetable_warning", data)
        self.assertIsNotNone(data["_timetable_warning"])

    def test_session_without_timetable_entry_no_warning(self):
        # Create a session with no timetable_entry
        now = timezone.now()
        session2 = AttendanceSession.objects.create(
            section=self.section, subject=self.subject,
            faculty=self.faculty, room=self.room,
            date=now.date(), status=SessionStatus.ACTIVE,
            valid_from=now - timedelta(minutes=5),
            valid_until=now + timedelta(minutes=60),
        )
        url = reverse("attendance-session-submit", args=[session2.id])
        res = self.stu_client.post(url, {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(res.json()["data"].get("_timetable_warning"))


# ===========================================================================
# 4. Verification summary always in response
# ===========================================================================

class VerificationSummaryTest(Phase12Mixin, APITestCase):

    def test_verification_summary_present_on_submit(self):
        res = self.stu_client.post(self._submit_url(), {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.json()["data"]
        self.assertIn("_verification_summary", data)
        summary = data["_verification_summary"]
        self.assertIn("section_match", summary)
        self.assertIn("gps_verified", summary)
        self.assertIn("face_verified", summary)
        self.assertIn("liveness_verified", summary)
        self.assertIn("is_fully_verified", summary)
        self.assertIn("timetable_warning", summary)

    def test_verification_summary_section_match_always_true(self):
        res = self.stu_client.post(self._submit_url(), {}, format="json")
        summary = res.json()["data"]["_verification_summary"]
        self.assertTrue(summary["section_match"])

    def test_manual_submit_summary_all_false(self):
        """No GPS/face/liveness → all False, is_fully_verified False."""
        res = self.stu_client.post(self._submit_url(), {}, format="json")
        summary = res.json()["data"]["_verification_summary"]
        self.assertFalse(summary["gps_verified"])
        self.assertFalse(summary["face_verified"])
        self.assertFalse(summary["liveness_verified"])
        self.assertFalse(summary["is_fully_verified"])


# ===========================================================================
# 5. Full pipeline (Milestone 1) — GPS + Face + Liveness
# ===========================================================================

class FullPipelineTest(Phase12Mixin, APITestCase):
    """
    Milestone 1: all three verification layers in one submission.
    Face recognition and geofence are mocked to pass.
    """

    # Room GPS: 13.0827, 80.2707 — student submits the exact same coords → inside geofence

    @patch("apps.attendance.views.face_engine")
    def test_full_pipeline_all_verified(self, mock_engine):
        """GPS ✅  Face ✅  Liveness ✅  → is_fully_verified True."""
        # Configure mock face engine
        mock_engine.embed.return_value = [0.1] * 512
        mock_engine.distance.return_value = 0.15
        mock_engine.matches.return_value = True
        mock_engine.THRESHOLD = 0.6

        challenge = self._make_verified_liveness()

        import io
        from PIL import Image
        buf = io.BytesIO()
        Image.new("RGB", (64, 64), color=(128, 128, 128)).save(buf, format="JPEG")
        buf.seek(0)
        from django.core.files.uploadedfile import SimpleUploadedFile
        face_file = SimpleUploadedFile("face.jpg", buf.read(), content_type="image/jpeg")

        payload = {
            "latitude": "13.0827",
            "longitude": "80.2707",
            "face_image": face_file,
            "liveness_challenge_id": str(challenge.id),
        }
        res = self.stu_client.post(self._submit_url(), payload, format="multipart")

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.json()["data"]

        # Flags on record
        self.assertTrue(data["gps_verified"])
        self.assertTrue(data["face_verified"])
        self.assertTrue(data["liveness_verified"])
        self.assertTrue(data["is_fully_verified"])

        # Summary block
        summary = data["_verification_summary"]
        self.assertTrue(summary["gps_verified"])
        self.assertTrue(summary["face_verified"])
        self.assertTrue(summary["liveness_verified"])
        self.assertTrue(summary["is_fully_verified"])
        self.assertIsNone(summary["timetable_warning"])

        # DB record
        record = AttendanceRecord.objects.get(session=self.session, student=self.student)
        self.assertTrue(record.gps_verified)
        self.assertTrue(record.face_verified)
        self.assertTrue(record.liveness_verified)
        self.assertTrue(record.is_fully_verified)
        self.assertIn(record.status, [AttendanceStatus.PRESENT, AttendanceStatus.LATE])

    def test_manual_submit_still_works(self):
        """No GPS, no face, no liveness → PRESENT, all False, manual method."""
        res = self.stu_client.post(self._submit_url(), {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.json()["data"]
        self.assertFalse(data["gps_verified"])
        self.assertFalse(data["face_verified"])
        self.assertFalse(data["liveness_verified"])
        self.assertFalse(data["is_fully_verified"])
        self.assertEqual(data["verification_method"], "MANUAL")

    @patch("apps.attendance.views.face_engine")
    def test_gps_and_face_without_liveness(self, mock_engine):
        """GPS ✅  Face ✅  no Liveness → is_fully_verified False."""
        mock_engine.embed.return_value = [0.1] * 512
        mock_engine.distance.return_value = 0.2
        mock_engine.matches.return_value = True
        mock_engine.THRESHOLD = 0.6

        import io
        from PIL import Image
        buf = io.BytesIO()
        Image.new("RGB", (64, 64)).save(buf, format="JPEG")
        buf.seek(0)
        from django.core.files.uploadedfile import SimpleUploadedFile
        face_file = SimpleUploadedFile("face.jpg", buf.read(), content_type="image/jpeg")

        payload = {
            "latitude": "13.0827",
            "longitude": "80.2707",
            "face_image": face_file,
        }
        res = self.stu_client.post(self._submit_url(), payload, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.json()["data"]
        self.assertTrue(data["gps_verified"])
        self.assertTrue(data["face_verified"])
        self.assertFalse(data["liveness_verified"])
        self.assertFalse(data["is_fully_verified"])  # not all three

    def test_late_status_after_grace_period(self):
        """Student arrives after 15-min grace period → LATE."""
        now = timezone.now()
        self.session.valid_from = now - timedelta(minutes=20)
        self.session.save(update_fields=["valid_from"])

        res = self.stu_client.post(self._submit_url(), {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        record = AttendanceRecord.objects.get(session=self.session, student=self.student)
        self.assertEqual(record.status, AttendanceStatus.LATE)


# ===========================================================================
# 6. is_fully_verified in serializer response
# ===========================================================================

class SerializerIsFullyVerifiedTest(Phase12Mixin, APITestCase):

    def test_is_fully_verified_in_submit_response(self):
        res = self.stu_client.post(self._submit_url(), {}, format="json")
        self.assertIn("is_fully_verified", res.json()["data"])

    def test_is_fully_verified_in_my_records(self):
        # Create a record
        AttendanceRecord.objects.create(
            session=self.session, student=self.student,
            status=AttendanceStatus.PRESENT,
            gps_verified=True, face_verified=True, liveness_verified=True,
        )
        res = self.stu_client.get("/api/v1/attendance/my/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        records = res.json()["data"]["results"]
        self.assertTrue(len(records) > 0)
        self.assertIn("is_fully_verified", records[0])
        self.assertTrue(records[0]["is_fully_verified"])
