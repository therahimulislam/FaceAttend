from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FacultyViewSet

router = DefaultRouter()
router.register("", FacultyViewSet, basename="faculty")
urlpatterns = [path("", include(router.urls))]
