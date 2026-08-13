"""
Accounts serializers — Phase 2 will expand these significantly.
"""
from rest_framework import serializers
from .models import User


class UserBasicSerializer(serializers.ModelSerializer):
    """Minimal user representation — safe to expose."""
    class Meta:
        model = User
        fields = ("id", "email", "role", "status", "created_at")
        read_only_fields = fields
