"""
FaceAttend — Custom Exception Handler

Converts DRF exceptions to the standard response envelope.
Never exposes raw stack traces to clients.
"""
from rest_framework.views import exception_handler
from rest_framework import status
from django.http import Http404
from django.core.exceptions import PermissionDenied


def custom_exception_handler(exc, context):
    """
    Custom DRF exception handler.
    Wraps all errors in the standard FaceAttend envelope:
    {"success": false, "message": "...", "code": "ERROR_CODE"}
    """
    # Let DRF handle the exception first
    response = exception_handler(exc, context)

    if response is not None:
        code = "SERVER_ERROR"
        message = "An unexpected error occurred."

        if response.status_code == status.HTTP_400_BAD_REQUEST:
            code = "VALIDATION_ERROR"
            message = "Invalid request data."
            # Flatten validation errors for the response
            errors = response.data if isinstance(response.data, dict) else {"detail": response.data}
            response.data = {
                "success": False,
                "message": message,
                "code": code,
                "errors": errors,
            }
            return response

        elif response.status_code == status.HTTP_401_UNAUTHORIZED:
            code = "AUTH_UNAUTHORIZED"
            message = "Authentication credentials were not provided or are invalid."

        elif response.status_code == status.HTTP_403_FORBIDDEN:
            code = "PERMISSION_DENIED"
            message = "You do not have permission to perform this action."

        elif response.status_code == status.HTTP_404_NOT_FOUND:
            code = "NOT_FOUND"
            message = "The requested resource was not found."

        elif response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED:
            code = "METHOD_NOT_ALLOWED"
            message = "This method is not allowed."

        elif response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
            code = "RATE_LIMIT_EXCEEDED"
            message = "Too many requests. Please try again later."

        elif response.status_code >= 500:
            code = "SERVER_ERROR"
            message = "An internal server error occurred."

        response.data = {
            "success": False,
            "message": message,
            "code": code,
        }

    return response
