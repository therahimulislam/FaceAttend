"""
FaceAttend — Phase 15: Report URL routing
"""
from django.urls import path
from .views import (
    StudentReportView,
    SubjectReportView,
    SectionReportView,
    DepartmentReportView,
)

urlpatterns = [
    path("student/",    StudentReportView.as_view(),    name="report-student"),
    path("subject/",    SubjectReportView.as_view(),    name="report-subject"),
    path("section/",    SectionReportView.as_view(),    name="report-section"),
    path("department/", DepartmentReportView.as_view(), name="report-department"),
]
