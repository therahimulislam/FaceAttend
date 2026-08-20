from django.apps import AppConfig


class attendanceConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.attendance"
    verbose_name = "attendance"

    def ready(self):
        import apps.attendance.signals  # noqa: F401 — registers signal handlers
