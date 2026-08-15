from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AttendanceSessionViewSet, MyAttendanceViewSet

router = DefaultRouter()
router.register("sessions", AttendanceSessionViewSet, basename="attendance-session")
router.register("my", MyAttendanceViewSet, basename="my-attendance")

urlpatterns = [path("", include(router.urls))]
