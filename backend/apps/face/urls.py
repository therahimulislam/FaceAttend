from django.urls import path
from .views import (
    EnrollView, MyEnrollmentView,
    EnrollmentListView, RevokeEnrollmentView,
    LivenessChallengeView, LivenessVerifyView,
)

urlpatterns = [
    # ---- Phase 9: Face Enrollment ----
    path("enroll/",         EnrollView.as_view(),        name="face-enroll"),
    path("my-enrollment/",  MyEnrollmentView.as_view(),  name="face-my-enrollment"),

    # Admin/faculty enrollment management
    path("enrollments/",                      EnrollmentListView.as_view(),   name="face-enrollment-list"),
    path("enrollments/<uuid:pk>/revoke/",     RevokeEnrollmentView.as_view(), name="face-enrollment-revoke"),

    # ---- Phase 11: Liveness Detection ----
    path("liveness/challenge/", LivenessChallengeView.as_view(), name="face-liveness-challenge"),
    path("liveness/verify/",    LivenessVerifyView.as_view(),    name="face-liveness-verify"),
]
