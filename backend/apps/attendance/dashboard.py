"""
FaceAttend — Phase 14: Dashboard API Views

Three aggregated endpoints — one per role — that return all the data
a dashboard needs in a single request (no client-side waterfalls).

  GET /api/v1/attendance/dashboard/student/  → StudentDashboardView
  GET /api/v1/attendance/dashboard/faculty/  → FacultyDashboardView
  GET /api/v1/attendance/dashboard/admin/    → AdminDashboardView
"""
from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import permissions
from rest_framework.views import APIView

from apps.common.permissions import IsAdminUser, IsStudent, IsFaculty
from apps.common.responses import success_response, error_response
from apps.timetable.models import TimetableEntry, DayOfWeek
from .models import AttendanceSession, AttendanceRecord, SessionStatus, AttendanceStatus


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _today_day_abbr() -> str:
    """Return the 3-letter DayOfWeek abbreviation matching today's weekday."""
    weekday = timezone.localtime().weekday()  # Mon=0 … Sat=5
    day_map = {0: "MON", 1: "TUE", 2: "WED", 3: "THU", 4: "FRI", 5: "SAT"}
    return day_map.get(weekday, "MON")


def _time_str(t) -> str:
    """Format a time object as HH:MM."""
    if t is None:
        return None
    return t.strftime("%H:%M")


def _greeting() -> str:
    hour = timezone.localtime().hour
    if hour < 12:
        return "Good morning"
    elif hour < 17:
        return "Good afternoon"
    return "Good evening"


# ---------------------------------------------------------------------------
# Student Dashboard
# ---------------------------------------------------------------------------

class StudentDashboardView(APIView):
    """
    GET /api/v1/attendance/dashboard/student/

    Returns everything the student dashboard needs in one call:
    - overall attendance percentage
    - current class (if any, with live session_id if active)
    - upcoming classes today
    - last 5 attendance records
    """
    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def get(self, request):
        user = request.user
        try:
            student = user.student_profile
        except Exception:
            return error_response(message="Student profile not found.", code="NO_PROFILE", status_code=403)

        today = timezone.localdate()
        now = timezone.localtime()
        today_abbr = _today_day_abbr()

        # ---- Overall attendance percentage ----
        my_records = AttendanceRecord.objects.filter(student=student)
        total_classes = my_records.count()
        attended = my_records.filter(
            status__in=[AttendanceStatus.PRESENT, AttendanceStatus.LATE]
        ).count()
        overall_pct = round(attended / total_classes * 100, 1) if total_classes else 0.0

        # ---- Today's timetable entries for the student's section ----
        if student.section_id:
            today_entries = (
                TimetableEntry.objects
                .filter(section=student.section, day=today_abbr, is_active=True)
                .select_related("subject", "faculty", "room")
                .order_by("start_time")
            )
        else:
            today_entries = TimetableEntry.objects.none()

        # ---- Find the current class (slot covering 'now') ----
        current_class = None
        upcoming = []
        now_time = now.time()

        for entry in today_entries:
            if entry.start_time <= now_time <= entry.end_time:
                # Check for an active session for this slot
                session = (
                    AttendanceSession.objects
                    .filter(
                        section=student.section,
                        subject=entry.subject,
                        date=today,
                        status=SessionStatus.ACTIVE,
                    )
                    .first()
                )
                already_marked = False
                if session:
                    already_marked = AttendanceRecord.objects.filter(
                        session=session,
                        student=student,
                        status__in=[AttendanceStatus.PRESENT, AttendanceStatus.LATE],
                    ).exists()

                current_class = {
                    "timetable_entry_id": str(entry.id),
                    "subject_code": entry.subject.code,
                    "subject_name": entry.subject.name,
                    "start_time": _time_str(entry.start_time),
                    "end_time": _time_str(entry.end_time),
                    "room_name": entry.room.name if entry.room else None,
                    "faculty_name": entry.faculty.full_name,
                    "session_id": str(session.id) if session else None,
                    "session_code": session.session_code if session else None,
                    "already_marked": already_marked,
                }
            elif entry.start_time > now_time:
                upcoming.append({
                    "timetable_entry_id": str(entry.id),
                    "subject_code": entry.subject.code,
                    "subject_name": entry.subject.name,
                    "start_time": _time_str(entry.start_time),
                    "end_time": _time_str(entry.end_time),
                    "room_name": entry.room.name if entry.room else None,
                })

        # ---- Recent records (last 5) ----
        recent_qs = (
            my_records
            .select_related("session__subject")
            .order_by("-session__date", "-marked_at")[:5]
        )
        recent_records = [
            {
                "subject_code": r.session.subject.code,
                "subject_name": r.session.subject.name,
                "status": r.status,
                "session_date": str(r.session.date),
                "face_verified": r.face_verified,
                "liveness_verified": r.liveness_verified,
                "is_fully_verified": r.is_fully_verified,
                "marked_at": r.marked_at.isoformat(),
            }
            for r in recent_qs
        ]

        name = student.full_name.split()[0] if student.full_name else ""
        return success_response(data={
            "greeting": f"{_greeting()}, {name}" if name else _greeting(),
            "overall_percentage": overall_pct,
            "total_classes": total_classes,
            "attended_classes": attended,
            "current_class": current_class,
            "upcoming_classes": upcoming,
            "recent_records": recent_records,
        })


# ---------------------------------------------------------------------------
# Faculty Dashboard
# ---------------------------------------------------------------------------

class FacultyDashboardView(APIView):
    """
    GET /api/v1/attendance/dashboard/faculty/

    Returns:
    - today's schedule with session status and attendance counts
    - active session details (if any)
    - this week's session count and average attendance
    """
    permission_classes = [permissions.IsAuthenticated, IsFaculty]

    def get(self, request):
        user = request.user
        try:
            faculty = user.faculty_profile
        except Exception:
            return error_response(message="Faculty profile not found.", code="NO_PROFILE", status_code=403)

        today = timezone.localdate()
        now = timezone.localtime()
        today_abbr = _today_day_abbr()

        # ---- Today's timetable entries ----
        today_entries = (
            TimetableEntry.objects
            .filter(faculty=faculty, day=today_abbr, is_active=True)
            .select_related("subject", "section__semester__department", "room")
            .order_by("start_time")
        )

        # Get all sessions for today by this faculty
        today_sessions = {
            str(s.subject_id): s
            for s in AttendanceSession.objects.filter(
                faculty=faculty, date=today,
            ).select_related("section")
        }

        schedule = []
        active_session_data = None

        for entry in today_entries:
            session = today_sessions.get(str(entry.subject_id))

            # Count attendance if session exists
            present_count = 0
            total_students = 0
            session_status = None

            if session:
                session_status = session.status
                counts = AttendanceRecord.objects.filter(session=session).values("status").annotate(n=Count("id"))
                count_map = {row["status"]: row["n"] for row in counts}
                present_count = count_map.get(AttendanceStatus.PRESENT, 0) + count_map.get(AttendanceStatus.LATE, 0)

                from apps.students.models import ApprovalStatus
                from apps.students.models import Student
                total_students = Student.objects.filter(
                    section=session.section,
                    approval_status=ApprovalStatus.APPROVED,
                ).count()

            pct = round(present_count / total_students * 100, 1) if total_students else 0.0

            slot = {
                "timetable_entry_id": str(entry.id),
                "subject_code": entry.subject.code,
                "subject_name": entry.subject.name,
                "start_time": _time_str(entry.start_time),
                "end_time": _time_str(entry.end_time),
                "section_name": entry.section.name,
                "department_name": entry.section.semester.department.name,
                "room_name": entry.room.name if entry.room else None,
                "session_id": str(session.id) if session else None,
                "session_status": session_status,
                "present_count": present_count,
                "total_students": total_students,
                "attendance_percentage": pct,
            }
            schedule.append(slot)

            if session and session.status == SessionStatus.ACTIVE and active_session_data is None:
                active_session_data = slot

        # ---- This week summary ----
        week_start = today - timedelta(days=today.weekday())
        week_sessions = AttendanceSession.objects.filter(
            faculty=faculty,
            date__gte=week_start,
            date__lte=today,
            status=SessionStatus.COMPLETED,
        )
        this_week_sessions = week_sessions.count()

        # Average attendance across completed sessions this week
        week_avg = 0.0
        if this_week_sessions:
            total_pct = 0.0
            counted = 0
            for ws in week_sessions.prefetch_related("records", "section"):
                from apps.students.models import Student, ApprovalStatus
                enrolled = Student.objects.filter(
                    section=ws.section, approval_status=ApprovalStatus.APPROVED
                ).count()
                if enrolled:
                    marked = ws.records.filter(
                        status__in=[AttendanceStatus.PRESENT, AttendanceStatus.LATE]
                    ).count()
                    total_pct += marked / enrolled * 100
                    counted += 1
            week_avg = round(total_pct / counted, 1) if counted else 0.0

        name = faculty.full_name.split()[0] if faculty.full_name else ""
        return success_response(data={
            "greeting": f"{_greeting()}, {name}" if name else _greeting(),
            "today_schedule": schedule,
            "active_session": active_session_data,
            "this_week_sessions": this_week_sessions,
            "this_week_avg_attendance": week_avg,
        })


# ---------------------------------------------------------------------------
# Admin Dashboard
# ---------------------------------------------------------------------------

class AdminDashboardView(APIView):
    """
    GET /api/v1/attendance/dashboard/admin/

    Returns system-wide statistics in a single aggregated response.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        from apps.students.models import Student, ApprovalStatus
        from apps.faculty.models import Faculty
        from apps.departments.models import Department
        from apps.face.models import FaceEnrollment, EnrollmentStatus

        today = timezone.localdate()

        total_students = Student.objects.count()
        pending_approvals = Student.objects.filter(approval_status=ApprovalStatus.PENDING).count()
        total_faculty = Faculty.objects.count()
        total_departments = Department.objects.filter(status="ACTIVE").count()

        active_sessions_now = AttendanceSession.objects.filter(status=SessionStatus.ACTIVE).count()

        today_attendance_count = AttendanceRecord.objects.filter(
            session__date=today,
            status__in=[AttendanceStatus.PRESENT, AttendanceStatus.LATE],
        ).count()

        pending_face_enrollments = FaceEnrollment.objects.filter(
            status=EnrollmentStatus.PENDING
        ).count()

        # Last 5 pending students
        recent_pending = (
            Student.objects
            .filter(approval_status=ApprovalStatus.PENDING)
            .select_related("user")
            .order_by("-created_at")[:5]
        )
        pending_list = [
            {
                "id": str(s.id),
                "full_name": s.full_name,
                "student_id": s.student_id,
                "department_name": s.department_name,
                "created_at": s.created_at.isoformat(),
            }
            for s in recent_pending
        ]

        return success_response(data={
            "total_students": total_students,
            "pending_approvals": pending_approvals,
            "total_faculty": total_faculty,
            "total_departments": total_departments,
            "active_sessions_now": active_sessions_now,
            "today_attendance_count": today_attendance_count,
            "pending_face_enrollments": pending_face_enrollments,
            "recent_pending_students": pending_list,
        })
