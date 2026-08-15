"""
FaceAttend — Phase 11: Liveness Detection Tests

Test suite for:
  1. LivenessEngine.analyze() — frame variance + face presence logic
  2. POST /face/liveness/challenge/ — challenge issuance
  3. POST /face/liveness/verify/ — challenge verification flow
  4. Liveness in attendance submit — liveness_verified field on record

All InsightFace/liveness model calls are mocked.
"""
import uuid
from datetime import timedelta
from unittest.mock import patch

import numpy as np
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User, UserRole
from apps.departments.models import Department
from apps.academics.models import AcademicYear, Semester, Section, Subject, Room
from apps.students.models import Student, ApprovalStatus
from apps.faculty.models import Faculty
from apps.attendance.models import AttendanceSession, AttendanceRecord, SessionStatus
from apps.face.models import LivenessChallenge, ChallengeType, CHALLENGE_TTL_SECONDS
from apps.face.liveness import LivenessEngine, LivenessResult


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(role, email=None, **kw):
    email = email or f"user_{uuid.uuid4().hex[:6]}@test.com"
    return User.objects.create_user(email=email, password="pass", role=role, is_active=True, **kw)


def make_png_bytes(width: int = 64, height: int = 64, seed: int = 0) -> bytes:
    """Return a valid PNG with pixel values derived from seed (so frames differ)."""
    rng = np.random.default_rng(seed)
    rgb = rng.integers(0, 256, (height, width, 3), dtype=np.uint8)
    import cv2
    _, buf = cv2.imencode(".png", rgb)
    return buf.tobytes()


def make_static_png_bytes() -> bytes:
    """Return a completely uniform PNG — simulates a printed photo."""
    import cv2
    img = np.full((64, 64, 3), 128, dtype=np.uint8)
    _, buf = cv2.imencode(".png", img)
    return buf.tobytes()


def django_file(raw: bytes, name: str = "frame.png"):
    """Wrap raw bytes in a Django in-memory file."""
    from django.core.files.uploadedfile import SimpleUploadedFile
    return SimpleUploadedFile(name, raw, content_type="image/png")


# ---------------------------------------------------------------------------
# Fixture mixin
# ---------------------------------------------------------------------------

class LivenessTestMixin:
    """Shared setUp for all liveness tests."""

    def setUp(self):
        uid = uuid.uuid4().hex[:6]

        self.dept = Department.objects.create(name=f"CS{uid}", code=f"C{uid[:3]}")
        self.year = AcademicYear.objects.create(
            label=f"2026-{uid[:2]}",
            start_date="2026-01-01", end_date="2026-12-31",
        )
        self.semester = Semester.objects.create(
            department=self.dept, academic_year=self.year,
            name="Sem 1", number=1,
        )
        self.section = Section.objects.create(
            semester=self.semester, name="A", capacity=60,
        )
        self.room = Room.objects.create(name=f"LH{uid}", capacity=60)
        self.subject = Subject.objects.create(
            name="AI", code=f"AI{uid}", department=self.dept, credits=3,
        )

        # Faculty
        self.fac_user = make_user(UserRole.FACULTY, f"fac{uid}@test.com")
        self.faculty = Faculty.objects.create(
            user=self.fac_user, employee_id=f"EMP{uid}",
            full_name="Dr Test", department=self.dept,
        )

        # Student
        self.stu_user = make_user(UserRole.STUDENT, f"stu{uid}@test.com")
        self.student = Student.objects.create(
            user=self.stu_user, student_id=f"STU{uid}",
            full_name="Test Student",
            department_name="CS", semester_name="Sem 1", section_name="A",
            department=self.dept, semester=self.semester, section=self.section,
            approval_status=ApprovalStatus.APPROVED,
        )
        self.client.force_authenticate(user=self.stu_user)
        self.student_user = self.stu_user

    def _make_challenge(self, challenge_type=ChallengeType.BLINK, expired=False, used=False, verified=None):
        """Create a LivenessChallenge directly."""
        delta = timedelta(seconds=-1) if expired else timedelta(seconds=CHALLENGE_TTL_SECONDS)
        ch = LivenessChallenge.objects.create(
            student=self.student,
            challenge_type=challenge_type,
            expires_at=timezone.now() + delta,
            is_used=used,
            liveness_verified=verified,
        )
        return ch

    def _make_session(self):
        return AttendanceSession.objects.create(
            subject=self.subject,
            section=self.section,
            faculty=self.faculty,
            room=self.room,
            date=timezone.now().date(),
            status=SessionStatus.ACTIVE,
            valid_from=timezone.now() - timedelta(minutes=5),
            valid_until=timezone.now() + timedelta(minutes=30),
        )


# ===========================================================================
# 1. LivenessEngine unit tests (no HTTP, pure engine logic)
# ===========================================================================

class LivenessEngineTest(LivenessTestMixin, APITestCase):
    """Direct tests of apps.face.liveness.LivenessEngine.analyze()."""

    def setUp(self):
        super().setUp()
        self.engine = LivenessEngine()

    # --- Too few frames ---
    def test_too_few_frames_fails(self):
        result = self.engine.analyze([make_png_bytes(seed=0), make_png_bytes(seed=1)])
        self.assertFalse(result.is_live)
        self.assertIn("Too few frames", result.reason)

    # --- Low variance (static image / photo attack) ---
    @patch("apps.face.engine.face_engine")
    def test_static_frames_fail(self, mock_engine):
        mock_engine.detect.return_value = True

        static_frame = make_static_png_bytes()
        frames = [static_frame] * 5

        result = self.engine.analyze(frames)
        self.assertFalse(result.is_live)
        self.assertIn("Insufficient motion", result.reason)
        self.assertLess(result.variance, self.engine.MIN_VARIANCE)

    # --- Sufficient variance (live face) ---
    @patch("apps.face.engine.face_engine")
    def test_varied_frames_pass(self, mock_engine):
        mock_engine.detect.return_value = True
        # Different seeds → different pixel values → high variance
        frames = [make_png_bytes(seed=i) for i in range(5)]

        result = self.engine.analyze(frames)
        self.assertTrue(result.is_live)
        self.assertGreaterEqual(result.variance, self.engine.MIN_VARIANCE)
        self.assertEqual(result.frames_analyzed, 5)

    # --- Face not detected in enough frames ---
    @patch("apps.face.engine.face_engine")
    def test_no_face_fails(self, mock_engine):
        mock_engine.detect.return_value = False  # no face in any frame
        frames = [make_png_bytes(seed=i) for i in range(5)]

        result = self.engine.analyze(frames)
        self.assertFalse(result.is_live)
        self.assertIn("Face not detected", result.reason)


# ===========================================================================
# 2. Challenge endpoint tests
# ===========================================================================

class LivenessChallengeEndpointTest(LivenessTestMixin, APITestCase):
    """Tests for POST /api/v1/face/liveness/challenge/"""

    CHALLENGE_URL = "/api/v1/face/liveness/challenge/"

    def test_issues_challenge(self):
        res = self.client.post(self.CHALLENGE_URL, {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        body = res.json()
        self.assertIn("challenge_id", body["data"])
        self.assertIn("challenge_type", body["data"])
        self.assertIn("instruction", body["data"])
        self.assertIn("expires_at", body["data"])
        self.assertIn("nonce", body["data"])

        ch = LivenessChallenge.objects.get(id=body["data"]["challenge_id"])
        self.assertEqual(ch.student, self.student)
        self.assertFalse(ch.is_used)
        self.assertIsNone(ch.liveness_verified)

    def test_challenge_type_in_valid_choices(self):
        res = self.client.post(self.CHALLENGE_URL, {}, format="json")
        data = res.json()["data"]
        self.assertIn(data["challenge_type"], list(ChallengeType.values))

    def test_with_session_code(self):
        res = self.client.post(self.CHALLENGE_URL, {"session_code": "ABC123"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        ch = LivenessChallenge.objects.get(id=res.json()["data"]["challenge_id"])
        self.assertEqual(ch.session_code, "ABC123")

    def test_unauthenticated_rejected(self):
        self.client.logout()
        res = self.client.post(self.CHALLENGE_URL, {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


# ===========================================================================
# 3. Verify endpoint tests
# ===========================================================================

class LivenessVerifyEndpointTest(LivenessTestMixin, APITestCase):
    """Tests for POST /api/v1/face/liveness/verify/"""

    VERIFY_URL = "/api/v1/face/liveness/verify/"

    @patch("apps.face.liveness.liveness_engine")
    def test_liveness_pass(self, mock_engine):
        mock_engine.analyze.return_value = LivenessResult(
            is_live=True, reason="Liveness verified.",
            confidence=0.80, variance=9.5,
            faces_detected=5, frames_analyzed=5,
        )
        ch = self._make_challenge()
        frames = [django_file(make_png_bytes(seed=i), f"f{i}.png") for i in range(5)]

        data = {"challenge_id": str(ch.id)}
        res = self.client.post(self.VERIFY_URL, data, format="multipart")
        # Need to include frames
        # Use raw form submission
        res = self.client.post(
            self.VERIFY_URL,
            {"challenge_id": str(ch.id), "frames": frames},
            format="multipart",
        )

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        body = res.json()
        self.assertTrue(body["data"]["liveness_verified"])
        self.assertIn("confidence", body["data"])

        ch.refresh_from_db()
        self.assertTrue(ch.is_used)
        self.assertTrue(ch.liveness_verified)

    @patch("apps.face.liveness.liveness_engine")
    def test_liveness_fail(self, mock_engine):
        mock_engine.analyze.return_value = LivenessResult(
            is_live=False,
            reason="Insufficient motion detected (variance=0.10, required≥2.5). This may be a static image.",
            confidence=0.01, variance=0.10,
            faces_detected=5, frames_analyzed=5,
        )
        ch = self._make_challenge()
        frames = [django_file(make_static_png_bytes(), f"f{i}.png") for i in range(5)]

        res = self.client.post(
            self.VERIFY_URL,
            {"challenge_id": str(ch.id), "frames": frames},
            format="multipart",
        )

        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        body = res.json()
        self.assertEqual(body["code"], "LIVENESS_FAILED")
        self.assertIn("variance", body["errors"])

        ch.refresh_from_db()
        self.assertTrue(ch.is_used)
        self.assertFalse(ch.liveness_verified)

    @patch("apps.face.liveness.liveness_engine")
    def test_expired_challenge_rejected(self, mock_engine):
        ch = self._make_challenge(expired=True)
        frames = [django_file(make_png_bytes(seed=i), f"f{i}.png") for i in range(3)]
        res = self.client.post(
            self.VERIFY_URL,
            {"challenge_id": str(ch.id), "frames": frames},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(res.json()["code"], "CHALLENGE_EXPIRED")
        # Engine must NOT have been called
        mock_engine.analyze.assert_not_called()

    @patch("apps.face.liveness.liveness_engine")
    def test_already_used_challenge_rejected(self, mock_engine):
        ch = self._make_challenge(used=True, verified=True)
        frames = [django_file(make_png_bytes(seed=i), f"f{i}.png") for i in range(3)]
        res = self.client.post(
            self.VERIFY_URL,
            {"challenge_id": str(ch.id), "frames": frames},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(res.json()["code"], "CHALLENGE_ALREADY_USED")
        mock_engine.analyze.assert_not_called()

    def test_missing_challenge_id_returns_400(self):
        frames = [django_file(make_png_bytes(seed=i), f"f{i}.png") for i in range(3)]
        res = self.client.post(self.VERIFY_URL, {"frames": frames}, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_wrong_challenge_owner_rejected(self):
        # Create a second student with correct fields
        uid2 = uuid.uuid4().hex[:6]
        user2 = make_user(UserRole.STUDENT, f"other{uid2}@test.com")
        Student.objects.create(
            user=user2, student_id=f"STU2{uid2}",
            full_name="Other Student",
            department_name="CS", semester_name="Sem 1", section_name="A",
            department=self.dept, semester=self.semester, section=self.section,
            approval_status=ApprovalStatus.APPROVED,
        )
        # Challenge belongs to self.student, but auth as user2
        ch = self._make_challenge()
        self.client.force_authenticate(user=user2)

        frames = [django_file(make_png_bytes(seed=i), f"f{i}.png") for i in range(3)]
        res = self.client.post(
            self.VERIFY_URL,
            {"challenge_id": str(ch.id), "frames": frames},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_no_frames_returns_400(self):
        ch = self._make_challenge()
        res = self.client.post(
            self.VERIFY_URL,
            {"challenge_id": str(ch.id)},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


# ===========================================================================
# 4. Attendance submit — liveness_verified field
# ===========================================================================

class LivenessInAttendanceSubmitTest(LivenessTestMixin, APITestCase):
    """Tests that liveness_challenge_id flows correctly into AttendanceRecord."""

    def _submit_url(self, session):
        return f"/api/v1/attendance/sessions/{session.id}/submit/"

    @patch("apps.face.engine.face_engine")
    def test_valid_liveness_challenge_sets_liveness_verified(self, mock_engine):
        mock_engine.detect.return_value = True
        mock_engine.embed.return_value = [0.5] * 512
        mock_engine.distance.return_value = 0.05
        mock_engine.matches.return_value = True
        mock_engine.THRESHOLD = 0.40

        session = self._make_session()
        # Challenge was verified 10 seconds ago (well within 5-minute window)
        ch = LivenessChallenge.objects.create(
            student=self.student,
            challenge_type=ChallengeType.BLINK,
            expires_at=timezone.now() + timedelta(seconds=50),
            is_used=True,
            liveness_verified=True,
        )

        res = self.client.post(
            self._submit_url(session),
            {"liveness_challenge_id": str(ch.id)},
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        record = AttendanceRecord.objects.get(session=session, student=self.student)
        self.assertTrue(record.liveness_verified)
        self.assertNotIn("_liveness_warning", res.json()["data"])

    @patch("apps.face.engine.face_engine")
    def test_invalid_challenge_id_adds_warning(self, mock_engine):
        mock_engine.THRESHOLD = 0.40
        session = self._make_session()

        res = self.client.post(
            self._submit_url(session),
            {"liveness_challenge_id": str(uuid.uuid4())},  # non-existent
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        body = res.json()
        record = AttendanceRecord.objects.get(session=session, student=self.student)
        self.assertFalse(record.liveness_verified)
        self.assertIn("_liveness_warning", body["data"])

    @patch("apps.face.engine.face_engine")
    def test_no_liveness_challenge_leaves_liveness_false(self, mock_engine):
        mock_engine.THRESHOLD = 0.40
        session = self._make_session()

        res = self.client.post(
            self._submit_url(session),
            {},
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        body = res.json()
        self.assertTrue(body.get("success", False))
        record = AttendanceRecord.objects.get(session=session, student=self.student)
        self.assertFalse(record.liveness_verified)
