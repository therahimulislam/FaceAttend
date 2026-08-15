"""
FaceAttend — Attendance Session Views (Phase 6)

Access matrix:
  GET   list/retrieve      : authenticated (admin, faculty, student)
  POST  create             : faculty or admin
  PATCH update             : faculty (own sessions) or admin
  POST  start/end/cancel   : faculty (own sessions) or admin
  POST  mark               : faculty (manual override) or admin
  GET   today              : faculty only — today's sessions for this faculty
  GET   records            : session records list (faculty/admin)
"""
from datetime import date
from django.db.models import Q
from django_filters import rest_framework as django_filters
from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.pagination import StandardPagination
from apps.common.permissions import IsAdminUser, IsFacultyOrAdmin
from apps.common.responses import success_response, error_response
from apps.students.models import Student
from .models import AttendanceSession, AttendanceRecord, SessionStatus
from .serializers import (
    SessionSummarySerializer, SessionDetailSerializer,
    CreateSessionSerializer, StartSessionSerializer,
    AttendanceRecordSerializer, ManualMarkSerializer,
)


class SessionFilter(django_filters.FilterSet):
    date = django_filters.DateFilter(field_name="date")
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    section = django_filters.UUIDFilter(field_name="section__id")
    faculty = django_filters.UUIDFilter(field_name="faculty__id")
    department = django_filters.UUIDFilter(field_name="section__semester__department__id")

    class Meta:
        model = AttendanceSession
        fields = ["status", "date", "section", "faculty", "department"]


class AttendanceSessionViewSet(viewsets.ModelViewSet):
    """
    Full lifecycle management for attendance sessions.

    GET  /api/v1/attendance/sessions/              — list
    POST /api/v1/attendance/sessions/              — create (faculty/admin)
    GET  /api/v1/attendance/sessions/{id}/         — detail with records
    PATCH /api/v1/attendance/sessions/{id}/        — update (faculty/admin)
    POST /api/v1/attendance/sessions/{id}/start/   — start session
    POST /api/v1/attendance/sessions/{id}/end/     — end session
    POST /api/v1/attendance/sessions/{id}/cancel/  — cancel
    POST /api/v1/attendance/sessions/{id}/mark/    — manual attendance mark
    GET  /api/v1/attendance/sessions/today/        — today's faculty sessions
    GET  /api/v1/attendance/sessions/by-code/?code=XXXXXX — lookup by session code
    """
    queryset = (
        AttendanceSession.objects
        .select_related("section__semester__department", "subject", "faculty", "room", "timetable_entry")
        .prefetch_related("records__student")
        .order_by("-date", "-started_at")
    )
    pagination_class = StandardPagination
    filter_backends = [django_filters.DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = SessionFilter
    search_fields = ["subject__name", "subject__code", "section__name", "faculty__full_name"]
    ordering_fields = ["date", "status", "started_at"]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return CreateSessionSerializer
        if self.action == "retrieve":
            return SessionDetailSerializer
        return SessionSummarySerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve", "today", "by_code"):
            return [permissions.IsAuthenticated()]
        return [IsFacultyOrAdmin()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Faculty sees only their own sessions; admin sees all
        if getattr(user, "role", None) == "FACULTY":
            try:
                faculty = user.faculty_profile
                qs = qs.filter(faculty=faculty)
            except Exception:
                return qs.none()
        # Students see sessions for their section
        elif getattr(user, "role", None) == "STUDENT":
            try:
                student = user.student_profile
                qs = qs.filter(section=student.section)
            except Exception:
                return qs.none()
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = CreateSessionSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return error_response(
                message="Session creation failed.",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        session = serializer.save(created_by=request.user)
        return success_response(
            data=SessionSummarySerializer(session).data,
            message="Attendance session created.",
            status_code=status.HTTP_201_CREATED,
        )

    # ---- Session lifecycle actions ----

    @action(detail=True, methods=["post"], permission_classes=[IsFacultyOrAdmin])
    def start(self, request, pk=None):
        """POST /api/v1/attendance/sessions/{id}/start/"""
        session = self.get_object()
        ser = StartSessionSerializer(data=request.data)
        if not ser.is_valid():
            return error_response(errors=ser.errors)
        try:
            session.start(duration_minutes=ser.validated_data.get("duration_minutes"))
        except ValueError as e:
            return error_response(message=str(e), code="INVALID_STATE")
        return success_response(
            data=SessionSummarySerializer(session).data,
            message=f"Session started. Code: {session.session_code}",
        )

    @action(detail=True, methods=["post"], permission_classes=[IsFacultyOrAdmin])
    def end(self, request, pk=None):
        """POST /api/v1/attendance/sessions/{id}/end/"""
        session = self.get_object()
        try:
            session.end()
        except ValueError as e:
            return error_response(message=str(e), code="INVALID_STATE")
        return success_response(
            data=SessionSummarySerializer(session).data,
            message="Session ended.",
        )

    @action(detail=True, methods=["post"], permission_classes=[IsFacultyOrAdmin])
    def cancel(self, request, pk=None):
        """POST /api/v1/attendance/sessions/{id}/cancel/"""
        session = self.get_object()
        try:
            session.cancel()
        except ValueError as e:
            return error_response(message=str(e), code="INVALID_STATE")
        return success_response(
            data=SessionSummarySerializer(session).data,
            message="Session cancelled.",
        )

    @action(detail=True, methods=["post"], permission_classes=[IsFacultyOrAdmin])
    def mark(self, request, pk=None):
        """
        POST /api/v1/attendance/sessions/{id}/mark/
        Manual attendance override by faculty/admin.
        Body: { student: <uuid>, status: PRESENT|ABSENT|LATE|EXCUSED }
        """
        session = self.get_object()
        ser = ManualMarkSerializer(data=request.data)
        if not ser.is_valid():
            return error_response(errors=ser.errors)
        try:
            student = Student.objects.get(id=ser.validated_data["student"])
        except Student.DoesNotExist:
            return error_response(message="Student not found.", code="NOT_FOUND",
                                  status_code=status.HTTP_404_NOT_FOUND)

        record, created = AttendanceRecord.objects.update_or_create(
            session=session,
            student=student,
            defaults={
                "status": ser.validated_data["status"],
                "verification_method": "MANUAL",
                "marked_by": request.user,
                "rejection_reason": ser.validated_data.get("rejection_reason", ""),
            },
        )
        return success_response(
            data=AttendanceRecordSerializer(record).data,
            message="Attendance recorded." if created else "Attendance updated.",
            status_code=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def records(self, request, pk=None):
        """GET /api/v1/attendance/sessions/{id}/records/ — all records for a session."""
        session = self.get_object()
        records = session.records.select_related("student", "marked_by").order_by("student__full_name")
        page = self.paginate_queryset(records)
        if page is not None:
            data = AttendanceRecordSerializer(page, many=True).data
            return self.get_paginated_response(data)
        return success_response(data=AttendanceRecordSerializer(records, many=True).data)

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def today(self, request):
        """GET /api/v1/attendance/sessions/today/ — today's sessions for the logged-in faculty."""
        today = date.today()
        qs = self.get_queryset().filter(date=today)
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(SessionSummarySerializer(page, many=True).data)
        return success_response(data=SessionSummarySerializer(qs, many=True).data)

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated],
            url_path="by-code")
    def by_code(self, request):
        """GET /api/v1/attendance/sessions/by-code/?code=XXXXXX — look up active session by code."""
        code = request.query_params.get("code", "").strip().upper()
        if not code:
            return error_response(message="Session code is required.", code="MISSING_CODE")
        try:
            session = AttendanceSession.objects.get(session_code=code, status=SessionStatus.ACTIVE)
        except AttendanceSession.DoesNotExist:
            return error_response(
                message="Invalid or expired session code.",
                code="INVALID_CODE",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return success_response(data=SessionSummarySerializer(session).data)
