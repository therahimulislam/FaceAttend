"""
FaceAttend — Phase 18: AI Attendance Intelligence Engine

Pure Python, deterministic, rule-based engine.
No external ML libraries required — compatible with serverless CPU constraints.

Three engines:
  1. AttendanceRiskEngine   — LOW / MEDIUM / HIGH risk per student
  2. AnomalyDetector        — unusual patterns from attendance + audit data
  3. InsightsEngine         — per-subject trend analysis + predictions
"""
from datetime import date, timedelta
from django.utils import timezone


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _pct(present: int, total: int) -> float:
    return round(present / total * 100, 1) if total else 0.0


def _recent_records(records_qs, n: int):
    """Return last n records ordered newest-first."""
    return list(records_qs.order_by("-session__date")[:n])


# ---------------------------------------------------------------------------
# Engine 1: Attendance Risk Prediction
# ---------------------------------------------------------------------------

class AttendanceRiskEngine:
    """
    Computes an attendance risk level per student.

    Algorithm per subject:
      percentage ≥ 80            → LOW
      65 ≤ percentage < 80       → MEDIUM
      percentage < 65            → HIGH
      recent_absent_streak ≥ 3   → bump one level up
    """

    RISK_LOW    = "LOW"
    RISK_MEDIUM = "MEDIUM"
    RISK_HIGH   = "HIGH"

    SEVERITY_ORDER = [RISK_LOW, RISK_MEDIUM, RISK_HIGH]

    @staticmethod
    def _bump(risk: str) -> str:
        idx = AttendanceRiskEngine.SEVERITY_ORDER.index(risk)
        return AttendanceRiskEngine.SEVERITY_ORDER[min(idx + 1, 2)]

    @staticmethod
    def _subject_risk(records_qs):
        """Compute risk for a set of records belonging to one subject."""
        from apps.attendance.models import AttendanceRecord
        total   = records_qs.count()
        present = records_qs.filter(status__in=["PRESENT", "LATE"]).count()
        absent  = records_qs.filter(status="ABSENT").count()
        pct     = _pct(present, total)

        if pct >= 80:
            risk   = AttendanceRiskEngine.RISK_LOW
            reason = "Attendance is healthy."
        elif pct >= 65:
            risk   = AttendanceRiskEngine.RISK_MEDIUM
            reason = "Attendance is below target. Attend regularly."
        else:
            risk   = AttendanceRiskEngine.RISK_HIGH
            reason = "Critical risk. Shortage likely if sessions are missed."

        # Check recent consecutive absences (last 5 sessions)
        recent = _recent_records(records_qs, 5)
        consecutive_absent = 0
        for r in recent:
            if r.status == "ABSENT":
                consecutive_absent += 1
            else:
                break
        if consecutive_absent >= 3:
            risk   = AttendanceRiskEngine._bump(risk)
            reason += f" (Warning: {consecutive_absent} consecutive absences.)"

        return {
            "total": total,
            "present": present,
            "absent": absent,
            "percentage": pct,
            "risk": risk,
            "reason": reason,
            "consecutive_absent": consecutive_absent,
        }

    @staticmethod
    def assess(student) -> dict:
        """
        Return overall risk + per-subject breakdown for a student.
        """
        from apps.attendance.models import AttendanceRecord

        all_records = AttendanceRecord.objects.filter(student=student)
        subject_ids = set(
            all_records.values_list("session__subject_id", flat=True)
        )

        subjects = []
        overall_risk = AttendanceRiskEngine.RISK_LOW

        for subj_id in subject_ids:
            subj_records = all_records.filter(session__subject_id=subj_id)
            subj = subj_records.first().session.subject
            result = AttendanceRiskEngine._subject_risk(subj_records)
            result["subject_id"] = str(subj_id)
            result["subject_code"] = subj.code
            result["subject_name"] = subj.name
            subjects.append(result)

            # Worst subject drives overall risk
            if AttendanceRiskEngine.SEVERITY_ORDER.index(result["risk"]) > \
               AttendanceRiskEngine.SEVERITY_ORDER.index(overall_risk):
                overall_risk = result["risk"]

        if not subjects:
            return {
                "overall_risk": AttendanceRiskEngine.RISK_LOW,
                "reason": "No attendance data yet.",
                "subjects": [],
            }

        # Overall reason from worst subject
        worst = max(subjects,
                    key=lambda s: AttendanceRiskEngine.SEVERITY_ORDER.index(s["risk"]))
        return {
            "overall_risk": overall_risk,
            "reason": worst["reason"],
            "subjects": subjects,
        }


# ---------------------------------------------------------------------------
# Engine 2: Anomaly Detection
# ---------------------------------------------------------------------------

class AnomalyDetector:
    """
    Detects unusual patterns in a student's attendance.

    Anomaly types:
      REPEATED_FAILURE    — ≥ 3 SUSPICIOUS_ATTEMPT audit events in 7 days
      REPEATED_LATE       — ≥ 3 LATE records in last 5 sessions
      ABSENCE_SPIKE       — ≥ 3 consecutive ABSENT records in any subject
      DECLINING_TREND     — percentage in last 3 sessions worse than previous 3
    """

    @staticmethod
    def detect(student) -> dict:
        from apps.attendance.models import AttendanceRecord
        from apps.audit.models import AuditLog

        anomalies = []
        seven_days_ago = timezone.now() - timedelta(days=7)

        # 1. Repeated verification failures (face mismatch / GPS spoof)
        suspicious_count = AuditLog.objects.filter(
            target_user=student.user,
            event_type="SUSPICIOUS_ATTEMPT",
            created_at__gte=seven_days_ago,
        ).count()
        if suspicious_count >= 3:
            anomalies.append({
                "type": "REPEATED_FAILURE",
                "severity": "HIGH",
                "reason": (
                    f"{suspicious_count} failed verification attempts in the last 7 days. "
                    "Contact your administrator if this was not you."
                ),
            })

        # 2. Repeated late attendance (last 5 sessions overall)
        all_records = AttendanceRecord.objects.filter(student=student)
        recent_five = _recent_records(all_records, 5)
        late_count  = sum(1 for r in recent_five if r.status == "LATE")
        if late_count >= 3:
            anomalies.append({
                "type": "REPEATED_LATE",
                "severity": "MEDIUM",
                "reason": (
                    f"Marked late {late_count} out of the last 5 sessions. "
                    "Try to arrive before the class starts."
                ),
            })

        # 3. Absence spike — per subject
        subject_ids = set(all_records.values_list("session__subject_id", flat=True))
        for subj_id in subject_ids:
            subj_records = all_records.filter(session__subject_id=subj_id)
            recent = _recent_records(subj_records, 5)
            consec_absent = 0
            for r in recent:
                if r.status == "ABSENT":
                    consec_absent += 1
                else:
                    break
            if consec_absent >= 3:
                subj = recent[0].session.subject
                anomalies.append({
                    "type": "ABSENCE_SPIKE",
                    "severity": "HIGH",
                    "reason": (
                        f"{consec_absent} consecutive absences detected in "
                        f"{subj.name} ({subj.code})."
                    ),
                })

        # 4. Declining trend (compare last 3 vs previous 3 overall)
        recent_six = _recent_records(all_records, 6)
        if len(recent_six) >= 6:
            newer = recent_six[:3]
            older = recent_six[3:]
            new_pct = _pct(sum(1 for r in newer if r.status in ["PRESENT", "LATE"]), 3)
            old_pct = _pct(sum(1 for r in older if r.status in ["PRESENT", "LATE"]), 3)
            if new_pct < old_pct - 20:  # significant drop
                anomalies.append({
                    "type": "DECLINING_TREND",
                    "severity": "MEDIUM",
                    "reason": (
                        f"Recent attendance dropped from {old_pct}% to {new_pct}%. "
                        "This trend may lead to a shortage."
                    ),
                })

        # Overall anomaly risk
        if any(a["severity"] == "HIGH" for a in anomalies):
            overall = "HIGH"
        elif anomalies:
            overall = "MEDIUM"
        else:
            overall = "LOW"

        return {
            "risk": overall,
            "anomaly_count": len(anomalies),
            "anomalies": anomalies,
        }


# ---------------------------------------------------------------------------
# Engine 3: Attendance Insights
# ---------------------------------------------------------------------------

class InsightsEngine:
    """
    Per-subject trend analysis and actionable suggestions.

    Trend categories (compare last 5 vs previous 5 sessions):
      IMPROVING  — newer 5 better by ≥ 10%
      STABLE     — within ± 10%
      DECLINING  — newer 5 worse by ≥ 10%
    """

    SHORTAGE_THRESHOLD = 75.0  # percent

    @staticmethod
    def _subject_insight(records_qs, subject) -> dict:
        total   = records_qs.count()
        present = records_qs.filter(status__in=["PRESENT", "LATE"]).count()
        pct     = _pct(present, total)

        # Trend: compare last 5 vs previous 5
        recent_10 = _recent_records(records_qs, 10)
        trend     = "STABLE"
        if len(recent_10) >= 6:
            newer = recent_10[:5]
            older = recent_10[5:]
            new_p = _pct(sum(1 for r in newer if r.status in ["PRESENT", "LATE"]), len(newer))
            old_p = _pct(sum(1 for r in older if r.status in ["PRESENT", "LATE"]), len(older))
            if new_p >= old_p + 10:
                trend = "IMPROVING"
            elif new_p <= old_p - 10:
                trend = "DECLINING"

        # Shortage prediction: how many more classes can be missed?
        classes_can_miss = 0
        predicted_shortage_sessions = None
        if pct >= InsightsEngine.SHORTAGE_THRESHOLD:
            # max_absent = floor((total * (1 - threshold/100))) - absent_so_far
            absent = total - present
            max_absent = int(total * (1 - InsightsEngine.SHORTAGE_THRESHOLD / 100))
            can_miss_more = max(0, max_absent - absent)
            classes_can_miss = can_miss_more
        else:
            # Already in shortage — extrapolate sessions needed to recover
            sessions_needed = 0
            t, p = total, present
            while _pct(p, t) < InsightsEngine.SHORTAGE_THRESHOLD and t < total + 30:
                t += 1
                p += 1
                sessions_needed += 1
            predicted_shortage_sessions = sessions_needed if sessions_needed <= 30 else None

        # Suggestion
        if pct >= 80:
            suggestion = "Great attendance! Keep it up."
        elif pct >= 75:
            suggestion = f"You can miss at most {classes_can_miss} more class(es) safely."
        elif pct >= 65:
            suggestion = "Attend every remaining class to recover your attendance."
        else:
            suggestion = "Critical shortage. Contact your faculty advisor immediately."

        return {
            "subject_code": subject.code,
            "subject_name": subject.name,
            "total_sessions": total,
            "present": present,
            "percentage": pct,
            "trend": trend,
            "classes_can_miss_safely": classes_can_miss,
            "sessions_to_recover": predicted_shortage_sessions,
            "suggestion": suggestion,
        }

    @staticmethod
    def insights(student) -> dict:
        from apps.attendance.models import AttendanceRecord

        all_records = AttendanceRecord.objects.filter(student=student)
        subject_ids = set(all_records.values_list("session__subject_id", flat=True))

        subject_insights = []
        for subj_id in subject_ids:
            subj_records = all_records.filter(session__subject_id=subj_id)
            subj = subj_records.first().session.subject
            subject_insights.append(InsightsEngine._subject_insight(subj_records, subj))

        return {
            "student_id": student.student_id,
            "generated_at": timezone.now().isoformat(),
            "subjects": subject_insights,
        }
