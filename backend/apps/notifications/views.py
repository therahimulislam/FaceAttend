"""
FaceAttend — Phase 16: Notification Views

  GET  /api/v1/notifications/                  → paginated list (own only)
  GET  /api/v1/notifications/unread_count/     → { count: N }
  POST /api/v1/notifications/{id}/mark_read/   → mark one read
  POST /api/v1/notifications/mark_all_read/    → mark all read
"""
from rest_framework import viewsets, permissions, serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.pagination import StandardPagination
from apps.common.responses import success_response
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id", "category", "title", "body",
            "is_read", "metadata", "created_at",
        ]
        read_only_fields = fields


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    list      GET  /notifications/
    retrieve  GET  /notifications/{id}/
    unread_count  GET  /notifications/unread_count/
    mark_read     POST /notifications/{id}/mark_read/
    mark_all_read POST /notifications/mark_all_read/
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardPagination

    def get_queryset(self):
        return (
            Notification.objects
            .filter(recipient=self.request.user)
            .order_by("-created_at")
        )

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(NotificationSerializer(page, many=True).data)
        return success_response(data=NotificationSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="unread_count")
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return success_response(data={"count": count})

    @action(detail=True, methods=["post"], url_path="mark_read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=["is_read"])
        return success_response(
            data=NotificationSerializer(notification).data,
            message="Notification marked as read.",
        )

    @action(detail=False, methods=["post"], url_path="mark_all_read")
    def mark_all_read(self, request):
        updated = (
            self.get_queryset()
            .filter(is_read=False)
            .update(is_read=True)
        )
        return success_response(data={"marked_read": updated})
