"""
FaceAttend — Face Enrollment Tests (Phase 9)

Tests the enrollment endpoint, status transitions, revoke,
and the FaceEngine mock layer.

The FaceEngine is patched in all tests so no real model is needed.
"""
import io
import json
import uuid
import tempfile
import shutil
from datetime import date
from unittest.mock import patch, MagicMock

from django.urls import reverse
from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status

from PIL import Image

from apps.accounts.models import User, UserRole
from apps.departments.models import Department
from apps.academics.models import AcademicYear, Semester, Section
from apps.faculty.models import Faculty
from apps.students.models import Student, ApprovalStatus
from apps.face.models import FaceEnrollment, EnrollmentStatus


# ---- Helpers ----

FAKE_EMBEDDING = [0.1] * 512  # 512-d unit vector (approx)


def make_user(role, email=None):
    email = email or f"{uuid.uuid4().hex[:6]}@test.com"
    return User.objects.create_user(email=email, password="pass", role=role)


def auth_client(user):
    from rest_framework_simplejwt.tokens import RefreshToken
    c = APIClient()
    t = RefreshToken.for_user(user)
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {t.access_token}")
    return c


def make_200x200_jpeg() -> bytes:
    """Minimal 200×200 JPEG in memory."""
    buf = io.BytesIO()
    img = Image.new("RGB", (200, 200), color=(100, 150, 200))
    img.save(buf, format="JPEG")
    return buf.getvalue()


def make_small_jpeg() -> bytes:
    """50×50 JPEG — too small for enrollment."""
    buf = io.BytesIO()
    img = Image.new("RGB", (50, 50))
    img.save(buf, format="JPEG")
    return buf.getvalue()


def make_student():
    dept = Department.objects.create(name=f"CS{uuid.uuid4().hex[:4]}", code=f"C{uuid.uuid4().hex[:3]}")
    year = AcademicYear.objects.create(
        label=f"2024-{uuid.uuid4().hex[:2]}", start_date="2024-07-01", end_date="2025-06-30"
    )
    semester = Semester.objects.create(department=dept, academic_year=year, name="Sem 1", number=1)
    section = Section.objects.create(semester=semester, name="A", capacity=60)
    user = make_user(UserRole.STUDENT, f"stu{uuid.uuid4().hex[:4]}@test.com")
    student = Student.objects.create(
        user=user, student_id=f"STU{uuid.uuid4().hex[:6]}", full_name="Test Student",
        department_name="CS", semester_name="Sem 1", section_name="A",
        department=dept, semester=semester, section=section,
        approval_status=ApprovalStatus.APPROVED,
    )
    return user, student


def make_admin():
    return make_user(UserRole.SUPER_ADMIN, f"admin{uuid.uuid4().hex[:4]}@test.com")


# ============================================================================
# FaceEngine unit tests (mocked)
# ============================================================================

class FaceEngineUnitTest(TestCase):
    """Test cosine distance logic without a real model."""

    def test_distance_identical_embeddings(self):
        from apps.face.engine import FaceEngine
        engine = FaceEngine()
        emb = [1.0, 0.0, 0.0, 0.0]
        self.assertAlmostEqual(engine.distance(emb, emb), 0.0, places=4)

    def test_distance_orthogonal_embeddings(self):
        from apps.face.engine import FaceEngine
        engine = FaceEngine()
        emb1 = [1.0, 0.0]
        emb2 = [0.0, 1.0]
        self.assertAlmostEqual(engine.distance(emb1, emb2), 1.0, places=4)

    def test_matches_below_threshold(self):
        from apps.face.engine import FaceEngine
        engine = FaceEngine()
        emb = [1.0, 0.0, 0.0]
        # Same embedding → distance 0 → matches
        self.assertTrue(engine.matches(emb, emb))

    def test_no_match_above_threshold(self):
        from apps.face.engine import FaceEngine
        engine = FaceEngine()
        emb1 = [1.0, 0.0, 0.0]
        emb2 = [0.0, 1.0, 0.0]
        # Distance = 1.0 > 0.40 → no match
        self.assertFalse(engine.matches(emb1, emb2))


# ============================================================================
# Enrollment endpoint tests
# ============================================================================

# Use a temp directory for media files so tests don't try to write to /app
TEST_MEDIA = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=TEST_MEDIA)
class EnrollTest(TestCase):
    def setUp(self):
        self.stu_user, self.student = make_student()
        self.client = auth_client(self.stu_user)

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA, ignore_errors=True)

    def _upload(self, img_bytes=None, use_small=False):
        img_bytes = img_bytes or (make_small_jpeg() if use_small else make_200x200_jpeg())
        f = SimpleUploadedFile("face.jpg", img_bytes, content_type="image/jpeg")
        return self.client.post(reverse("face-enroll"), {"image": f}, format="multipart")

    @patch("apps.face.views.face_engine")
    def test_successful_enrollment(self, mock_engine):
        mock_engine.embed.return_value = FAKE_EMBEDDING
        res = self._upload()
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        body = res.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["status"], "ACTIVE")
        # DB check
        enr = FaceEnrollment.objects.get(student=self.student)
        self.assertEqual(enr.status, EnrollmentStatus.ACTIVE)
        self.assertEqual(len(enr.embedding), 512)

    @patch("apps.face.views.face_engine")
    def test_re_enrollment_replaces_old(self, mock_engine):
        mock_engine.embed.return_value = FAKE_EMBEDDING
        self._upload()  # first enrollment
        self._upload()  # second — replaces first
        self.assertEqual(FaceEnrollment.objects.filter(student=self.student).count(), 1)
        enr = FaceEnrollment.objects.get(student=self.student)
        self.assertEqual(enr.status, EnrollmentStatus.ACTIVE)

    @patch("apps.face.views.face_engine")
    def test_no_face_detected_returns_422(self, mock_engine):
        from apps.face.engine import FaceEngineError
        mock_engine.embed.side_effect = FaceEngineError("No face detected.")
        res = self._upload()
        self.assertEqual(res.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        body = res.json()
        self.assertEqual(body["code"], "FACE_DETECTION_FAILED")
        # Enrollment saved as FAILED
        enr = FaceEnrollment.objects.get(student=self.student)
        self.assertEqual(enr.status, EnrollmentStatus.FAILED)

    def test_image_too_small_rejected(self):
        res = self._upload(use_small=True)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unauthenticated_rejected(self):
        f = SimpleUploadedFile("face.jpg", make_200x200_jpeg(), content_type="image/jpeg")
        res = APIClient().post(reverse("face-enroll"), {"image": f}, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_faculty_cannot_enroll(self):
        fac_user = make_user(UserRole.FACULTY, "fac@test.com")
        fac_client = auth_client(fac_user)
        f = SimpleUploadedFile("face.jpg", make_200x200_jpeg(), content_type="image/jpeg")
        res = fac_client.post(reverse("face-enroll"), {"image": f}, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(res.json()["code"], "NOT_STUDENT")


@override_settings(MEDIA_ROOT=TEST_MEDIA)
class MyEnrollmentViewTest(TestCase):
    def setUp(self):
        self.stu_user, self.student = make_student()
        self.client = auth_client(self.stu_user)

    def test_get_no_enrollment(self):
        res = self.client.get(reverse("face-my-enrollment"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # data is None or empty when no enrollment exists
        data = res.json().get("data")
        self.assertFalse(data)  # None or {} or empty all count as "no enrollment"

    @patch("apps.face.views.face_engine")
    def test_get_active_enrollment(self, mock_engine):
        mock_engine.embed.return_value = FAKE_EMBEDDING
        f = SimpleUploadedFile("face.jpg", make_200x200_jpeg(), content_type="image/jpeg")
        self.client.post(reverse("face-enroll"), {"image": f}, format="multipart")
        res = self.client.get(reverse("face-my-enrollment"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["data"]["status"], "ACTIVE")

    @patch("apps.face.views.face_engine")
    def test_delete_enrollment(self, mock_engine):
        mock_engine.embed.return_value = FAKE_EMBEDDING
        f = SimpleUploadedFile("face.jpg", make_200x200_jpeg(), content_type="image/jpeg")
        self.client.post(reverse("face-enroll"), {"image": f}, format="multipart")
        res = self.client.delete(reverse("face-my-enrollment"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(FaceEnrollment.objects.filter(student=self.student).exists())


@override_settings(MEDIA_ROOT=TEST_MEDIA)
class RevokeEnrollmentTest(TestCase):
    def setUp(self):
        self.stu_user, self.student = make_student()
        self.admin_user = make_admin()
        self.admin_client = auth_client(self.admin_user)

    @patch("apps.face.views.face_engine")
    def test_admin_can_revoke(self, mock_engine):
        mock_engine.embed.return_value = FAKE_EMBEDDING
        # Student enrolls
        f = SimpleUploadedFile("face.jpg", make_200x200_jpeg(), content_type="image/jpeg")
        stu_client = auth_client(self.stu_user)
        stu_client.post(reverse("face-enroll"), {"image": f}, format="multipart")
        enr = FaceEnrollment.objects.get(student=self.student)
        # Admin revokes
        res = self.admin_client.post(reverse("face-enrollment-revoke", args=[enr.id]))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        enr.refresh_from_db()
        self.assertEqual(enr.status, EnrollmentStatus.REVOKED)
        self.assertEqual(enr.revoked_by, self.admin_user)

    def test_student_cannot_revoke(self):
        stu_client = auth_client(self.stu_user)
        fake_uuid = uuid.uuid4()
        res = stu_client.post(reverse("face-enrollment-revoke", args=[fake_uuid]))
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
