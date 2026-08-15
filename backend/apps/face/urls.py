from django.urls import path
from .views import (
    EnrollView, MyEnrollmentView,
    EnrollmentListView, RevokeEnrollmentView,
)

urlpatterns = [
    # Student endpoints
    path("enroll/",         EnrollView.as_view(),        name="face-enroll"),
    path("my-enrollment/",  MyEnrollmentView.as_view(),  name="face-my-enrollment"),

    # Admin/faculty endpoints
    path("enrollments/",                      EnrollmentListView.as_view(),   name="face-enrollment-list"),
    path("enrollments/<uuid:pk>/revoke/",     RevokeEnrollmentView.as_view(), name="face-enrollment-revoke"),
]
