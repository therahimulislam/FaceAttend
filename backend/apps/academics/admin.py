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
