"""
FaceAttend — WSGI Configuration
(Used as fallback. Primary server is Daphne via ASGI.)
"""
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")

application = get_wsgi_application()
