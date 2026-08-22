"""
FaceAttend — Common Views
Phase 20: Enhanced with deep health check (DB + Redis connectivity).
"""
import time
import logging
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.utils import timezone

logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """
    Shallow health check — fast, no DB/Redis queries.
    GET /api/v1/health/
    Used by Render/load balancer keep-alive probes. Returns 200 if process is running.
    """
    return Response({
        "success": True,
        "message": "FaceAttend API is running.",
        "data": {
            "service":   "faceattend-api",
            "status":    "healthy",
            "timestamp": timezone.now().isoformat(),
        },
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def deep_health_check(request):
    """
    Deep health check — verifies DB + Redis connectivity.
    GET /api/v1/health/deep/

    Returns 200 if all components are healthy, 503 if any fail.
    Intended for monitoring systems (not for load balancer probes — use /health/ instead).
    """
    components = {}
    overall_ok = True

    # --- Database ---
    try:
        t0 = time.monotonic()
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        components["database"] = {
            "status":      "healthy",
            "latency_ms": round((time.monotonic() - t0) * 1000, 2),
        }
    except Exception as exc:
        logger.error("[health] Database check failed: %s", exc)
        components["database"] = {"status": "unhealthy", "error": str(exc)}
        overall_ok = False

    # --- Redis ---
    try:
        t0 = time.monotonic()
        from django.core.cache import cache
        cache.set("health_check_probe", "ok", timeout=5)
        val = cache.get("health_check_probe")
        if val != "ok":
            raise ValueError("Cache round-trip returned unexpected value")
        components["redis"] = {
            "status":      "healthy",
            "latency_ms": round((time.monotonic() - t0) * 1000, 2),
        }
    except Exception as exc:
        logger.error("[health] Redis check failed: %s", exc)
        components["redis"] = {"status": "unhealthy", "error": str(exc)}
        overall_ok = False

    http_status = 200 if overall_ok else 503
    return Response(
        {
            "success": overall_ok,
            "message": "All systems healthy." if overall_ok else "One or more components unhealthy.",
            "data": {
                "service":    "faceattend-api",
                "status":     "healthy" if overall_ok else "degraded",
                "timestamp":  timezone.now().isoformat(),
                "components": components,
            },
        },
        status=http_status,
    )
