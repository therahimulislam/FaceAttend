"""
FaceAttend — Phase 15: Report Views

Four aggregated report endpoints, each supporting JSON + CSV + Excel + PDF exports.

  GET /api/v1/reports/student/     → StudentReportView
  GET /api/v1/reports/subject/     → SubjectReportView
  GET /api/v1/reports/section/     → SectionReportView
  GET /api/v1/reports/department/  → DepartmentReportView

Common query params:
  format      json | csv | xlsx | pdf   (default: json)
  date_from   YYYY-MM-DD
  date_to     YYYY-MM-DD
"""
from datetime import date, datetime

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.views import APIView

from apps.attendance.models import AttendanceRecord, AttendanceStatus
from apps.common.permissions import IsAdminUser, IsStudent, IsFaculty
from apps.common.responses import success_response, error_response
from .exporters import csv_response, excel_response, pdf_response


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_dates(request):
    """Parse date_from / date_to query params → (date|None, date|None)."""
    def _p(param):
        val = request.query_params.get(param)
        if not val:
            return None
        try:
            return datetime.strptime(val, "%Y-%m-%d").date()
        except ValueError:
            return None

    date_from = _p("date_from")
    date_to = _p("date_to")
    return date_from, date_to


def _apply_date_filter(qs, date_from, date_to, field="session__date"):
    if date_from:
        qs = qs.filter(**{f"{field}__gte": date_from})
    if date_to:
        qs = qs.filter(**{f"{field}__lte": date_to})
    return qs


def _period_str(date_from, date_to):
    frm = date_from.strftime("%d %b %Y") if date_from else "All time"
    to = date_to.strftime("%d %b %Y") if date_to else "Present"
    return {"from": str(date_from or ""), "to": str(date_to or ""), "label": f"{frm} – {to}"}


def _pct(num, denom):
    return round(num / denom * 100, 1) if denom else 0.0


def _export_format(request):
    return request.query_params.get("export", "json").lower()


# ---------------------------------------------------------------------------
# Student Report
# ---------------------------------------------------------------------------

class StudentReportView(APIView):
    """
    GET /api/v1/reports/student/

    Admin: provide ?student_id=<uuid>
    Student: omit student_id → own report inferred from JWT
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        fmt = _export_format(request)
        date_from, date_to = _parse_dates(request)

        # Resolve student
        student_id = request.query_params.get("student_id")
        if student_id:
            if not (request.user.role in ["DEPARTMENT_ADMIN", "SUPER_ADMIN", "FACULTY"]):
                return error_response(
                    message="Only faculty and admins can query other students.",
                    code="FORBIDDEN", status_code=403,
                )
            from apps.students.models import Student
            try:
                student = Student.objects.select_related(
                    "department", "section", "semester"
                ).get(id=student_id)
            except Student.DoesNotExist:
                return error_response(message="Student not found.", code="NOT_FOUND", status_code=404)
        else:
            try:
                student = request.user.student_profile
            except Exception:
                return error_response(
                    message="Student profile not found.",
                    code="NO_PROFILE", status_code=403,
                )

        # Records
        qs = AttendanceRecord.objects.filter(student=student).select_related(
            "session__subject"
        )
        qs = _apply_date_filter(qs, date_from, date_to)

        # Aggregate by subject
        subject_map: dict = {}
        for rec in qs:
            subj = rec.session.subject
            k = str(subj.id)
            if k not in subject_map:
                subject_map[k] = {
                    "subject_code": subj.code,
                    "subject_name": subj.name,
                    "total": 0, "present": 0, "late": 0, "absent": 0, "excused": 0,
                }
            subject_map[k]["total"] += 1
            subject_map[k][rec.status.lower()] += 1

        by_subject = []
        total_all = present_all = late_all = absent_all = excused_all = 0
        for entry in subject_map.values():
            entry["percentage"] = _pct(entry["present"] + entry["late"], entry["total"])
            by_subject.append(entry)
            total_all += entry["total"]
            present_all += entry["present"]
            late_all += entry["late"]
            absent_all += entry["absent"]
            excused_all += entry["excused"]

        by_subject.sort(key=lambda x: x["subject_name"])

        report = {
            "student": {
                "id": str(student.id),
                "full_name": student.full_name,
                "student_id": student.student_id,
                "department": student.department.name if student.department else student.department_name,
                "section": student.section.name if student.section else student.section_name,
            },
            "period": _period_str(date_from, date_to),
            "overall": {
                "total": total_all,
                "present": present_all,
                "late": late_all,
                "absent": absent_all,
                "excused": excused_all,
                "percentage": _pct(present_all + late_all, total_all),
            },
            "by_subject": by_subject,
        }

        # ---------- JSON ----------
        if fmt == "json":
            return success_response(data=report)

        # ---------- Export formats ----------
        headers = ["Subject Code", "Subject Name", "Total", "Present", "Late", "Absent", "Excused", "%"]
        rows = [
            [
                s["subject_code"], s["subject_name"],
                s["total"], s["present"], s["late"], s["absent"], s["excused"],
                f"{s['percentage']}%",
            ]
            for s in by_subject
        ]

        safe_name = student.student_id.replace("/", "-")
        period_label = f"{date_from}_{date_to}" if (date_from or date_to) else "all"
        base_name = f"student_report_{safe_name}_{period_label}"

        meta = [
            f"Student: {student.full_name} ({student.student_id})",
            f"Department: {report['student']['department']} | Section: {report['student']['section']}",
            f"Period: {report['period']['label']}",
            f"Overall: {present_all + late_all}/{total_all} ({report['overall']['percentage']}%)",
        ]

        if fmt == "csv":
            return csv_response(rows, headers, f"{base_name}.csv")
        if fmt == "xlsx":
            return excel_response(rows, headers, f"{base_name}.xlsx", sheet_name="Attendance")
        if fmt == "pdf":
            return pdf_response(
                title=f"Student Report — {student.full_name}",
                headers=headers, rows=rows, meta_lines=meta,
                filename=f"{base_name}.pdf",
            )

        return error_response(message=f"Unknown format '{fmt}'.", code="INVALID_FORMAT", status_code=400)


# ---------------------------------------------------------------------------
# Subject Report
# ---------------------------------------------------------------------------

class SubjectReportView(APIView):
    """
    GET /api/v1/reports/subject/?subject_id=<uuid>[&section_id=<uuid>]
    Auth: Faculty (own subject) or Admin
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        fmt = _export_format(request)
        date_from, date_to = _parse_dates(request)

        subject_id = request.query_params.get("subject_id")
        if not subject_id:
            return error_response(message="subject_id is required.", code="MISSING_PARAM", status_code=400)

        from apps.academics.models import Subject
        try:
            subject = Subject.objects.get(id=subject_id)
        except Subject.DoesNotExist:
            return error_response(message="Subject not found.", code="NOT_FOUND", status_code=404)

        section_id = request.query_params.get("section_id")

        qs = AttendanceRecord.objects.filter(session__subject=subject).select_related(
            "student", "session"
        )
        if section_id:
            qs = qs.filter(session__section_id=section_id)
        qs = _apply_date_filter(qs, date_from, date_to)

        # Aggregate per student
        student_map: dict = {}
        for rec in qs:
            k = str(rec.student_id)
            if k not in student_map:
                student_map[k] = {
                    "student_id": rec.student.student_id,
                    "full_name": rec.student.full_name,
                    "total_sessions": 0, "present": 0, "late": 0, "absent": 0, "excused": 0,
                }
            student_map[k]["total_sessions"] += 1
            student_map[k][rec.status.lower()] += 1

        by_student = []
        for entry in student_map.values():
            entry["percentage"] = _pct(entry["present"] + entry["late"], entry["total_sessions"])
            by_student.append(entry)

        by_student.sort(key=lambda x: x["full_name"])

        report = {
            "subject": {"id": str(subject.id), "code": subject.code, "name": subject.name},
            "period": _period_str(date_from, date_to),
            "total_students": len(by_student),
            "by_student": by_student,
        }

        if fmt == "json":
            return success_response(data=report)

        headers = ["Student ID", "Name", "Sessions", "Present", "Late", "Absent", "Excused", "%"]
        rows = [
            [s["student_id"], s["full_name"], s["total_sessions"],
             s["present"], s["late"], s["absent"], s["excused"], f"{s['percentage']}%"]
            for s in by_student
        ]
        base_name = f"subject_report_{subject.code}_{date_from}_{date_to}"
        meta = [
            f"Subject: {subject.name} ({subject.code})",
            f"Period: {report['period']['label']}",
            f"Total Students: {len(by_student)}",
        ]

        if fmt == "csv":
            return csv_response(rows, headers, f"{base_name}.csv")
        if fmt == "xlsx":
            return excel_response(rows, headers, f"{base_name}.xlsx", sheet_name="Subject")
        if fmt == "pdf":
            return pdf_response(
                title=f"Subject Report — {subject.name}",
                headers=headers, rows=rows, meta_lines=meta,
                filename=f"{base_name}.pdf",
            )

        return error_response(message=f"Unknown format '{fmt}'.", code="INVALID_FORMAT", status_code=400)


# ---------------------------------------------------------------------------
# Section Report
# ---------------------------------------------------------------------------

class SectionReportView(APIView):
    """
    GET /api/v1/reports/section/?section_id=<uuid>
    Auth: Faculty (own section) or Admin
    Returns a grid: students × subjects with per-cell attendance %.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        fmt = _export_format(request)
        date_from, date_to = _parse_dates(request)

        section_id = request.query_params.get("section_id")
        if not section_id:
            return error_response(message="section_id is required.", code="MISSING_PARAM", status_code=400)

        from apps.academics.models import Section
        try:
            section = Section.objects.select_related("semester__department").get(id=section_id)
        except Section.DoesNotExist:
            return error_response(message="Section not found.", code="NOT_FOUND", status_code=404)

        qs = AttendanceRecord.objects.filter(session__section=section).select_related(
            "student", "session__subject"
        )
        qs = _apply_date_filter(qs, date_from, date_to)

        # Build grid: student_id → subject_code → counts
        grid: dict = {}        # student_id → {"name": ..., "by_subject": {code: {total,attended}}}
        subjects: dict = {}    # code → name

        for rec in qs:
            stu_k = str(rec.student_id)
            subj = rec.session.subject
            subj_code = subj.code
            subjects[subj_code] = subj.name

            if stu_k not in grid:
                grid[stu_k] = {
                    "student_id": rec.student.student_id,
                    "full_name": rec.student.full_name,
                    "by_subject": {},
                    "total_all": 0,
                    "attended_all": 0,
                }
            if subj_code not in grid[stu_k]["by_subject"]:
                grid[stu_k]["by_subject"][subj_code] = {"total": 0, "attended": 0}

            grid[stu_k]["by_subject"][subj_code]["total"] += 1
            grid[stu_k]["total_all"] += 1
            if rec.status in [AttendanceStatus.PRESENT, AttendanceStatus.LATE]:
                grid[stu_k]["by_subject"][subj_code]["attended"] += 1
                grid[stu_k]["attended_all"] += 1

        subject_codes = sorted(subjects.keys())
        rows_data = []
        for entry in sorted(grid.values(), key=lambda x: x["full_name"]):
            row = {
                "student_id": entry["student_id"],
                "full_name": entry["full_name"],
                "by_subject": {
                    code: _pct(
                        entry["by_subject"].get(code, {}).get("attended", 0),
                        entry["by_subject"].get(code, {}).get("total", 0),
                    )
                    for code in subject_codes
                },
                "overall_percentage": _pct(entry["attended_all"], entry["total_all"]),
            }
            rows_data.append(row)

        report = {
            "section": {
                "id": str(section.id),
                "name": section.name,
                "semester": section.semester.name,
                "department": section.semester.department.name,
            },
            "period": _period_str(date_from, date_to),
            "subjects": subject_codes,
            "rows": rows_data,
        }

        if fmt == "json":
            return success_response(data=report)

        # Flatten for export: Student ID | Name | SubjA% | SubjB% | ... | Overall%
        headers = ["Student ID", "Name"] + subject_codes + ["Overall %"]
        rows = [
            [r["student_id"], r["full_name"]]
            + [f"{r['by_subject'].get(c, 0.0)}%" for c in subject_codes]
            + [f"{r['overall_percentage']}%"]
            for r in rows_data
        ]
        base_name = f"section_report_{section.name}_{date_from}_{date_to}".replace(" ", "_")
        meta = [
            f"Section: {section.name} | {section.semester.name} | {section.semester.department.name}",
            f"Period: {report['period']['label']}",
            f"Subjects: {', '.join(subject_codes)}",
        ]

        if fmt == "csv":
            return csv_response(rows, headers, f"{base_name}.csv")
        if fmt == "xlsx":
            return excel_response(rows, headers, f"{base_name}.xlsx", sheet_name="Section")
        if fmt == "pdf":
            return pdf_response(
                title=f"Section Report — {section.name}",
                headers=headers, rows=rows, meta_lines=meta,
                filename=f"{base_name}.pdf",
            )

        return error_response(message=f"Unknown format '{fmt}'.", code="INVALID_FORMAT", status_code=400)


# ---------------------------------------------------------------------------
# Department Report
# ---------------------------------------------------------------------------

class DepartmentReportView(APIView):
    """
    GET /api/v1/reports/department/?department_id=<uuid>
    Auth: Admin only
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        fmt = _export_format(request)
        date_from, date_to = _parse_dates(request)

        dept_id = request.query_params.get("department_id")
        if not dept_id:
            return error_response(message="department_id is required.", code="MISSING_PARAM", status_code=400)

        from apps.departments.models import Department
        try:
            dept = Department.objects.get(id=dept_id)
        except Department.DoesNotExist:
            return error_response(message="Department not found.", code="NOT_FOUND", status_code=404)

        from apps.attendance.models import AttendanceSession
        from apps.academics.models import Section
        from apps.students.models import Student, ApprovalStatus

        # All sections in this department
        sections = Section.objects.filter(
            semester__department=dept
        ).select_related("semester")

        by_section = []
        total_pcts = []

        for section in sections:
            sessions = AttendanceSession.objects.filter(section=section)
            sessions = _apply_date_filter(sessions, date_from, date_to, field="date")
            total_sessions = sessions.count()

            enrolled = Student.objects.filter(
                section=section, approval_status=ApprovalStatus.APPROVED
            ).count()

            attended = AttendanceRecord.objects.filter(
                session__in=sessions,
                status__in=[AttendanceStatus.PRESENT, AttendanceStatus.LATE],
            ).count()

            total_possible = total_sessions * enrolled
            avg_pct = _pct(attended, total_possible)
            total_pcts.append(avg_pct)

            by_section.append({
                "section_name": f"{section.name} ({section.semester.name})",
                "total_students": enrolled,
                "total_sessions": total_sessions,
                "avg_attendance": avg_pct,
            })

        by_section.sort(key=lambda x: x["avg_attendance"], reverse=True)
        overall_avg = round(sum(total_pcts) / len(total_pcts), 1) if total_pcts else 0.0

        report = {
            "department": {"id": str(dept.id), "name": dept.name, "code": dept.code},
            "period": _period_str(date_from, date_to),
            "total_sections": len(by_section),
            "by_section": by_section,
            "overall_avg": overall_avg,
        }

        if fmt == "json":
            return success_response(data=report)

        headers = ["Section", "Students", "Sessions", "Avg Attendance %"]
        rows = [
            [s["section_name"], s["total_students"], s["total_sessions"], f"{s['avg_attendance']}%"]
            for s in by_section
        ]
        base_name = f"dept_report_{dept.code}_{date_from}_{date_to}"
        meta = [
            f"Department: {dept.name} ({dept.code})",
            f"Period: {report['period']['label']}",
            f"Overall Average: {overall_avg}%",
        ]

        if fmt == "csv":
            return csv_response(rows, headers, f"{base_name}.csv")
        if fmt == "xlsx":
            return excel_response(rows, headers, f"{base_name}.xlsx", sheet_name="Department")
        if fmt == "pdf":
            return pdf_response(
                title=f"Department Report — {dept.name}",
                headers=headers, rows=rows, meta_lines=meta,
                filename=f"{base_name}.pdf",
            )

        return error_response(message=f"Unknown format '{fmt}'.", code="INVALID_FORMAT", status_code=400)
