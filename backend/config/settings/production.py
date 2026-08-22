"""
FaceAttend — Production Settings (Render + Supabase)
Phase 20: Enhanced with full security headers, rate limiting, monitoring.
"""
from .base import *  # noqa: F401, F403
import os
DEBUG = False

# Automatically add Render's dynamic hostname to ALLOWED_HOSTS
if "RENDER_EXTERNAL_HOSTNAME" in os.environ:
    ALLOWED_HOSTS.append(os.environ["RENDER_EXTERNAL_HOSTNAME"])

# Render's internal health check pings use the container's internal IP address.
# We must allow this internal IP or Django returns 400 Bad Request (DisallowedHost).
import socket
try:
    ALLOWED_HOSTS.append(socket.gethostbyname(socket.gethostname()))
except Exception:
    pass

# ---------------------------------------------------------------------------
# Security headers (Phase 20: complete set)
# ---------------------------------------------------------------------------
SECURE_SSL_REDIRECT             = True
SECURE_PROXY_SSL_HEADER         = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE           = True
SESSION_COOKIE_HTTPONLY         = True
SESSION_COOKIE_SAMESITE         = "Lax"
CSRF_COOKIE_SECURE              = True
CSRF_COOKIE_HTTPONLY            = True
CSRF_COOKIE_SAMESITE            = "Lax"
SECURE_HSTS_SECONDS             = 31536000          # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS  = True
SECURE_HSTS_PRELOAD             = True
SECURE_CONTENT_TYPE_NOSNIFF     = True
SECURE_BROWSER_XSS_FILTER       = True
SECURE_REFERRER_POLICY          = "strict-origin-when-cross-origin"
X_FRAME_OPTIONS                 = "DENY"

# ---------------------------------------------------------------------------
# Supabase / PostgreSQL — Transaction Pooler (port 6543)
# Disable server-side cursors (not supported by pgBouncer transaction mode)
# ---------------------------------------------------------------------------
DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = True  # noqa: F405
# With Supabase transaction pooler (pgBouncer / Supavisor), disable persistent connections
# so Django immediately releases connections back to the pool after each request.
DATABASES["default"]["CONN_MAX_AGE"] = int(os.environ.get("DB_CONN_MAX_AGE", 0))  # noqa: F405

# ---------------------------------------------------------------------------
# Static files (WhiteNoise — serves pre-compressed files)
# ---------------------------------------------------------------------------
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# ---------------------------------------------------------------------------
# Rate Limiting (Phase 20)
# Override base.py defaults for production — stricter anon limits
# ---------------------------------------------------------------------------
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"].update({  # noqa: F405
    "anon":        "20/min",   # Stricter in production
    "user":        "200/min",
    "login":       "10/min",
    "face_verify": "20/min",
})

# ---------------------------------------------------------------------------
# Logging — JSON structured logging to stdout (for Render / CloudWatch)
# ---------------------------------------------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "format": (
                '{"time": "%(asctime)s", "level": "%(levelname)s", '
                '"logger": "%(name)s", "message": "%(message)s"}'
            ),
        },
    },
    "handlers": {
        "console": {
            "class":     "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "root": {
        "handlers": ["console"],
        "level":    "WARNING",
    },
    "loggers": {
        "django": {
            "handlers":  ["console"],
            "level":     "ERROR",
            "propagate": False,
        },
        "django.security": {
            "handlers":  ["console"],
            "level":     "WARNING",   # Log security events (CSRF, XSS attempts)
            "propagate": False,
        },
        "apps": {
            "handlers":  ["console"],
            "level":     "WARNING",
            "propagate": False,
        },
    },
}
