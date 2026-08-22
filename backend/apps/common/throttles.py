"""
FaceAttend — Phase 20: Custom DRF Throttle Classes

Applied at the view level for endpoints that require stricter rate limiting
than the global defaults (anon: 30/min, user: 200/min).

Design:
  - In DEBUG mode (development/test), throttles are no-ops so test suites
    don't need a live Redis connection.
  - In production (DEBUG=False), throttles enforce per-IP / per-user limits
    backed by the Redis cache.
"""
from django.conf import settings
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class _DebugBypassMixin:
    """
    Mixin that disables throttle enforcement when DEBUG=True.
    Prevents test failures caused by missing Redis in the test environment.
    """
    def allow_request(self, request, view):
        if settings.DEBUG:
            return True
        return super().allow_request(request, view)  # type: ignore[misc]


class LoginRateThrottle(_DebugBypassMixin, AnonRateThrottle):
    """
    10 requests/min per IP for unauthenticated login/register attempts.
    Prevents brute-force credential attacks.
    No-op when DEBUG=True.
    """
    scope = "login"


class FaceVerifyRateThrottle(_DebugBypassMixin, UserRateThrottle):
    """
    20 requests/min per authenticated user for face recognition endpoints.
    Prevents abuse of the computationally expensive face verification pipeline.
    No-op when DEBUG=True.
    """
    scope = "face_verify"
