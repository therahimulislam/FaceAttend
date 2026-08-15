"""
FaceAttend — Face Recognition Tests (Phase 10)

Tests face recognition during attendance submission.
The FaceEngine is mocked in ALL tests — no real model needed.

Scenarios tested:
  - Student with active enrollment + matching face → FACE method, face_verified=True
  - Student with active enrollment + mismatching face → 409 FACE_MISMATCH
  - Student sends face but no enrollment → graceful fallback (MANUAL)
  - Student sends face but engine raises FaceEngineError (no face) → 422
  - Student submits GPS only (no face) → GPS method, face_verified=False (Phase 8 compatibility)
  - Student submits both GPS + face → FACE_GPS method
  - Student submits GPS (within room) + face match → FACE_GPS, both verified=True
  - Student submits GPS (outside room) + face → 409 GEOFENCE_VIOLATION (GPS checked first)
  - face_score transparency field appears in successful face response
  - Unauthenticated submit is rejected
"""
import io
import uuid
import tempfile
import shutil
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch, MagicMock, PropertyMock

from django.urls import reverse
from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from PIL import Image

from apps.accounts.models import User, UserRole
from apps.departments.models import Department
from apps.academics.models import AcademicYear, Semester, Section, Room, Subject
from apps.faculty.models import Faculty
from apps.students.models import Student, ApprovalStatus
from apps.attendance.models import (
    AttendanceSession, AttendanceRecord,
    AttendanceStatus, VerificationMethod,
)
from apps.face.models import FaceEnrollment, EnrollmentStatus


# --------------------------------------------------------------------------
# Constants
# --------------------------------------------------------------------------
FAKE_EMBEDDING = [0.1] * 512        # "enrolled" embedding
MATCH_EMBEDDING = [0.1] * 512       # same → distance=0 → matches
MISMATCH_EMBEDDING = [0.0] * 511 + [1.0]  # differs


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
TEST_MEDIA = tempfile.mkdtemp()


def make_jpeg_bytes(w=200, h=200) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (120, 180, 80)).save(buf, "JPEG")
    return buf.getvalue()


def make_user(role, email=None, **kw):
    email = email or f"{uuid.uuid4().hex[:6]}@test.com"
    return User.objects.create_user(email=email, password="pass", role=role, **kw)


def auth_client(user):
    from rest_framework_simplejwt.tokens import RefreshToken
    c = APIClient()
    t = RefreshToken.for_user(user)
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {t.access_token}")
    return c


class Phase10Fixture(TestCase):
    """Common DB fixture for Phase 10 face recognition tests."""

    @classmethod
    def setUpTestData(cls):
        # Department / academic structure
        cls.dept = Department.objects.create(
            name=f"CS{uuid.uuid4().hex[:4]}", code=f"C{uuid.uuid4().hex[:3]}"
        )
        cls.year = AcademicYear.objects.create(
            label=f"2024-{uuid.uuid4().hex[:2]}",
            start_date="2024-07-01", end_date="2025-06-30",
        )
        cls.semester = Semester.objects.create(
            department=cls.dept, academic_year=cls.year, name="Sem 1", number=1
        )
        cls.section = Section.objects.create(
            semester=cls.semester, name="A", capacity=60
        )
        cls.room = Room.objects.create(
            name=f"Room{uuid.uuid4().hex[:4]}", capacity=50,
            # No GPS — geofence won't be enforced
        )
        cls.room_with_gps = Room.objects.create(
            name=f"RoomGPS{uuid.uuid4().hex[:4]}", capacity=50,
            latitude=Decimal("11.0168"), longitude=Decimal("76.9558"),
            geofence_radius=100,
        )

        # Faculty
        cls.fac_user = make_user(UserRole.FACULTY, f"fac10{uuid.uuid4().hex[:4]}@test.com")
        cls.faculty = Faculty.objects.create(
            user=cls.fac_user, employee_id=f"EMP{uuid.uuid4().hex[:6]}",
            full_name="Dr Test", department=cls.dept,
        )

        # Student
        cls.stu_user = make_user(UserRole.STUDENT, f"stu10{uuid.uuid4().hex[:4]}@test.com")
        cls.student = Student.objects.create(
            user=cls.stu_user, student_id=f"STU{uuid.uuid4().hex[:6]}",
            full_name="Student Test",
            department_name="CS", semester_name="Sem 1", section_name="A",
            department=cls.dept, semester=cls.semester, section=cls.section,
            approval_status=ApprovalStatus.APPROVED,
        )

        # Subject
        cls.subject = Subject.objects.create(
            name="AI", code=f"AI{uuid.uuid4().hex[:3]}",
            department=cls.dept, credits=3,
        )

    def _make_session(self, room=None, status_str="ACTIVE"):
        room = room or self.room
        session = AttendanceSession.objects.create(
            faculty=self.faculty, section=self.section, room=room,
            subject=self.subject, date=date.today(),
            valid_from=timezone.now() - timedelta(minutes=2),
            status=status_str,
            session_code=f"TEST{uuid.uuid4().hex[:6].upper()}",
        )
        return session

    def _make_enrollment(self, embedding=None, st=EnrollmentStatus.ACTIVE):
        """Give the student an active face enrollment."""
        from django.core.files.base import ContentFile
        enr, _ = FaceEnrollment.objects.update_or_create(
            student=self.student,
            defaults={
                "status": st,
                "embedding": embedding or FAKE_EMBEDDING,
                "error_message": "",
            },
        )
        enr.image.save("test.jpg", ContentFile(make_jpeg_bytes()), save=True)
        return enr

    def _submit(self, session, face_bytes=None, lat=None, lon=None):
        """POST to the submit endpoint."""
        data = {}
        if lat is not None:
            data["latitude"] = str(lat)
            data["longitude"] = str(lon)
        if face_bytes is not None:
            data["face_image"] = SimpleUploadedFile(
                "live.jpg", face_bytes, content_type="image/jpeg"
            )
        c = auth_client(self.stu_user)
        url = reverse("attendance-session-submit", args=[session.id])
        return c.post(url, data, format="multipart")


# ==========================================================================
# Tests
# ==========================================================================

@override_settings(MEDIA_ROOT=TEST_MEDIA)
class FaceRecognitionSubmitTest(Phase10Fixture):

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA, ignore_errors=True)

    # ------------------------------------------------------------------
    # 1. Successful face verification → method=FACE
    # ------------------------------------------------------------------
    @patch("apps.attendance.views.face_engine")
    def test_face_match_marks_present_with_face_method(self, mock_engine):
        mock_engine.embed.return_value = MATCH_EMBEDDING
        mock_engine.distance.return_value = 0.05
        mock_engine.matches.return_value = True
        mock_engine.THRESHOLD = 0.40

        self._make_enrollment()
        session = self._make_session()
        res = self._submit(session, face_bytes=make_jpeg_bytes())

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        body = res.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["face_verified"], True)
        self.assertEqual(body["data"]["verification_method"], "FACE")
        self.assertIn("_face_score", body["data"])
        self.assertEqual(body["data"]["_face_score"]["verified"], True)

        record = AttendanceRecord.objects.get(session=session, student=self.student)
        self.assertTrue(record.face_verified)
        self.assertEqual(record.verification_method, "FACE")

    # ------------------------------------------------------------------
    # 2. GPS + Face match → method=FACE_GPS
    # ------------------------------------------------------------------
    @patch("apps.attendance.views.face_engine")
    def test_gps_and_face_gives_face_gps_method(self, mock_engine):
        mock_engine.embed.return_value = MATCH_EMBEDDING
        mock_engine.distance.return_value = 0.05
        mock_engine.matches.return_value = True
        mock_engine.THRESHOLD = 0.40

        self._make_enrollment()
        # Use GPS room, student within radius
        session = self._make_session(room=self.room_with_gps)
        res = self._submit(
            session, face_bytes=make_jpeg_bytes(),
            lat="11.0168", lon="76.9558",  # exactly at room coords
        )

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        body = res.json()
        self.assertEqual(body["data"]["verification_method"], "FACE_GPS")
        self.assertTrue(body["data"]["face_verified"])
        self.assertTrue(body["data"]["gps_verified"])

    # ------------------------------------------------------------------
    # 3. Face mismatch → 409 FACE_MISMATCH
    # ------------------------------------------------------------------
    @patch("apps.attendance.views.face_engine")
    def test_face_mismatch_returns_409(self, mock_engine):
        mock_engine.embed.return_value = MISMATCH_EMBEDDING
        mock_engine.distance.return_value = 0.85
        mock_engine.matches.return_value = False
        mock_engine.THRESHOLD = 0.40

        self._make_enrollment()
        session = self._make_session()
        res = self._submit(session, face_bytes=make_jpeg_bytes())

        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        body = res.json()
        self.assertEqual(body["code"], "FACE_MISMATCH")
        self.assertIn("distance", body["errors"])

        # No record created
        self.assertFalse(
            AttendanceRecord.objects.filter(session=session, student=self.student).exists()
        )

    # ------------------------------------------------------------------
    # 4. No enrollment → face silently ignored, method=MANUAL
    # ------------------------------------------------------------------
    def test_face_without_enrollment_falls_back_to_manual(self):
        # No enrollment created for student
        session = self._make_session()
        res = self._submit(session, face_bytes=make_jpeg_bytes())

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        body = res.json()
        self.assertEqual(body["data"]["face_verified"], False)
        self.assertEqual(body["data"]["verification_method"], "MANUAL")
        self.assertIn("_face_warning", body["data"])

    # ------------------------------------------------------------------
    # 5. Face engine error → 422 FACE_DETECTION_FAILED
    # ------------------------------------------------------------------
    @patch("apps.attendance.views.face_engine")
    def test_face_engine_error_returns_422(self, mock_engine):
        from apps.face.engine import FaceEngineError
        mock_engine.embed.side_effect = FaceEngineError("No face detected in image.")

        self._make_enrollment()
        session = self._make_session()
        res = self._submit(session, face_bytes=make_jpeg_bytes())

        self.assertEqual(res.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        self.assertEqual(res.json()["code"], "FACE_DETECTION_FAILED")

    # ------------------------------------------------------------------
    # 6. GPS only, no face → Phase 8 behaviour unchanged
    # ------------------------------------------------------------------
    def test_gps_only_no_face_unchanged(self):
        session = self._make_session(room=self.room_with_gps)
        # Student within radius
        res = self._submit(session, lat="11.0168", lon="76.9558")

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        body = res.json()
        self.assertEqual(body["data"]["gps_verified"], True)
        self.assertEqual(body["data"]["face_verified"], False)
        self.assertEqual(body["data"]["verification_method"], "GPS")

    # ------------------------------------------------------------------
    # 7. GPS outside radius → 409 GEOFENCE_VIOLATION (checked before face)
    # ------------------------------------------------------------------
    @patch("apps.attendance.views.face_engine")
    def test_gps_outside_blocks_before_face_check(self, mock_engine):
        mock_engine.embed.return_value = MATCH_EMBEDDING
        mock_engine.matches.return_value = True

        self._make_enrollment()
        session = self._make_session(room=self.room_with_gps)
        # Send coords 500m away from room
        res = self._submit(
            session, face_bytes=make_jpeg_bytes(),
            lat="11.0220", lon="76.9558",
        )

        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(res.json()["code"], "GEOFENCE_VIOLATION")
        # face_engine.embed should NOT have been called — GPS rejected first
        mock_engine.embed.assert_not_called()

    # ------------------------------------------------------------------
    # 8. Manual submit (no GPS, no face) → method=MANUAL
    # ------------------------------------------------------------------
    def test_manual_submit_no_gps_no_face(self):
        session = self._make_session()
        res = self._submit(session)

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        body = res.json()
        self.assertEqual(body["data"]["verification_method"], "MANUAL")
        self.assertFalse(body["data"]["face_verified"])
        self.assertFalse(body["data"]["gps_verified"])

    # ------------------------------------------------------------------
    # 9. Revoked enrollment → treated as no enrollment → MANUAL
    # ------------------------------------------------------------------
    def test_revoked_enrollment_treated_as_no_enrollment(self):
        self._make_enrollment(st=EnrollmentStatus.REVOKED)
        session = self._make_session()
        res = self._submit(session, face_bytes=make_jpeg_bytes())

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        body = res.json()
        self.assertEqual(body["data"]["face_verified"], False)
        self.assertIn("_face_warning", body["data"])

    # ------------------------------------------------------------------
    # 10. Unauthenticated submit rejected
    # ------------------------------------------------------------------
    def test_unauthenticated_submit_rejected(self):
        session = self._make_session()
        url = reverse("attendance-session-submit", args=[session.id])
        res = APIClient().post(url, {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
