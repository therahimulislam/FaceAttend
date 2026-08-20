"""
FaceAttend — Student Management Views (Phase 3)

Admin endpoints for listing and managing student registrations,
plus a student self-service endpoint for their own profile.
"""
from django.utils import timezone
from django_filters import rest_framework as django_filters
from rest_framework import viewsets, status, permissions, filters
from rest_framework.decorators import action
from rest_framework.request import Request

from apps.common.responses import success_response, error_response
from apps.common.pagination import StandardPagination
from apps.common.permissions import IsAdminUser, IsSuperAdminOrDeptAdmin, IsStudent
from .models import Student, ApprovalStatus
from .serializers import (
    StudentSerializer,
    StudentMinimalSerializer,
    StudentProfileSerializer,
    ApproveStudentSerializer,
    RejectStudentSerializer,
)


class StudentFilter(django_filters.FilterSet):
    approval_status = django_filters.MultipleChoiceFilter(
        choices=ApprovalStatus.choices,
    )
    department = django_filters.UUIDFilter(field_name="department__id")
    semester = django_filters.UUIDFilter(field_name="semester__id")
    section = django_filters.UUIDFilter(field_name="section__id")

    class Meta:
        model = Student
        fields = ["approval_status", "department", "semester", "section"]


class StudentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/v1/students/         — list students (admin/faculty)
    GET /api/v1/students/{id}/    — retrieve student (admin/faculty)
    GET /api/v1/students/me/      — student's own profile
    POST /api/v1/students/{id}/approve/  — approve (admin)
    POST /api/v1/students/{id}/reject/   — reject (admin)
    POST /api/v1/students/{id}/suspend/  — suspend (admin)
    """
    queryset = Student.objects.select_related(
        "user", "department", "semester", "section"
    ).all()
    serializer_class = StudentSerializer
    pagination_class = StandardPagination
    filter_backends = [django_filters.DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = StudentFilter
    search_fields = ["full_name", "student_id", "user__email", "department_name"]
    ordering_fields = ["full_name", "student_id", "created_at", "approval_status"]
    ordering = ["-created_at"]
    permission_classes = [IsAdminUser]

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def me(self, request: Request):
        """GET /api/v1/students/me/ — student sees their own profile."""
        try:
            student = request.user.student_profile
        except Student.DoesNotExist:
            return error_response(
                message="No student profile found for this account.",
                code="STUDENT_PROFILE_NOT_FOUND",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return success_response(data=StudentProfileSerializer(student).data)

    @action(detail=True, methods=["post"], permission_classes=[IsSuperAdminOrDeptAdmin])
    def approve(self, request: Request, pk=None):
        """POST /api/v1/students/{id}/approve/ — link to FK records and approve."""
        student = self.get_object()

        if student.approval_status == ApprovalStatus.APPROVED:
            return error_response(
                message="This student is already approved.",
                code="ALREADY_APPROVED",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ApproveStudentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Update FK links if provided
        if data.get("department"):
            student.department = data["department"]
        if data.get("semester"):
            student.semester = data["semester"]
        if data.get("section"):
            student.section = data["section"]

        student.approval_status = ApprovalStatus.APPROVED
        student.approved_by = request.user
        student.approved_at = timezone.now()
        student.rejection_reason = ""
        student.save()

        # Phase 16 — notify student
        try:
            from apps.notifications.service import NotificationService
            NotificationService.registration_approved(student)
        except Exception:
            pass

        return success_response(
            data=StudentSerializer(student).data,
            message=f"{student.full_name} has been approved.",
        )

    @action(detail=True, methods=["post"], permission_classes=[IsSuperAdminOrDeptAdmin])
    def reject(self, request: Request, pk=None):
        """POST /api/v1/students/{id}/reject/"""
        student = self.get_object()

        if student.approval_status == ApprovalStatus.REJECTED:
            return error_response(
                message="This student is already rejected.",
                code="ALREADY_REJECTED",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        serializer = RejectStudentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        student.approval_status = ApprovalStatus.REJECTED
        student.rejection_reason = serializer.validated_data.get("rejection_reason", "")
        student.save(update_fields=["approval_status", "rejection_reason", "updated_at"])

        # Phase 16 — notify student
        try:
            from apps.notifications.service import NotificationService
            NotificationService.registration_rejected(
                student, reason=student.rejection_reason
            )
        except Exception:
            pass

        return success_response(
            data=StudentSerializer(student).data,
            message=f"{student.full_name}'s registration has been rejected.",
        )

    @action(detail=True, methods=["post"], permission_classes=[IsSuperAdminOrDeptAdmin])
    def suspend(self, request: Request, pk=None):
        """POST /api/v1/students/{id}/suspend/"""
        student = self.get_object()
        student.approval_status = ApprovalStatus.SUSPENDED
        student.save(update_fields=["approval_status", "updated_at"])
        # Also suspend the user account
        student.user.status = "SUSPENDED"
        student.user.save(update_fields=["status"])
        return success_response(
            data=StudentSerializer(student).data,
            message=f"{student.full_name}'s account has been suspended.",
        )
