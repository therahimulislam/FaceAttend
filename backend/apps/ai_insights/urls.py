"""
FaceAttend — Phase 18: AI Insights URL routing
"""
from django.urls import path
from .views import (
    AttendanceRiskView,
    AnomalyDetectionView,
    AttendanceInsightsView,
    AIOverviewView,
)

urlpatterns = [
    path("risk/",      AttendanceRiskView.as_view(),      name="ai-risk"),
    path("anomalies/", AnomalyDetectionView.as_view(),    name="ai-anomalies"),
    path("insights/",  AttendanceInsightsView.as_view(),  name="ai-insights"),
    path("overview/",  AIOverviewView.as_view(),          name="ai-overview"),
]
