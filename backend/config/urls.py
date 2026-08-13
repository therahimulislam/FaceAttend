"""
FaceAttend — Root URL Configuration
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # Django admin
    path("admin/", admin.site.urls),

    # API v1
    path("api/v1/", include("apps.common.urls")),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Admin site branding
admin.site.site_header = "FaceAttend Administration"
admin.site.site_title = "FaceAttend Admin"
admin.site.index_title = "FaceAttend — Smart Attendance. Verified Presence."
