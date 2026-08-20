from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AttendanceSessionViewSet, MyAttendanceViewSet
from .dashboard import StudentDashboardView, FacultyDashboardView, AdminDashboardView  # Phase 14

router = DefaultRouter()
router.register("sessions", AttendanceSessionViewSet, basename="attendance-session")
router.register("my", MyAttendanceViewSet, basename="my-attendance")

urlpatterns = [
    path("", include(router.urls)),
    # Phase 14 — Dashboard endpoints
    path("dashboard/student/", StudentDashboardView.as_view(), name="dashboard-student"),
    path("dashboard/faculty/", FacultyDashboardView.as_view(), name="dashboard-faculty"),
    path("dashboard/admin/",   AdminDashboardView.as_view(),   name="dashboard-admin"),
]
