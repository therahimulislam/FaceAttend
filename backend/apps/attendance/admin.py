from django.contrib import admin
from .models import AttendanceSession, AttendanceRecord

@admin.register(AttendanceSession)
class AttendanceSessionAdmin(admin.ModelAdmin):
    list_display = ("subject", "section", "faculty", "date", "status", "session_code", "attendance_count", "total_students")
    list_filter = ("status", "date", "section__semester__department")
    search_fields = ("subject__code", "faculty__full_name", "session_code")
    readonly_fields = ("id", "session_code", "started_at", "ended_at", "created_at", "updated_at")
    ordering = ("-date",)

@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display = ("student", "session", "status", "verification_method", "face_verified", "gps_verified", "marked_at")
    list_filter = ("status", "verification_method", "face_verified", "gps_verified")
    search_fields = ("student__full_name", "student__student_id")
    readonly_fields = ("id", "created_at", "updated_at")
