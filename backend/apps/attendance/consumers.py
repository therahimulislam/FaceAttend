"""
FaceAttend — Phase 13: WebSocket Consumer for Live Attendance

URL: ws://<host>/ws/sessions/<session_id>/

Connects faculty (or admin) to a live stream of attendance updates for
a specific session. Authentication via JWT access token in query string:
    ws://host/ws/sessions/<id>/?token=<access_token>

On connect:
  - Validates JWT and identifies user
  - Verifies the user is authorized (session faculty or dept admin)
  - Joins the channel group `session_<uuid>`
  - Sends current attendance snapshot immediately

On receive (server push only — clients don't send messages):
  - attendance.update events push live counts to the client

On disconnect:
  - Leaves the channel group

Event schema pushed to client:
{
    "type": "attendance.update",
    "session_id": "uuid",
    "present_count": int,
    "late_count": int,
    "absent_count": int,
    "total_students": int,
    "percentage": float,   # (present+late) / total_students * 100
    "last_student": {
        "name": str,
        "student_id": str,
        "status": str,
        "face_verified": bool,
        "liveness_verified": bool,
        "marked_at": ISO-8601 str
    } | null
}
"""
import logging
from urllib.parse import parse_qs

from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers (sync → async wrappers)
# ---------------------------------------------------------------------------


def _group_name(session_id: str) -> str:
    """Stable channel group name for a session."""
    return f"session_{session_id}"


@database_sync_to_async
def _authenticate_token(token: str):
    """
    Validate a SimpleJWT access token and return the User, or None.
    """
    try:
        from rest_framework_simplejwt.tokens import UntypedToken
        from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
        from django.contrib.auth import get_user_model

        UntypedToken(token)  # raises on invalid/expired

        from rest_framework_simplejwt.backends import TokenBackend
        from django.conf import settings

        validated = TokenBackend(
            algorithm=settings.SIMPLE_JWT.get("ALGORITHM", "HS256"),
            signing_key=settings.SECRET_KEY,
        ).decode(token, verify=True)

        User = get_user_model()
        return User.objects.select_related().get(id=validated["user_id"])
    except Exception:
        return None


@database_sync_to_async
def _get_session_and_check_access(session_id: str, user):
    """
    Returns the AttendanceSession if user is authorized, else None.
    Authorized: session's faculty OR department admin.
    """
    from apps.attendance.models import AttendanceSession
    from apps.accounts.models import UserRole

    try:
        session = AttendanceSession.objects.select_related(
            "faculty__user", "section__semester__department",
        ).get(id=session_id)
    except (AttendanceSession.DoesNotExist, Exception):
        return None

    if user.role == UserRole.SUPER_ADMIN:
        return session
    if user.role == UserRole.DEPARTMENT_ADMIN:
        return session
    if user.role == UserRole.FACULTY:
        try:
            if session.faculty.user_id == user.id:
                return session
        except Exception:
            pass
    return None


@database_sync_to_async
def _get_session_snapshot(session_id: str):
    """
    Return the current attendance counts for the session.
    """
    from apps.attendance.models import AttendanceRecord, AttendanceStatus
    from django.db.models import Count

    records = AttendanceRecord.objects.filter(session_id=session_id)
    counts = records.values("status").annotate(n=Count("id"))
    count_map = {row["status"]: row["n"] for row in counts}

    present = count_map.get(AttendanceStatus.PRESENT, 0)
    late = count_map.get(AttendanceStatus.LATE, 0)
    absent = count_map.get(AttendanceStatus.ABSENT, 0)

    # Total enrolled in the section
    from apps.attendance.models import AttendanceSession
    try:
        session = AttendanceSession.objects.select_related("section").get(id=session_id)
        from apps.students.models import Student, ApprovalStatus
        total = Student.objects.filter(
            section=session.section,
            approval_status=ApprovalStatus.APPROVED,
        ).count()
    except Exception:
        total = present + late + absent

    pct = round((present + late) / total * 100, 1) if total else 0.0

    # Most recent student who marked
    last_record = (
        records.select_related("student")
        .order_by("-marked_at")
        .first()
    )
    last_student = None
    if last_record:
        last_student = {
            "name": last_record.student.full_name,
            "student_id": last_record.student.student_id,
            "status": last_record.status,
            "face_verified": last_record.face_verified,
            "liveness_verified": last_record.liveness_verified,
            "marked_at": last_record.marked_at.isoformat(),
        }

    return {
        "present_count": present,
        "late_count": late,
        "absent_count": absent,
        "total_students": total,
        "percentage": pct,
        "last_student": last_student,
    }


# ---------------------------------------------------------------------------
# Consumer
# ---------------------------------------------------------------------------


class SessionConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket consumer for real-time attendance updates on a session.
    """

    async def connect(self):
        session_id = self.scope["url_route"]["kwargs"]["session_id"]
        self.session_id = session_id
        self.group_name = _group_name(session_id)

        # ---- Authentication ----
        query_string = self.scope.get("query_string", b"").decode()
        params = parse_qs(query_string)
        token_list = params.get("token", [])
        token = token_list[0] if token_list else None

        if not token:
            logger.warning("WS connect rejected: no token, session=%s", session_id)
            await self.close(code=4001)
            return

        user = await _authenticate_token(token)
        if not user or not user.is_active:
            logger.warning("WS connect rejected: invalid token, session=%s", session_id)
            await self.close(code=4001)
            return

        # ---- Authorization ----
        session = await _get_session_and_check_access(session_id, user)
        if not session:
            logger.warning(
                "WS connect rejected: access denied user=%s session=%s",
                user.email, session_id
            )
            await self.close(code=4003)
            return

        self.user = user

        # ---- Join group ----
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        logger.info(
            "WS connected: user=%s session=%s channel=%s",
            user.email, session_id, self.channel_name
        )

        # ---- Send initial snapshot ----
        snapshot = await _get_session_snapshot(session_id)
        await self.send_json({
            "type": "attendance.update",
            "session_id": session_id,
            **snapshot,
        })

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
            logger.info(
                "WS disconnected: session=%s code=%s", self.session_id, close_code
            )

    async def receive_json(self, content, **kwargs):
        # This is a read-only push channel — ignore client messages
        pass

    # ---- Channel layer event handlers ----

    async def attendance_update(self, event):
        """Relay a pushed attendance.update event to the WebSocket client."""
        await self.send_json(event)
