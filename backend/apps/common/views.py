"""
FaceAttend — Common Views
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.utils import timezone


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """
    Health check endpoint.
    GET /api/v1/health/
    Used by Render to verify the service is running.
    Returns 200 if the backend is up.
    """
    return Response({
        "success": True,
        "message": "FaceAttend API is running.",
        "data": {
            "service": "faceattend-api",
            "status": "healthy",
            "timestamp": timezone.now().isoformat(),
        },
    })
