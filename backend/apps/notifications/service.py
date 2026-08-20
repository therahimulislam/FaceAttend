"""
FaceAttend — Phase 16: Notification Service

Centralised helper for creating notifications from any part of the codebase.
Keeps notification logic decoupled from business logic — views and signals
call NotificationService.send() without importing the model directly.

Usage:
    from apps.notifications.service import NotificationService
    NotificationService.send(
        recipient=user,
        category="ATTENDANCE_SUCCESS",
        title="Attendance marked",
        body="Your attendance for Data Structures has been recorded.",
        metadata={"subject": "DS", "status": "PRESENT"},
    )
"""
import logging

logger = logging.getLogger(__name__)


class NotificationService:

    @staticmethod
    def send(recipient, category: str, title: str, body: str, metadata: dict | None = None) -> None:
        """
        Create a Notification for the given recipient.
        Errors are caught and logged — notifications must never break core flows.
        """
        try:
            from .models import Notification
            Notification.objects.create(
                recipient=recipient,
                category=category,
                title=title,
                body=body,
                metadata=metadata or {},
            )
        except Exception as exc:
            logger.error(
                "NotificationService.send failed: category=%s recipient=%s error=%s",
                category, getattr(recipient, "id", "?"), exc,
            )

    # ------------------------------------------------------------------
    # Convenience helpers for each category
    # ------------------------------------------------------------------

    @staticmethod
    def registration_approved(student) -> None:
        NotificationService.send(
            recipient=student.user,
            category="REGISTRATION_APPROVED",
            title="Registration approved 🎉",
            body="Your FaceAttend account has been approved. You can now mark attendance.",
            metadata={"student_id": student.student_id},
        )

    @staticmethod
    def registration_rejected(student, reason: str = "") -> None:
        NotificationService.send(
            recipient=student.user,
            category="REGISTRATION_REJECTED",
            title="Registration not approved",
            body=f"Your registration was not approved.{' Reason: ' + reason if reason else ''}",
            metadata={"student_id": student.student_id, "reason": reason},
        )

    @staticmethod
    def attendance_success(student, subject_name: str, subject_code: str,
                           status: str, session_date: str) -> None:
        status_label = "present" if status == "PRESENT" else "late"
        NotificationService.send(
            recipient=student.user,
            category="ATTENDANCE_SUCCESS",
            title=f"Attendance marked — {subject_code}",
            body=f"You've been marked {status_label} for {subject_name} on {session_date}.",
            metadata={"subject_code": subject_code, "subject_name": subject_name,
                      "status": status, "date": session_date},
        )

    @staticmethod
    def attendance_failed(student, subject_name: str, subject_code: str, reason: str) -> None:
        NotificationService.send(
            recipient=student.user,
            category="ATTENDANCE_FAILED",
            title=f"Attendance not recorded — {subject_code}",
            body=f"Could not mark attendance for {subject_name}. Reason: {reason}",
            metadata={"subject_code": subject_code, "subject_name": subject_name, "reason": reason},
        )

    @staticmethod
    def low_attendance(student, subject_name: str, subject_code: str, percentage: float) -> None:
        NotificationService.send(
            recipient=student.user,
            category="LOW_ATTENDANCE",
            title=f"Low attendance alert — {subject_code}",
            body=(
                f"Your attendance in {subject_name} has dropped to {percentage}%, "
                f"which is below the required 75%."
            ),
            metadata={"subject_code": subject_code, "subject_name": subject_name,
                      "percentage": percentage},
        )

    @staticmethod
    def suspicious_attempt(student, subject_name: str, subject_code: str, reason: str) -> None:
        NotificationService.send(
            recipient=student.user,
            category="SUSPICIOUS_ATTEMPT",
            title=f"Suspicious attendance attempt — {subject_code}",
            body=(
                f"An unusual attendance attempt was detected for {subject_name}. "
                f"If this was not you, please contact your administrator."
            ),
            metadata={"subject_code": subject_code, "subject_name": subject_name, "reason": reason},
        )

    @staticmethod
    def upcoming_class(user, subject_name: str, subject_code: str,
                       start_time: str, room_name: str) -> None:
        NotificationService.send(
            recipient=user,
            category="UPCOMING_CLASS",
            title=f"Class starting soon — {subject_code}",
            body=f"{subject_name} starts at {start_time} in {room_name or 'your scheduled room'}.",
            metadata={"subject_code": subject_code, "subject_name": subject_name,
                      "start_time": start_time, "room": room_name},
        )
