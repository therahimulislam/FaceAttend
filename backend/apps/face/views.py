"""
FaceAttend — Face Enrollment Views (Phase 9)

Endpoints:
  POST   /api/v1/face/enroll/              — student uploads face photo
  GET    /api/v1/face/my-enrollment/       — student views own enrollment status
  DELETE /api/v1/face/my-enrollment/       — student deletes own enrollment
  GET    /api/v1/face/enrollments/         — admin/faculty lists all enrollments
  POST   /api/v1/face/enrollments/{id}/revoke/ — admin revokes enrollment

Access matrix:
  Student: enroll, my-enrollment (GET/DELETE)
  Faculty/Admin: enrollments list, revoke
"""
import logging

from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsFacultyOrAdmin
from apps.common.responses import success_response, error_response
from .engine import face_engine, FaceEngineError
from .models import FaceEnrollment, EnrollmentStatus
from .serializers import (
    FaceEnrollmentSerializer, MyEnrollmentSerializer, EnrollUploadSerializer,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Student — enroll / view / delete own enrollment
# ---------------------------------------------------------------------------

class EnrollView(APIView):
    """
    POST /api/v1/face/enroll/
    Student uploads a frontal face photo; the server extracts the embedding
    and saves the enrollment. Replaces any previous enrollment for this student.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # Require student profile
        try:
            student = request.user.student_profile
        except Exception:
            return error_response(
                message="Only students can enroll a face.",
                code="NOT_STUDENT",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        # Validate upload
        ser = EnrollUploadSerializer(data=request.data)
        if not ser.is_valid():
            return error_response(errors=ser.errors)

        image_file = ser.validated_data["image"]

        # Read bytes
        image_bytes = image_file.read()

        # Create a PENDING enrollment (or update existing)
        enrollment, _ = FaceEnrollment.objects.update_or_create(
            student=student,
            defaults={
                "status": EnrollmentStatus.PENDING,
                "embedding": None,
                "error_message": "",
            },
        )
        # Attach the new image
        enrollment.image.delete(save=False)  # remove old file if any
        from django.core.files.base import ContentFile
        enrollment.image.save(
            f"{student.student_id}.jpg", ContentFile(image_bytes), save=False
        )
        enrollment.save()

        # Extract embedding
        try:
            embedding = face_engine.embed(image_bytes)
            enrollment.embedding = embedding
            enrollment.status = EnrollmentStatus.ACTIVE
            enrollment.error_message = ""
            enrollment.save()
            logger.info("Face enrolled for student %s", student.student_id)
            return success_response(
                data=MyEnrollmentSerializer(enrollment).data,
                message="Face enrolled successfully.",
                status_code=status.HTTP_201_CREATED,
            )
        except FaceEngineError as exc:
            enrollment.status = EnrollmentStatus.FAILED
            enrollment.error_message = str(exc)
            enrollment.save()
            return error_response(
                message=str(exc),
                code="FACE_DETECTION_FAILED",
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        except Exception as exc:
            logger.exception("Unexpected error during face enrollment: %s", exc)
            enrollment.status = EnrollmentStatus.FAILED
            enrollment.error_message = "Internal processing error."
            enrollment.save()
            return error_response(
                message="Face processing failed. Please try again.",
                code="PROCESSING_ERROR",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class MyEnrollmentView(APIView):
    """
    GET  /api/v1/face/my-enrollment/  — student sees own enrollment status
    DELETE /api/v1/face/my-enrollment/ — student removes own enrollment
    """
    permission_classes = [permissions.IsAuthenticated]

    def _get_student(self, request):
        try:
            return request.user.student_profile
        except Exception:
            return None

    def get(self, request):
        student = self._get_student(request)
        if not student:
            return error_response(message="Not a student.", code="NOT_STUDENT",
                                  status_code=status.HTTP_403_FORBIDDEN)
        try:
            enrollment = student.face_enrollment
        except FaceEnrollment.DoesNotExist:
            return success_response(data=None, message="No face enrolled yet.")
        return success_response(data=MyEnrollmentSerializer(enrollment).data)

    def delete(self, request):
        student = self._get_student(request)
        if not student:
            return error_response(message="Not a student.", code="NOT_STUDENT",
                                  status_code=status.HTTP_403_FORBIDDEN)
        try:
            enrollment = student.face_enrollment
            enrollment.image.delete(save=False)
            enrollment.delete()
            return success_response(message="Face enrollment removed.")
        except FaceEnrollment.DoesNotExist:
            return error_response(message="No face enrollment found.",
                                  status_code=status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# Admin / Faculty — list enrollments, revoke
# ---------------------------------------------------------------------------

class EnrollmentListView(generics.ListAPIView):
    """
    GET /api/v1/face/enrollments/
    Admin/faculty view of all face enrollments.
    """
    serializer_class = FaceEnrollmentSerializer
    permission_classes = [IsFacultyOrAdmin]
    queryset = FaceEnrollment.objects.select_related("student").order_by("-created_at")

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        # Optional filter by status
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter.upper())
        return success_response(data=FaceEnrollmentSerializer(qs, many=True).data)


class RevokeEnrollmentView(APIView):
    """
    POST /api/v1/face/enrollments/{pk}/revoke/
    Admin revokes a face enrollment — sets status to REVOKED.
    """
    permission_classes = [IsFacultyOrAdmin]

    def post(self, request, pk):
        try:
            enrollment = FaceEnrollment.objects.get(pk=pk)
        except FaceEnrollment.DoesNotExist:
            return error_response(message="Enrollment not found.",
                                  status_code=status.HTTP_404_NOT_FOUND)
        enrollment.status = EnrollmentStatus.REVOKED
        enrollment.revoked_by = request.user
        enrollment.revoked_at = timezone.now()
        enrollment.save()
        return success_response(
            data=FaceEnrollmentSerializer(enrollment).data,
            message="Enrollment revoked.",
        )


# ===========================================================================
# Phase 11 — Liveness Challenge + Verification
# ===========================================================================

class LivenessChallengeView(generics.GenericAPIView):
    """
    POST /api/v1/face/liveness/challenge/

    Issues a randomised, time-limited liveness challenge to the student.
    The student must perform the instructed action on their webcam and then
    submit the captured frames to /liveness/verify/.

    Request body (optional):
        { "session_code": "ABC123" }   — ties challenge to the current session

    Response:
        {
          "challenge_id": "<uuid>",
          "challenge_type": "BLINK",
          "instruction": "Slowly blink both eyes twice.",
          "expires_at": "<ISO datetime>",
          "nonce": "<hex string>"       — for client-side binding
        }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from apps.students.models import Student
        from apps.face.models import LivenessChallenge

        # Resolve student
        try:
            student = Student.objects.get(user=request.user)
        except Student.DoesNotExist:
            return error_response(
                message="Only students can request liveness challenges.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        session_code = request.data.get("session_code", "") or ""

        challenge = LivenessChallenge.create_for_student(
            student=student,
            session_code=session_code,
        )

        return success_response(
            data={
                "challenge_id": str(challenge.id),
                "challenge_type": challenge.challenge_type,
                "instruction": challenge.instruction,
                "expires_at": challenge.expires_at.isoformat(),
                "nonce": challenge.nonce,
            },
            message="Liveness challenge issued.",
            status_code=status.HTTP_201_CREATED,
        )


class LivenessVerifyView(generics.GenericAPIView):
    """
    POST /api/v1/face/liveness/verify/

    Verifies a liveness challenge by analysing submitted webcam frames.

    Request: multipart/form-data
        challenge_id   — UUID of the challenge issued by /liveness/challenge/
        frames         — 3 to 10 JPEG/PNG image files (webcam snapshots)

    Response (success):
        {
          "challenge_id": "<uuid>",
          "liveness_verified": true,
          "confidence": 0.73,
          "variance": 8.42,
          "frames_analyzed": 5,
          "faces_detected": 5
        }

    Response (liveness failed):
        HTTP 409 LIVENESS_FAILED with reason
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from apps.students.models import Student
        from apps.face.models import LivenessChallenge
        from apps.face.liveness import liveness_engine

        # ---- Resolve student ----
        try:
            student = Student.objects.get(user=request.user)
        except Student.DoesNotExist:
            return error_response(
                message="Only students can submit liveness frames.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        # ---- Validate challenge ----
        challenge_id = request.data.get("challenge_id")
        if not challenge_id:
            return error_response(
                message="challenge_id is required.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            challenge = LivenessChallenge.objects.get(id=challenge_id, student=student)
        except (LivenessChallenge.DoesNotExist, Exception):
            return error_response(
                message="Liveness challenge not found or does not belong to you.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if challenge.is_used:
            return error_response(
                message="This liveness challenge has already been used. Request a new one.",
                code="CHALLENGE_ALREADY_USED",
                status_code=status.HTTP_409_CONFLICT,
            )

        if challenge.is_expired:
            return error_response(
                message="Liveness challenge has expired. Request a new one.",
                code="CHALLENGE_EXPIRED",
                status_code=status.HTTP_409_CONFLICT,
            )

        # ---- Extract frames from request ----
        frame_files = request.FILES.getlist("frames")
        if not frame_files:
            return error_response(
                message="No frames submitted. Send 3–10 webcam frame images.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        frames_bytes = []
        for f in frame_files[:12]:
            try:
                frames_bytes.append(f.read())
            except Exception:
                pass

        # ---- Run liveness analysis ----
        result = liveness_engine.analyze(frames_bytes)

        # ---- Mark challenge as used (regardless of pass/fail) ----
        challenge.is_used = True
        challenge.liveness_verified = result.is_live
        challenge.variance = result.variance
        challenge.confidence = result.confidence
        challenge.frames_analyzed = result.frames_analyzed
        challenge.faces_detected = result.faces_detected
        challenge.fail_reason = "" if result.is_live else result.reason
        challenge.save()

        if not result.is_live:
            return error_response(
                message=result.reason,
                code="LIVENESS_FAILED",
                errors={
                    "variance": result.variance,
                    "confidence": result.confidence,
                    "faces_detected": result.faces_detected,
                    "frames_analyzed": result.frames_analyzed,
                },
                status_code=status.HTTP_409_CONFLICT,
            )

        return success_response(
            data={
                "challenge_id": str(challenge.id),
                "liveness_verified": True,
                "confidence": result.confidence,
                "variance": result.variance,
                "frames_analyzed": result.frames_analyzed,
                "faces_detected": result.faces_detected,
            },
            message="Liveness verified successfully.",
        )
