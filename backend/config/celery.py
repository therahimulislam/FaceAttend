"""
FaceAttend — Celery Configuration
"""
import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

app = Celery("faceattend")

# Read config from Django settings, namespace 'CELERY'
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks in all installed apps
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task — prints request info. Used to verify Celery is working."""
    print(f"Request: {self.request!r}")
