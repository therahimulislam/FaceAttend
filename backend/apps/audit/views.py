"""
FaceAttend — Phase 17: Audit Log Views

  GET /api/v1/audit-logs/     → paginated list (admin only)
  GET /api/v1/audit-logs/{id}/ → single entry

Filter params:
  event_type   (e.g. STUDENT_APPROVED)
  severity     (INFO | WARNING | CRITICAL)
  actor_email  (search substring)
  date_from    YYYY-MM-DD
  date_to      YYYY-MM-DD
"""
from datetime import datetime

from rest_framework import serializers, viewsets, permissions
from rest_framework.response import Response

from apps.common.pagination import StandardPagination
from apps.common.permissions import IsAdminUser
from apps.common.responses import success_response
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email    = serializers.SerializerMethodField()
    target_email   = serializers.SerializerMethodField()
    event_type_display  = serializers.CharField(source="get_event_type_display", read_only=True)
    severity_display    = serializers.CharField(source="get_severity_display", read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            "id", "event_type", "event_type_display",
            "severity", "severity_display",
            "actor_email", "target_email",
            "description",
            "old_value", "new_value",
            "ip_address", "user_agent",
            "metadata", "created_at",
        ]
        read_only_fields = fields

    def get_actor_email(self, obj):
        return obj.actor.email if obj.actor_id else None

    def get_target_email(self, obj):
        return obj.target_user.email if obj.target_user_id else None


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Admin-only read-only view of the audit log.
    Supports filtering by event_type, severity, actor_email, and date range.
    """
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = AuditLog.objects.select_related("actor", "target_user").order_by("-created_at")

        event_type = self.request.query_params.get("event_type")
        if event_type:
            qs = qs.filter(event_type=event_type)

        severity = self.request.query_params.get("severity")
        if severity:
            qs = qs.filter(severity=severity)

        actor_email = self.request.query_params.get("actor_email")
        if actor_email:
            qs = qs.filter(actor__email__icontains=actor_email)

        date_from = self.request.query_params.get("date_from")
        if date_from:
            try:
                qs = qs.filter(created_at__date__gte=datetime.strptime(date_from, "%Y-%m-%d").date())
            except ValueError:
                pass

        date_to = self.request.query_params.get("date_to")
        if date_to:
            try:
                qs = qs.filter(created_at__date__lte=datetime.strptime(date_to, "%Y-%m-%d").date())
            except ValueError:
                pass

        return qs

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(AuditLogSerializer(page, many=True).data)
        return success_response(data=AuditLogSerializer(qs, many=True).data)
