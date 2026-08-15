"""
FaceAttend — Liveness Detection Engine (Phase 11)

Implements a multi-frame passive liveness analysis:

  1. Frame variance check (photo attack prevention)
     A static printed photo has near-zero pixel variance across frames.
     A live face has natural micro-movements → measurable variance.

  2. Face presence check (per-frame, using FaceEngine.detect())
     Ensures the submitted frames actually contain a face, not random images.

Attack resistance:
  - Photo attack: fails frame variance check (identical frames)
  - Pre-recorded video: mitigated by server-side challenge nonce (time-limited,
    single-use) and per-session binding
  - No-face submission: fails face presence check

Usage:
    from apps.face.liveness import liveness_engine, LivenessResult

    result = liveness_engine.analyze(list_of_frame_bytes)
    if result.is_live:
        # grant attendance
"""
import logging
from dataclasses import dataclass

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class LivenessResult:
    """Result from a liveness analysis pass."""
    is_live: bool
    reason: str
    confidence: float      # 0.0 – 1.0
    variance: float        # mean pixel std-dev across frames (grayscale 0–255)
    faces_detected: int    # number of frames in which a face was found
    frames_analyzed: int


class LivenessEngine:
    """
    Passive multi-frame liveness analyzer.

    Accepts a list of raw image bytes (JPEG or PNG) captured from the student's
    webcam while performing the challenge action.  No external model is needed
    beyond what InsightFace's face detector already provides.

    Parameters (class-level, can be overridden for testing):
        MIN_FRAMES       — minimum frames that must be submitted
        MIN_FACE_FRAMES  — frames that must contain a detected face
        MIN_VARIANCE     — minimum mean pixel std-dev (photo attack threshold)
    """

    MIN_FRAMES      = 3
    MAX_FRAMES      = 12
    MIN_FACE_FRAMES = 2
    MIN_VARIANCE    = 2.5   # empirically: static photo ≈ 0–1, live face ≈ 3–15

    def analyze(self, frames_bytes: list[bytes]) -> LivenessResult:
        """
        Analyze a list of image frames for liveness.

        Args:
            frames_bytes: list of raw JPEG/PNG bytes (webcam captures).

        Returns:
            LivenessResult with is_live, reason, confidence, variance.
        """
        import cv2

        if not frames_bytes or len(frames_bytes) < self.MIN_FRAMES:
            return LivenessResult(
                is_live=False,
                reason=f"Too few frames submitted. Minimum required: {self.MIN_FRAMES}.",
                confidence=0.0, variance=0.0,
                faces_detected=0, frames_analyzed=0,
            )

        gray_frames = []
        faces_detected = 0
        decode_errors = 0
        frames_to_process = frames_bytes[:self.MAX_FRAMES]

        for raw in frames_to_process:
            # Decode to grayscale
            try:
                arr = np.frombuffer(raw, dtype=np.uint8)
                img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
                if img is None:
                    decode_errors += 1
                    continue
                gray_frames.append(img)
            except Exception:
                decode_errors += 1
                continue

        frames_analyzed = len(gray_frames)
        if frames_analyzed < self.MIN_FRAMES:
            return LivenessResult(
                is_live=False,
                reason=f"Could not decode enough frames ({frames_analyzed} valid, {decode_errors} failed).",
                confidence=0.0, variance=0.0,
                faces_detected=0, frames_analyzed=frames_analyzed,
            )

        # ---- Face presence check ----
        from apps.face.engine import face_engine
        for raw in frames_to_process:
            try:
                if face_engine.detect(raw):
                    faces_detected += 1
            except Exception:
                pass  # detection error → frame counts as no face

        if faces_detected < self.MIN_FACE_FRAMES:
            return LivenessResult(
                is_live=False,
                reason=(
                    f"Face not detected in enough frames "
                    f"({faces_detected}/{frames_analyzed}). "
                    "Ensure your face is clearly visible and well-lit."
                ),
                confidence=0.1,
                variance=0.0,
                faces_detected=faces_detected,
                frames_analyzed=frames_analyzed,
            )

        # ---- Frame variance check ----
        # Resize all frames to the same small size for a fair comparison
        target_h, target_w = 120, 160
        resized = []
        for g in gray_frames:
            try:
                r = cv2.resize(g, (target_w, target_h))
                resized.append(r.astype(np.float32))
            except Exception:
                pass

        if len(resized) < self.MIN_FRAMES:
            return LivenessResult(
                is_live=False,
                reason="Frame resize failed on too many images.",
                confidence=0.0, variance=0.0,
                faces_detected=faces_detected, frames_analyzed=frames_analyzed,
            )

        stack = np.stack(resized, axis=0)          # shape: (N, H, W)
        pixel_std = np.std(stack, axis=0)          # per-pixel std across frames
        mean_variance = float(np.mean(pixel_std))

        # Confidence: 0 at variance=0, saturates to 1 at variance=15
        confidence = min(mean_variance / 15.0, 1.0)

        if mean_variance < self.MIN_VARIANCE:
            return LivenessResult(
                is_live=False,
                reason=(
                    f"Insufficient motion detected across frames "
                    f"(variance={mean_variance:.2f}, required≥{self.MIN_VARIANCE}). "
                    "This may be a static image or photograph. "
                    "Please perform the requested movement."
                ),
                confidence=confidence,
                variance=round(mean_variance, 3),
                faces_detected=faces_detected,
                frames_analyzed=frames_analyzed,
            )

        logger.info(
            "Liveness PASS: variance=%.2f faces=%d/%d",
            mean_variance, faces_detected, frames_analyzed,
        )
        return LivenessResult(
            is_live=True,
            reason="Liveness verified.",
            confidence=round(confidence, 3),
            variance=round(mean_variance, 3),
            faces_detected=faces_detected,
            frames_analyzed=frames_analyzed,
        )


# Module-level singleton
liveness_engine = LivenessEngine()
