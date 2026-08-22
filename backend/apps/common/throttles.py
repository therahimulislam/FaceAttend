"""
FaceAttend — Phase 20: Custom DRF Throttle Classes

Applied at the view level for endpoints that require stricter rate limiting
than the global defaults (anon: 30/min, user: 200/min).
"""
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """
    10 requests/min per IP for unauthenticated login/register attempts.
    Prevents brute-force credential attacks.
    """
    scope = "login"


class FaceVerifyRateThrottle(UserRateThrottle):
    """
    20 requests/min per authenticated user for face recognition endpoints.
    Prevents abuse of the computationally expensive face verification pipeline.
    """
    scope = "face_verify"
