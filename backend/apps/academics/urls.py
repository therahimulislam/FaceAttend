from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AcademicYearViewSet, SemesterViewSet, SectionViewSet, SubjectViewSet, RoomViewSet

router = DefaultRouter()
router.register("years", AcademicYearViewSet, basename="academic-year")
router.register("semesters", SemesterViewSet, basename="semester")
router.register("sections", SectionViewSet, basename="section")
router.register("subjects", SubjectViewSet, basename="subject")
router.register("rooms", RoomViewSet, basename="room")
urlpatterns = [path("", include(router.urls))]
