"""
FaceAttend — Attendance Session Views (Phase 6 + 7)

Access matrix:
  GET   list/retrieve      : authenticated (admin, faculty, student)
  POST  create             : faculty or admin
  PATCH update             : faculty (own sessions) or admin
  POST  start/end/cancel   : faculty (own sessions) or admin
  POST  mark               : faculty (manual override) or admin
  POST  submit             : student — self-marks attendance
  GET   today              : faculty — today's sessions
  GET   records            : session records (faculty/admin)
  GET   my                 : student — personal attendance history
"""

from datetime import date
from django.db.models import Q, Count
from django.utils import timezone
from django_filters import rest_framework as django_filters
from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.gps import check_geofence
from apps.face.engine import face_engine, FaceEngineError
from apps.face.models import FaceEnrollment, EnrollmentStatus as FaceEnrollmentStatus
from apps.common.pagination import StandardPagination
from apps.common.permissions import IsAdminUser, IsFacultyOrAdmin, IsStudent
from apps.common.responses import success_response, error_response
from apps.students.models import Student
from .models import AttendanceSession, AttendanceRecord, SessionStatus, AttendanceStatus
from .serializers import (
    SessionSummarySerializer, SessionDetailSerializer,
    CreateSessionSerializer, StartSessionSerializer,
    AttendanceRecordSerializer, ManualMarkSerializer,
    StudentSubmitSerializer, MyAttendanceRecordSerializer,
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
        # submit + records: any authenticated user (student, faculty, admin)
        # by_code: any authenticated user (student looks up session by code)
        if self.action in ("list", "retrieve", "today", "by_code", "submit", "records"):
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

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def submit(self, request, pk=None):
        """
        POST /api/v1/attendance/sessions/{id}/submit/
        Student self-marks attendance for an active session.

        Body (multipart or JSON):
          latitude, longitude  — optional GPS
          face_image           — optional live face photo (Phase 10)
          liveness_challenge_id — optional verified liveness challenge UUID (Phase 11)

        Validations (Phase 12):
          1. Session must be ACTIVE and within valid_from..valid_until
          2. Student must belong to the session's section
          3. If student already marked PRESENT/LATE → 409 ALREADY_MARKED
          4. Timetable day/time mismatch → non-blocking _timetable_warning in response
          5. GPS/Geofence enforced if room has GPS
          6. Face recognition if enrolled
          7. Liveness if challenge provided
          8. _verification_summary always included in response
        """
        session = self.get_object()
        user = request.user

        # Determine student from user
        try:
            student = user.student_profile
        except Exception:
            return error_response(
                message="Only students can submit attendance.",
                code="NOT_STUDENT",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        # Session must be open
        if not session.is_open:
            return error_response(
                message="This session is not currently accepting attendance.",
                code="SESSION_CLOSED",
                status_code=status.HTTP_409_CONFLICT,
            )

        # Section check
        if student.section_id != session.section_id:
            return error_response(
                message="You are not enrolled in the section for this session.",
                code="WRONG_SECTION",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        # ---- Phase 12: Duplicate prevention ----
        # Block re-submission if already PRESENT or LATE
        existing = AttendanceRecord.objects.filter(
            session=session,
            student=student,
            status__in=[AttendanceStatus.PRESENT, AttendanceStatus.LATE],
        ).first()
        if existing:
            return error_response(
                message="Attendance has already been marked for this session.",
                code="ALREADY_MARKED",
                status_code=status.HTTP_409_CONFLICT,
            )

        # Parse multipart payload (GPS + optional face image + optional liveness challenge)
        ser = StudentSubmitSerializer(data=request.data)
        if not ser.is_valid():
            return error_response(errors=ser.errors)

        # ---- Phase 12: Timetable day/time validation (non-blocking) ----
        timetable_warning = None
        if session.timetable_entry_id:
            entry = session.timetable_entry
            today_abbr = timezone.localtime().strftime("%A")[:3].upper()
            if entry.day.upper() != today_abbr:
                timetable_warning = (
                    f"Session is scheduled for {entry.get_day_display()}, "
                    f"but today is {timezone.localtime().strftime('%A')}."
                )

        lat = ser.validated_data.get("latitude")
        lon = ser.validated_data.get("longitude")
        face_image_file = ser.validated_data.get("face_image")
        liveness_challenge_id = ser.validated_data.get("liveness_challenge_id")
        has_gps = lat is not None and lon is not None
        has_face = face_image_file is not None
        has_liveness = liveness_challenge_id is not None

        # ---- Phase 8: Geofence Validation ----
        gps_verified = False
        geofence_skipped = False
        verification_method = "MANUAL"

        if has_gps:
            room = session.room
            if room and room.has_gps:
                # Room has GPS — enforce geofence
                result = check_geofence(
                    student_lat=float(lat),
                    student_lon=float(lon),
                    room_lat=float(room.latitude),
                    room_lon=float(room.longitude),
                    radius_meters=room.geofence_radius,
                )
                if not result.within:
                    try:
                        from apps.notifications.service import NotificationService
                        NotificationService.attendance_failed(
                            student=student,
                            subject_name=session.subject.name,
                            subject_code=session.subject.code,
                            reason="Outside classroom geofence.",
                        )
                    except Exception:
                        pass
                    return error_response(
                        message=(
                            f"You appear to be outside the classroom. "
                            f"You are {result.distance_meters:.0f}m away from "
                            f"{room.name} (allowed radius: {result.allowed_radius}m)."
                        ),
                        code="GEOFENCE_VIOLATION",
                        errors={
                            "distance_meters": result.distance_meters,
                            "allowed_radius": result.allowed_radius,
                            "exceeded_by": result.exceeded_by_meters,
                        },
                        status_code=status.HTTP_409_CONFLICT,
                    )
                gps_verified = True
                verification_method = "GPS"
            else:
                # Room has no GPS coordinates — accept with GPS captured but not enforced
                gps_verified = False
                geofence_skipped = True
                verification_method = "GPS"
        else:
            # No GPS supplied
            verification_method = "MANUAL"

        # ---- Phase 10: Face Recognition ----
        face_verified = False
        face_distance = None   # cosine distance returned to client for transparency
        face_error = None

        if has_face:
            try:
                enrollment = getattr(student, "face_enrollment", None)
                if enrollment and enrollment.status == FaceEnrollmentStatus.ACTIVE and enrollment.embedding:
                    # Extract embedding from live photo
                    image_bytes = face_image_file.read()
                    live_embedding = face_engine.embed(image_bytes)
                    face_distance = round(face_engine.distance(live_embedding, enrollment.embedding), 4)
                    face_verified = face_engine.matches(live_embedding, enrollment.embedding)
                    if not face_verified:
                        try:
                            from apps.notifications.service import NotificationService
                            NotificationService.suspicious_attempt(
                                student=student,
                                subject_name=session.subject.name,
                                subject_code=session.subject.code,
                                reason="Face mismatch detected.",
                            )
                        except Exception:
                            pass
                        try:
                            from apps.audit.service import AuditService
                            AuditService.suspicious_attempt(
                                request=request,
                                student=student,
                                subject_code=session.subject.code,
                                reason="Face mismatch detected.",
                            )
                        except Exception:
                            pass
                        return error_response(
                            message=(
                                "Face verification failed. The face in the photo does not match "
                                "your enrolled face. Please try again with better lighting."
                            ),
                            code="FACE_MISMATCH",
                            errors={
                                "distance": face_distance,
                                "threshold": face_engine.THRESHOLD,
                            },
                            status_code=status.HTTP_409_CONFLICT,
                        )
                else:
                    # Student has no active enrollment — treat face as not provided
                    face_error = "No active face enrollment found. Submitting without face verification."
                    has_face = False
            except Exception as exc:
                if isinstance(exc, FaceEngineError):
                    return error_response(
                        message=str(exc),
                        code="FACE_DETECTION_FAILED",
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    )
                # Non-face error: log and continue without face verification
                import logging
                logging.getLogger(__name__).exception("Face recognition error (non-fatal): %s", exc)
                face_error = "Face recognition temporarily unavailable."

        # ---- Phase 11: Liveness Challenge Validation ----
        liveness_verified = False
        liveness_warning = None

        if has_liveness:
            try:
                from apps.face.models import LivenessChallenge
                from django.utils import timezone as tz

                challenge = LivenessChallenge.objects.get(
                    id=liveness_challenge_id,
                    student=student,
                    liveness_verified=True,
                    is_used=True,
                )
                # Challenge must have been verified within the last 5 minutes
                age_seconds = (tz.now() - challenge.created_at).total_seconds()
                if age_seconds > 300:
                    liveness_warning = "Liveness challenge has expired (>5 min). Please re-verify."
                else:
                    liveness_verified = True
            except LivenessChallenge.DoesNotExist:
                liveness_warning = "Liveness challenge not found or not yet verified."
            except Exception as exc:
                import logging as _log
                _log.getLogger(__name__).exception("Liveness validation error: %s", exc)
                liveness_warning = "Liveness validation temporarily unavailable."

        # ---- Determine combined verification method ----
        if face_verified and gps_verified:
            final_method = "FACE_GPS"
        elif face_verified:
            final_method = "FACE"
        elif gps_verified:
            final_method = "GPS"
        else:
            final_method = verification_method  # GPS (no room coords) or MANUAL

        # ---- Determine LATE status ----
        now = timezone.now()
        grace_minutes = 15
        is_late = (
            session.valid_from is not None
            and (now - session.valid_from).total_seconds() > grace_minutes * 60
        )
        mark_status = AttendanceStatus.LATE if is_late else AttendanceStatus.PRESENT

        record, created = AttendanceRecord.objects.update_or_create(
            session=session,
            student=student,
            defaults={
                "status": mark_status,
                "verification_method": final_method,
                "gps_verified": gps_verified,
                "face_verified": face_verified,
                "liveness_verified": liveness_verified,
                "marked_by": None,  # self-marked
                "latitude": lat,
                "longitude": lon,
            },
        )

        response_data = AttendanceRecordSerializer(record).data
        # Append transparency fields
        if face_distance is not None:
            response_data["_face_score"] = {
                "distance": face_distance,
                "threshold": face_engine.THRESHOLD,
                "verified": face_verified,
            }
        if geofence_skipped:
            response_data["_geofence_warning"] = "Room has no GPS coordinates. Location not verified."
        if face_error:
            response_data["_face_warning"] = face_error
        if liveness_warning:
            response_data["_liveness_warning"] = liveness_warning
        if timetable_warning:
            response_data["_timetable_warning"] = timetable_warning

        # ---- Phase 12: Structured verification summary ----
        response_data["_verification_summary"] = {
            "section_match": True,
            "gps_verified": gps_verified,
            "face_verified": face_verified,
            "liveness_verified": liveness_verified,
            "is_fully_verified": record.is_fully_verified,
            "timetable_warning": timetable_warning,
        }

        # ---- Phase 16: Notifications ----
        try:
            from apps.notifications.service import NotificationService
            subj = session.subject
            session_date_str = str(session.date)

            NotificationService.attendance_success(
                student=student,
                subject_name=subj.name,
                subject_code=subj.code,
                status=record.status,
                session_date=session_date_str,
            )

            # Low attendance check — compute current % for this subject
            from apps.attendance.models import AttendanceRecord as AR
            subject_records = AR.objects.filter(student=student, session__subject=subj)
            total = subject_records.count()
            attended = subject_records.filter(
                status__in=["PRESENT", "LATE"]
            ).count()
            if total >= 3:  # only warn after 3+ sessions to avoid noise
                pct = round(attended / total * 100, 1)
                if pct < 75:
                    NotificationService.low_attendance(
                        student=student,
                        subject_name=subj.name,
                        subject_code=subj.code,
                        percentage=pct,
                    )
        except Exception as _notif_err:
            import logging
            logging.getLogger(__name__).warning("Notification failed: %s", _notif_err)

        return success_response(
            data=response_data,
            message="Attendance marked successfully.",
            status_code=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# Student personal attendance history
# ---------------------------------------------------------------------------

class MyAttendanceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset for the logged-in student's own attendance history.

    GET /api/v1/attendance/my/          — paginated attendance records
    GET /api/v1/attendance/my/summary/  — per-subject attendance summary
    """
    serializer_class = MyAttendanceRecordSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardPagination
    filter_backends = [django_filters.DjangoFilterBackend, filters.OrderingFilter]
    ordering_fields = ["marked_at", "session__date"]
    ordering = ["-session__date"]

    def get_queryset(self):
        user = self.request.user
        try:
            student = user.student_profile
        except Exception:
            return AttendanceRecord.objects.none()
        return (
            AttendanceRecord.objects
            .filter(student=student)
            .select_related("session__subject", "session__section", "session__faculty")
            .order_by("-session__date")
        )

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(MyAttendanceRecordSerializer(page, many=True).data)
        return success_response(data=MyAttendanceRecordSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """
        GET /api/v1/attendance/my/summary/
        Returns per-subject attendance statistics.
        [
          { subject_code, subject_name, total, present, absent, late, excused, percentage }
        ]
        """
        qs = self.get_queryset()
        subject_map: dict = {}
        for record in qs:
            subj = record.session.subject
            key = str(subj.id)
            if key not in subject_map:
                subject_map[key] = {
                    "subject_id": key,
                    "subject_code": subj.code,
                    "subject_name": subj.name,
                    "total": 0,
                    "present": 0,
                    "absent": 0,
                    "late": 0,
                    "excused": 0,
                }
            subject_map[key]["total"] += 1
            subject_map[key][record.status.lower()] += 1

        results = []
        for entry in subject_map.values():
            attended = entry["present"] + entry["late"]
            entry["percentage"] = round(attended / entry["total"] * 100, 1) if entry["total"] else 0
            results.append(entry)

        results.sort(key=lambda x: x["percentage"])
        return success_response(data=results)
