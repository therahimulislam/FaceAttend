"""
FaceAttend — Faculty Views (Phase 3)
"""
from rest_framework import viewsets, status, permissions, filters
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend

from apps.common.responses import success_response, created_response, error_response
from apps.common.pagination import StandardPagination
from apps.common.permissions import IsAdminUser, IsSuperAdminOrDeptAdmin, IsFacultyOrAdmin
from .models import Faculty
from .serializers import FacultySerializer, CreateFacultySerializer


class FacultyViewSet(viewsets.ModelViewSet):
    """
    GET    /api/v1/faculty/        — list (admin/faculty)
    POST   /api/v1/faculty/        — create faculty user (admin)
    GET    /api/v1/faculty/me/     — logged-in faculty profile
    GET    /api/v1/faculty/{id}/   — retrieve (admin/faculty)
    PATCH  /api/v1/faculty/{id}/   — update (admin)
    DELETE /api/v1/faculty/{id}/   — deactivate (super admin)
    """
    queryset = Faculty.objects.select_related("user", "department").all()
    serializer_class = FacultySerializer
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["department", "is_hod"]
    search_fields = ["full_name", "employee_id", "user__email"]
    ordering_fields = ["full_name", "created_at"]
    ordering = ["full_name"]

    def get_permissions(self):
        if self.action in ("create", "destroy", "update", "partial_update"):
            return [IsSuperAdminOrDeptAdmin()]
        if self.action == "me":
            return [permissions.IsAuthenticated()]
        return [IsFacultyOrAdmin()]

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        """GET /api/v1/faculty/me/ — returns logged-in faculty member's profile."""
        try:
            faculty = request.user.faculty_profile
        except Exception:
            return error_response(
                message="No faculty profile found for this account.",
                code="FACULTY_PROFILE_NOT_FOUND",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return success_response(data=FacultySerializer(faculty).data)

    def get_serializer_class(self):
        if self.action == "create":
            return CreateFacultySerializer
        return FacultySerializer

    def create(self, request, *args, **kwargs):
        serializer = CreateFacultySerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                message="Faculty creation failed.",
                code="VALIDATION_ERROR",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        faculty = serializer.save()
        return created_response(
            data=FacultySerializer(faculty).data,
            message=f"Faculty account created for {faculty.full_name}.",
        )

    def perform_destroy(self, instance):
        # Deactivate rather than hard delete
        instance.user.status = "INACTIVE"
        instance.user.save(update_fields=["status"])
