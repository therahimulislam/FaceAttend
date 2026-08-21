"""
FaceAttend — Phase 18: AI Insights Views

  GET /api/v1/ai/risk/          → own risk (student) or ?student_id= (admin/faculty)
  GET /api/v1/ai/anomalies/     → anomaly detection
  GET /api/v1/ai/insights/      → per-subject insights
  GET /api/v1/ai/overview/      → admin: section-level risk summary
"""
from rest_framework.views import APIView
from rest_framework import permissions, status

from apps.common.responses import success_response, error_response
from apps.students.models import Student

from .engine import AttendanceRiskEngine, AnomalyDetector, InsightsEngine


# ---------------------------------------------------------------------------
# Shared helper: resolve student from request
# ---------------------------------------------------------------------------

def _resolve_student(request):
    """
    Returns (student, error_response_or_None).
    - Students see their own data only.
    - Faculty/Admin can pass ?student_id= to view any student.
    """
    user = request.user
    role = user.role

    if role == "STUDENT":
        try:
            return user.student_profile, None
        except Exception:
            return None, error_response(
                message="Student profile not found.",
                code="PROFILE_NOT_FOUND",
                status_code=status.HTTP_404_NOT_FOUND,
            )

    # Admin / Faculty — optional ?student_id=
    student_id = request.query_params.get("student_id")
    if student_id:
        try:
            return Student.objects.get(id=student_id), None
        except Student.DoesNotExist:
            return None, error_response(
                message="Student not found.",
                code="NOT_FOUND",
                status_code=status.HTTP_404_NOT_FOUND,
            )

    return None, error_response(
        message="Provide ?student_id= to query a specific student.",
        code="MISSING_PARAM",
        status_code=status.HTTP_400_BAD_REQUEST,
    )


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------

class AttendanceRiskView(APIView):
    """
    GET /api/v1/ai/risk/

    Returns attendance risk (LOW/MEDIUM/HIGH) and per-subject breakdown.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        student, err = _resolve_student(request)
        if err:
            return err
        data = AttendanceRiskEngine.assess(student)
        return success_response(data=data)


class AnomalyDetectionView(APIView):
    """
    GET /api/v1/ai/anomalies/

    Returns detected anomaly patterns for a student.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        student, err = _resolve_student(request)
        if err:
            return err
        data = AnomalyDetector.detect(student)
        return success_response(data=data)


class AttendanceInsightsView(APIView):
    """
    GET /api/v1/ai/insights/

    Returns per-subject trend analysis and actionable suggestions.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        student, err = _resolve_student(request)
        if err:
            return err
        data = InsightsEngine.insights(student)
        return success_response(data=data)


class AIOverviewView(APIView):
    """
    GET /api/v1/ai/overview/

    Admin/Faculty only.
    Returns a risk summary grouped by section.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role not in ("SUPER_ADMIN", "DEPARTMENT_ADMIN", "FACULTY"):
            return error_response(
                message="Admin or faculty access required.",
                code="FORBIDDEN",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        students = Student.objects.filter(
            approval_status="APPROVED"
        ).select_related("user", "section")

        # Optional section filter
        section_id = request.query_params.get("section_id")
        if section_id:
            students = students.filter(section_id=section_id)

        overview = []
        risk_counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0}

        for student in students[:100]:  # cap at 100 for performance
            risk_data = AttendanceRiskEngine.assess(student)
            risk      = risk_data["overall_risk"]
            risk_counts[risk] += 1
            overview.append({
                "student_id": student.student_id,
                "full_name": student.full_name,
                "section": student.section.name if student.section_id else student.section_name,
                "overall_risk": risk,
                "reason": risk_data["reason"],
            })

        # Sort by risk severity (HIGH first)
        order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
        overview.sort(key=lambda s: order[s["overall_risk"]])

        return success_response(data={
            "summary": risk_counts,
            "students": overview,
            "total": len(overview),
        })
