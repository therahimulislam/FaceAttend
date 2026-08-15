"""
FaceAttend — Face Enrollment App config
"""
from django.apps import AppConfig


class FaceConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.face"
    label = "face"
    verbose_name = "Face Enrollment"
