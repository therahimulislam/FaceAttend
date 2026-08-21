"""
FaceAttend — Phase 17: Audit Service

Centralised helper for creating audit log entries from any part of the codebase.
Extracts ip_address and user_agent from the request automatically.

Usage:
    from apps.audit.service import AuditService
    AuditService.log(
        request=request,
        event_type="STUDENT_APPROVED",
        description="Admin approved student John Doe",
        target_user=student.user,
        new_value={"student_id": "STU001", "approval_status": "APPROVED"},
        severity="INFO",
    )
"""
import logging

logger = logging.getLogger(__name__)

# Severity mappings by event type (defaults — can be overridden per call)
_DEFAULT_SEVERITY = {
    "STUDENT_APPROVED":      "INFO",
    "STUDENT_REJECTED":      "INFO",
    "ATTENDANCE_CORRECTION": "WARNING",
    "ROLE_CHANGE":           "WARNING",
    "SUBJECT_CHANGE":        "INFO",
    "TIMETABLE_CHANGE":      "INFO",
    "SECURITY_EVENT":        "CRITICAL",
    "SUSPICIOUS_ATTEMPT":    "WARNING",
}


def _get_client_ip(request) -> str | None:
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _get_user_agent(request) -> str:
    if request is None:
        return ""
    return request.META.get("HTTP_USER_AGENT", "")


class AuditService:

    @staticmethod
    def log(
        event_type: str,
        description: str,
        request=None,
        actor=None,
        target_user=None,
        old_value=None,
        new_value=None,
        severity: str | None = None,
        metadata: dict | None = None,
    ) -> None:
        """
        Create an AuditLog entry.
        Errors are caught and logged — audit logging must never break core flows.
        """
        try:
            from .models import AuditLog

            # Resolve actor from request if not explicitly provided
            if actor is None and request is not None:
                user = getattr(request, "user", None)
                if user and getattr(user, "is_authenticated", False):
                    actor = user

            # Default severity from event type
            effective_severity = severity or _DEFAULT_SEVERITY.get(event_type, "INFO")

            AuditLog.objects.create(
                event_type=event_type,
                severity=effective_severity,
                actor=actor,
                target_user=target_user,
                description=description,
                old_value=old_value,
                new_value=new_value,
                ip_address=_get_client_ip(request),
                user_agent=_get_user_agent(request),
                metadata=metadata or {},
            )
        except Exception as exc:
            logger.error(
                "AuditService.log failed: event=%s actor=%s error=%s",
                event_type,
                getattr(actor, "id", getattr(actor, "email", "?")),
                exc,
            )

    # ------------------------------------------------------------------
    # Convenience helpers
    # ------------------------------------------------------------------

    @staticmethod
    def student_approved(request, student) -> None:
        AuditService.log(
            event_type="STUDENT_APPROVED",
            description=f"Student '{student.full_name}' ({student.student_id}) approved.",
            request=request,
            target_user=student.user,
            new_value={"student_id": student.student_id, "approval_status": "APPROVED"},
            metadata={"student_id": student.student_id},
        )

    @staticmethod
    def student_rejected(request, student, reason: str = "") -> None:
        AuditService.log(
            event_type="STUDENT_REJECTED",
            description=f"Student '{student.full_name}' ({student.student_id}) rejected. Reason: {reason}",
            request=request,
            target_user=student.user,
            new_value={"student_id": student.student_id,
                       "approval_status": "REJECTED", "reason": reason},
            metadata={"student_id": student.student_id, "reason": reason},
        )

    @staticmethod
    def attendance_correction(request, record, old_status: str, new_status: str) -> None:
        AuditService.log(
            event_type="ATTENDANCE_CORRECTION",
            description=(
                f"Attendance corrected for student {record.student.student_id} "
                f"in session {record.session_id}: {old_status} → {new_status}"
            ),
            request=request,
            target_user=record.student.user,
            old_value={"status": old_status},
            new_value={"status": new_status, "record_id": str(record.id)},
            severity="WARNING",
            metadata={
                "record_id": str(record.id),
                "session_id": str(record.session_id),
                "student_id": record.student.student_id,
            },
        )

    @staticmethod
    def role_change(request, target_user, old_role: str, new_role: str) -> None:
        AuditService.log(
            event_type="ROLE_CHANGE",
            description=f"Role changed for {target_user.email}: {old_role} → {new_role}",
            request=request,
            target_user=target_user,
            old_value={"role": old_role},
            new_value={"role": new_role},
            severity="WARNING",
            metadata={"user_id": str(target_user.id)},
        )

    @staticmethod
    def subject_change(request, action: str, subject_code: str,
                       old_value=None, new_value=None) -> None:
        AuditService.log(
            event_type="SUBJECT_CHANGE",
            description=f"Subject {subject_code} {action}.",
            request=request,
            old_value=old_value,
            new_value=new_value,
            metadata={"subject_code": subject_code, "action": action},
        )

    @staticmethod
    def timetable_change(request, action: str, entry_id: str,
                         old_value=None, new_value=None) -> None:
        AuditService.log(
            event_type="TIMETABLE_CHANGE",
            description=f"Timetable entry {entry_id} {action}.",
            request=request,
            old_value=old_value,
            new_value=new_value,
            metadata={"entry_id": entry_id, "action": action},
        )

    @staticmethod
    def security_event(request, description: str, metadata: dict | None = None) -> None:
        AuditService.log(
            event_type="SECURITY_EVENT",
            description=description,
            request=request,
            severity="CRITICAL",
            metadata=metadata or {},
        )

    @staticmethod
    def suspicious_attempt(request, student, subject_code: str, reason: str) -> None:
        AuditService.log(
            event_type="SUSPICIOUS_ATTEMPT",
            description=(
                f"Suspicious attendance attempt by {student.student_id} "
                f"for subject {subject_code}: {reason}"
            ),
            request=request,
            target_user=student.user,
            severity="WARNING",
            metadata={
                "student_id": student.student_id,
                "subject_code": subject_code,
                "reason": reason,
            },
        )
