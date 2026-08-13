"""
FaceAttend — Standard API Response Helpers

All API responses follow this envelope:
  Success: {"success": true,  "message": "...", "data": {...}}
  Error:   {"success": false, "message": "...", "code": "ERROR_CODE"}
"""
from rest_framework.response import Response
from rest_framework import status


def success_response(data=None, message="Success.", status_code=status.HTTP_200_OK):
    """Return a standard success response."""
    payload = {
        "success": True,
        "message": message,
        "data": data if data is not None else {},
    }
    return Response(payload, status=status_code)


def created_response(data=None, message="Created successfully."):
    """Return a 201 Created response."""
    return success_response(data=data, message=message, status_code=status.HTTP_201_CREATED)


def error_response(
    message="An error occurred.",
    code="SERVER_ERROR",
    status_code=status.HTTP_400_BAD_REQUEST,
    errors=None,
):
    """Return a standard error response."""
    payload = {
        "success": False,
        "message": message,
        "code": code,
    }
    if errors:
        payload["errors"] = errors
    return Response(payload, status=status_code)


def not_found_response(message="Resource not found.", code="NOT_FOUND"):
    """Return a 404 response."""
    return error_response(message=message, code=code, status_code=status.HTTP_404_NOT_FOUND)


def unauthorized_response(message="Authentication required.", code="AUTH_UNAUTHORIZED"):
    """Return a 401 response."""
    return error_response(
        message=message, code=code, status_code=status.HTTP_401_UNAUTHORIZED
    )


def forbidden_response(message="You do not have permission to perform this action.", code="PERMISSION_DENIED"):
    """Return a 403 response."""
    return error_response(
        message=message, code=code, status_code=status.HTTP_403_FORBIDDEN
    )
