"""
FaceAttend — Face Enrollment Serializers (Phase 9)
"""
from rest_framework import serializers
from .models import FaceEnrollment, EnrollmentStatus


class FaceEnrollmentSerializer(serializers.ModelSerializer):
    """Admin / faculty view of an enrollment record."""
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    student_id_str = serializers.CharField(source="student.student_id", read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = FaceEnrollment
        fields = (
            "id", "student", "student_name", "student_id_str",
            "status", "is_active", "error_message",
            "created_at", "updated_at",
        )
        read_only_fields = fields


class MyEnrollmentSerializer(serializers.ModelSerializer):
    """Student-facing view — no embedding exposed."""
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = FaceEnrollment
        fields = (
            "id", "status", "is_active",
            "error_message", "created_at", "updated_at",
        )
        read_only_fields = fields


class EnrollUploadSerializer(serializers.Serializer):
    """Validates the face photo upload from a student."""
    image = serializers.ImageField(
        help_text="Clear frontal face photo (JPEG/PNG, max 5 MB, min 200×200 px).",
    )

    def validate_image(self, image):
        # Size check: 5 MB
        if image.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Image must be smaller than 5 MB.")
        # Dimension check using Pillow
        try:
            from PIL import Image
            img = Image.open(image)
            w, h = img.size
            if w < 200 or h < 200:
                raise serializers.ValidationError(
                    f"Image too small ({w}×{h}px). Minimum 200×200 px required."
                )
            image.seek(0)  # reset after Pillow reads
        except serializers.ValidationError:
            raise
        except Exception:
            raise serializers.ValidationError("Could not read image dimensions.")
        return image
