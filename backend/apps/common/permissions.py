"""
FaceAttend — Role-Based Permission Classes

Usage:
    from apps.common.permissions import IsStudent, IsFaculty, IsDepartmentAdmin, IsSuperAdmin

Combine with standard DRF:
    permission_classes = [IsAuthenticated, IsStudent]
"""
from rest_framework.permissions import BasePermission


class IsStudent(BasePermission):
    """Allow access only to users with STUDENT role."""
    message = "Access restricted to students."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == "STUDENT"
        )


class IsFaculty(BasePermission):
    """Allow access only to users with FACULTY role."""
    message = "Access restricted to faculty members."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == "FACULTY"
        )


class IsDepartmentAdmin(BasePermission):
    """Allow access only to DEPARTMENT_ADMIN or SUPER_ADMIN."""
    message = "Access restricted to department administrators."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ("DEPARTMENT_ADMIN", "SUPER_ADMIN")
        )


class IsSuperAdmin(BasePermission):
    """Allow access only to SUPER_ADMIN."""
    message = "Access restricted to super administrators."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == "SUPER_ADMIN"
        )


class IsFacultyOrAdmin(BasePermission):
    """Allow access to FACULTY, DEPARTMENT_ADMIN, or SUPER_ADMIN."""
    message = "Access restricted to faculty and administrators."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ("FACULTY", "DEPARTMENT_ADMIN", "SUPER_ADMIN")
        )


class IsAdminUser(BasePermission):
    """Allow access to DEPARTMENT_ADMIN or SUPER_ADMIN (alias for clarity)."""
    message = "Access restricted to administrators."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ("DEPARTMENT_ADMIN", "SUPER_ADMIN")
        )
