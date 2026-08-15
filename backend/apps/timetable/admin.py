from django.contrib import admin
from .models import TimetableEntry

@admin.register(TimetableEntry)
class TimetableEntryAdmin(admin.ModelAdmin):
    list_display = ("section", "subject", "faculty", "room", "day", "start_time", "end_time", "is_active")
    list_filter = ("day", "is_active", "section__semester__department")
    search_fields = ("subject__name", "faculty__full_name", "room__name")
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("day", "start_time")
