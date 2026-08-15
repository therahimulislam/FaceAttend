"""
FaceAttend — API v1 Root URL Configuration
All feature app URLs are registered here.
"""
from django.urls import path, include

urlpatterns = [
    # Health check (public — used by Render)
    path("health/", include("apps.common.health_urls")),

    # Authentication
    path("auth/", include("apps.accounts.urls")),

    # Students (Phase 3)
    path("students/", include("apps.students.urls")),

    # Faculty (Phase 3)
    path("faculty/", include("apps.faculty.urls")),

    # Departments / Academic (Phase 3)
    path("departments/", include("apps.departments.urls")),
    path("academics/", include("apps.academics.urls")),

    # Timetable (Phase 5)
    path("timetable/", include("apps.timetable.urls")),

    # Attendance (Phase 6+)
    path("attendance/", include("apps.attendance.urls")),

    # Face Enrollment (Phase 9) + Face Recognition (Phase 10)
    path("face/", include("apps.face.urls")),

    # Notifications (Phase 16)
    # path("notifications/", include("apps.notifications.urls")),

    # Reports (Phase 15)
    # path("reports/", include("apps.analytics.urls")),

    # Audit (Phase 17)
    # path("audit-logs/", include("apps.audit.urls")),
]
