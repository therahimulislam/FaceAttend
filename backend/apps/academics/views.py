"""
FaceAttend — Academic Views: AcademicYear, Semester, Section (Phase 3)
"""
from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend

from apps.common.pagination import StandardPagination
from apps.common.permissions import IsAdminUser
from .models import AcademicYear, Semester, Section
from .serializers import AcademicYearSerializer, SemesterSerializer, SectionSerializer


class AcademicYearViewSet(viewsets.ModelViewSet):
    queryset = AcademicYear.objects.all()
    serializer_class = AcademicYearSerializer
    pagination_class = StandardPagination
    ordering = ["-start_date"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.AllowAny()]
        return [IsAdminUser()]


class SemesterViewSet(viewsets.ModelViewSet):
    """
    GET /api/v1/academics/semesters/?department=<id>&status=ACTIVE
    """
    queryset = Semester.objects.select_related("department", "academic_year").all()
    serializer_class = SemesterSerializer
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["department", "status", "is_current", "academic_year"]
    search_fields = ["name"]
    ordering_fields = ["name", "number", "start_date"]
    ordering = ["department", "number"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.AllowAny()]
        return [IsAdminUser()]


class SectionViewSet(viewsets.ModelViewSet):
    """
    GET /api/v1/academics/sections/?semester=<id>
    """
    queryset = Section.objects.select_related("semester__department").all()
    serializer_class = SectionSerializer
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["semester", "status"]
    search_fields = ["name"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.AllowAny()]
        return [IsAdminUser()]
