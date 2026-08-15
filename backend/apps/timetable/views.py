"""
FaceAttend — Timetable Views (Phase 5)

Access matrix:
  - GET  list/retrieve : authenticated (admin, faculty, student)
  - POST create        : admin only
  - PATCH update       : admin only
  - DELETE destroy     : admin only (soft-delete: sets is_active=False)

Filters:
  - ?section=<uuid>    — a student's or admin's section schedule
  - ?faculty=<uuid>    — a faculty member's weekly schedule
  - ?room=<uuid>       — room occupancy
  - ?day=MON|TUE|...   — single day view
  - ?is_active=true    — active entries only (default)
  - ?academic_year=<uuid>
"""
from django_filters import rest_framework as django_filters
from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.pagination import StandardPagination
from apps.common.permissions import IsAdminUser, IsFacultyOrAdmin
from apps.common.responses import success_response, error_response
from .models import TimetableEntry, DayOfWeek, DAY_ORDER
from .serializers import TimetableEntryReadSerializer, TimetableEntryWriteSerializer


class TimetableFilter(django_filters.FilterSet):
    day = django_filters.MultipleChoiceFilter(choices=DayOfWeek.choices)
    section = django_filters.UUIDFilter(field_name="section__id")
    faculty = django_filters.UUIDFilter(field_name="faculty__id")
    room = django_filters.UUIDFilter(field_name="room__id")
    academic_year = django_filters.UUIDFilter(field_name="academic_year__id")
    department = django_filters.UUIDFilter(field_name="section__semester__department__id")
    semester = django_filters.UUIDFilter(field_name="section__semester__id")

    class Meta:
        model = TimetableEntry
        fields = ["day", "section", "faculty", "room", "academic_year",
                  "department", "semester", "is_active"]


class TimetableViewSet(viewsets.ModelViewSet):
    """
    Full CRUD for timetable entries with conflict detection.

    GET  /api/v1/timetable/            — list (auth required)
    POST /api/v1/timetable/            — create (admin)
    GET  /api/v1/timetable/{id}/       — retrieve (auth)
    PATCH /api/v1/timetable/{id}/      — update (admin)
    DELETE /api/v1/timetable/{id}/     — soft-delete (admin)
    GET  /api/v1/timetable/days/       — list of available days with entries
    """
    queryset = (
        TimetableEntry.objects
        .select_related(
            "section__semester__department",
            "subject",
            "faculty",
            "room",
            "academic_year",
        )
        .filter(is_active=True)
        .order_by("day", "start_time")
    )
    pagination_class = StandardPagination
    filter_backends = [django_filters.DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = TimetableFilter
    search_fields = ["subject__name", "subject__code", "faculty__full_name", "room__name"]
    ordering_fields = ["day", "start_time", "section__name"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        is_admin = (
            user.is_authenticated
            and getattr(user, "role", None) in ("DEPARTMENT_ADMIN", "SUPER_ADMIN")
        )
        # Include inactive entries only for admin users
        if not is_admin:
            qs = qs.filter(is_active=True)
        else:
            # Admin can see all (including inactive via ?is_active=false)
            if self.request.query_params.get("is_active") == "false":
                qs = TimetableEntry.objects.select_related(
                    "section__semester__department", "subject", "faculty", "room", "academic_year"
                ).filter(is_active=False).order_by("day", "start_time")
        return qs

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return TimetableEntryWriteSerializer
        return TimetableEntryReadSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve", "days"):
            return [permissions.IsAuthenticated()]
        return [IsAdminUser()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        """Soft-delete: mark inactive instead of removing."""
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])

    def create(self, request, *args, **kwargs):
        serializer = TimetableEntryWriteSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            conflicts = serializer.errors.get("conflicts", [])
            return error_response(
                message="Timetable conflict detected." if conflicts else "Validation failed.",
                code="TIMETABLE_CONFLICT" if conflicts else "VALIDATION_ERROR",
                errors=serializer.errors,
                status_code=status.HTTP_409_CONFLICT if conflicts else status.HTTP_400_BAD_REQUEST,
            )
        entry = serializer.save(created_by=request.user)
        return success_response(
            data=TimetableEntryReadSerializer(entry, context={"request": request}).data,
            message="Timetable entry created.",
            status_code=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = TimetableEntryWriteSerializer(
            instance, data=request.data, partial=partial, context={"request": request}
        )
        if not serializer.is_valid():
            conflicts = serializer.errors.get("conflicts", [])
            return error_response(
                message="Timetable conflict detected." if conflicts else "Validation failed.",
                code="TIMETABLE_CONFLICT" if conflicts else "VALIDATION_ERROR",
                errors=serializer.errors,
                status_code=status.HTTP_409_CONFLICT if conflicts else status.HTTP_400_BAD_REQUEST,
            )
        entry = serializer.save()
        return success_response(
            data=TimetableEntryReadSerializer(entry, context={"request": request}).data,
            message="Timetable entry updated.",
        )

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def days(self, request):
        """GET /api/v1/timetable/days/ — ordered list of days that have at least one active entry."""
        days_with_entries = (
            self.get_queryset()
            .values_list("day", flat=True)
            .distinct()
        )
        ordered = sorted(set(days_with_entries), key=lambda d: DAY_ORDER.get(d, 99))
        return success_response(data=ordered)
