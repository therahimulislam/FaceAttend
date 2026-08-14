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


class SubjectViewSet(viewsets.ModelViewSet):
    """
    GET    /api/v1/academics/subjects/                 — list (public)
    POST   /api/v1/academics/subjects/                 — create (admin)
    GET    /api/v1/academics/subjects/{id}/            — retrieve (public)
    PATCH  /api/v1/academics/subjects/{id}/            — update (admin)
    DELETE /api/v1/academics/subjects/{id}/            — soft-delete (admin)

    Filters: ?department=<id>&status=ACTIVE&search=<text>
    """
    from .models import Subject
    from .serializers import SubjectSerializer
    queryset = Subject.objects.select_related("department").all()
    serializer_class = SubjectSerializer
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["department", "status"]
    search_fields = ["code", "name"]
    ordering_fields = ["code", "name", "credits", "created_at"]
    ordering = ["department", "code"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.AllowAny()]
        return [IsAdminUser()]

    def perform_destroy(self, instance):
        instance.status = "INACTIVE"
        instance.save(update_fields=["status", "updated_at"])


class RoomViewSet(viewsets.ModelViewSet):
    """
    GET    /api/v1/academics/rooms/          — list (admin/faculty, filtered)
    POST   /api/v1/academics/rooms/          — create (admin)
    PATCH  /api/v1/academics/rooms/{id}/     — update (admin)
    DELETE /api/v1/academics/rooms/{id}/     — soft-delete (admin)

    Filters: ?status=ACTIVE&building=<name>&search=<text>
    """
    from .models import Room
    from .serializers import RoomSerializer
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "building"]
    search_fields = ["name", "building"]
    ordering_fields = ["name", "building", "floor", "capacity"]
    ordering = ["building", "name"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.IsAuthenticated()]
        return [IsAdminUser()]

    def perform_destroy(self, instance):
        instance.status = "INACTIVE"
        instance.save(update_fields=["status", "updated_at"])
