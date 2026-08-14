"""
FaceAttend — Department Views (Phase 3)
Public read + admin write for department management.
"""
from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend

from apps.common.pagination import StandardPagination
from apps.common.permissions import IsSuperAdminOrDeptAdmin, IsAdminUser
from .models import Department
from .serializers import DepartmentSerializer


class DepartmentViewSet(viewsets.ModelViewSet):
    """
    GET    /api/v1/departments/       — list (public — used for registration dropdowns)
    POST   /api/v1/departments/       — create (admin)
    GET    /api/v1/departments/{id}/  — retrieve (public)
    PATCH  /api/v1/departments/{id}/  — update (admin)
    DELETE /api/v1/departments/{id}/  — deactivate (super admin)
    """
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status"]
    search_fields = ["name", "code"]
    ordering_fields = ["name", "code", "created_at"]
    ordering = ["name"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.AllowAny()]
        if self.action == "destroy":
            return [IsSuperAdminOrDeptAdmin()]
        return [IsAdminUser()]

    def perform_destroy(self, instance):
        # Soft-delete by marking inactive
        instance.status = "INACTIVE"
        instance.save(update_fields=["status"])
