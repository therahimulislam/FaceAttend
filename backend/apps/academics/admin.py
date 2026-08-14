from django.contrib import admin
from .models import AcademicYear, Semester, Section

@admin.register(AcademicYear)
class AcademicYearAdmin(admin.ModelAdmin):
    list_display = ("label", "start_date", "end_date", "is_current")
    readonly_fields = ("id",)

@admin.register(Semester)
class SemesterAdmin(admin.ModelAdmin):
    list_display = ("name", "department", "academic_year", "status", "is_current")
    list_filter = ("status", "department", "academic_year")
    search_fields = ("name",)
    readonly_fields = ("id",)

@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ("name", "semester", "capacity", "status")
    list_filter = ("status", "semester__department")
    readonly_fields = ("id",)

from .models import Subject, Room

@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "department", "credits", "hours_per_week", "status")
    list_filter = ("status", "department")
    search_fields = ("code", "name")
    readonly_fields = ("id", "created_at", "updated_at")

@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("name", "building", "floor", "capacity", "status", "has_gps")
    list_filter = ("status", "building")
    search_fields = ("name", "building")
    readonly_fields = ("id", "created_at", "updated_at")
