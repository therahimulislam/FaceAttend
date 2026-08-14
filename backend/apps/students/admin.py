from django.contrib import admin
from .models import Student, ApprovalStatus


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ("full_name", "student_id", "department_name", "approval_status", "created_at")
    list_filter = ("approval_status", "department_name")
    search_fields = ("full_name", "student_id", "user__email")
    ordering = ("-created_at",)
    readonly_fields = ("id", "created_at", "updated_at", "approved_by", "approved_at")

    actions = ["approve_students", "reject_students"]

    @admin.action(description="Approve selected students")
    def approve_students(self, request, queryset):
        from django.utils import timezone
        queryset.update(
            approval_status=ApprovalStatus.APPROVED,
            approved_by=request.user,
            approved_at=timezone.now(),
        )

    @admin.action(description="Reject selected students")
    def reject_students(self, request, queryset):
        queryset.update(approval_status=ApprovalStatus.REJECTED)
