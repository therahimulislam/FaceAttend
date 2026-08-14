from django.contrib import admin
from .models import Faculty

@admin.register(Faculty)
class FacultyAdmin(admin.ModelAdmin):
    list_display = ("full_name", "employee_id", "department", "designation", "is_hod")
    list_filter = ("department", "is_hod")
    search_fields = ("full_name", "employee_id", "user__email")
    readonly_fields = ("id", "created_at", "updated_at")
