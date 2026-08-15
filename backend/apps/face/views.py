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
