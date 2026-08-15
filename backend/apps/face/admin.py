from django.contrib import admin
from .models import FaceEnrollment, EnrollmentStatus


@admin.register(FaceEnrollment)
class FaceEnrollmentAdmin(admin.ModelAdmin):
    list_display = ("student", "status", "created_at", "updated_at")
    list_filter = ("status",)
    search_fields = ("student__student_id", "student__full_name")
    readonly_fields = ("id", "student", "embedding", "created_at", "updated_at",
                       "revoked_by", "revoked_at")
    ordering = ("-created_at",)

    actions = ["revoke_selected"]

    def revoke_selected(self, request, queryset):
        from django.utils import timezone
        updated = queryset.update(
            status=EnrollmentStatus.REVOKED,
            revoked_by=request.user,
            revoked_at=timezone.now(),
        )
        self.message_user(request, f"{updated} enrollment(s) revoked.")
    revoke_selected.short_description = "Revoke selected enrollments"
