"""
FaceAttend — Phase 13: Attendance Signals

Listens for AttendanceRecord post_save and pushes a live count update
to the session's WebSocket channel group.
"""
import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


def _group_name(session_id) -> str:
    return f"session_{session_id}"


def _build_snapshot(instance):
    """Build the attendance.update payload from the saved record's session."""
    from apps.attendance.models import AttendanceRecord, AttendanceStatus
    from django.db.models import Count

    session_id = instance.session_id
    records = AttendanceRecord.objects.filter(session_id=session_id)
    counts = records.values("status").annotate(n=Count("id"))
    count_map = {row["status"]: row["n"] for row in counts}

    present = count_map.get(AttendanceStatus.PRESENT, 0)
    late = count_map.get(AttendanceStatus.LATE, 0)
    absent = count_map.get(AttendanceStatus.ABSENT, 0)

    # Total enrolled students in section
    try:
        from apps.attendance.models import AttendanceSession
        from apps.students.models import Student, ApprovalStatus

        session = AttendanceSession.objects.select_related("section").get(id=session_id)
        total = Student.objects.filter(
            section=session.section,
            approval_status=ApprovalStatus.APPROVED,
        ).count()
    except Exception:
        total = present + late + absent

    pct = round((present + late) / total * 100, 1) if total else 0.0

    last_student = {
        "name": instance.student.full_name,
        "student_id": instance.student.student_id,
        "status": instance.status,
        "face_verified": instance.face_verified,
        "liveness_verified": instance.liveness_verified,
        "marked_at": instance.marked_at.isoformat(),
    }

    return {
        "type": "attendance.update",
        "session_id": str(session_id),
        "present_count": present,
        "late_count": late,
        "absent_count": absent,
        "total_students": total,
        "percentage": pct,
        "last_student": last_student,
    }


@receiver(post_save, sender="attendance.AttendanceRecord")
def push_attendance_update(sender, instance, **kwargs):
    """
    Broadcast live attendance counts to faculty watching this session via WebSocket.
    Runs synchronously (called from Django ORM save) but uses async_to_sync to send
    through the channel layer.
    """
    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return

        payload = _build_snapshot(instance)
        group = _group_name(instance.session_id)

        async_to_sync(channel_layer.group_send)(group, payload)
        logger.debug(
            "WS broadcast: session=%s present=%d late=%d",
            instance.session_id,
            payload["present_count"],
            payload["late_count"],
        )
    except Exception as exc:
        # Never let a signal failure break attendance submission
        logger.exception("Failed to push WS update for session %s: %s", instance.session_id, exc)
