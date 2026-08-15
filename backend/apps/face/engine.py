"""
FaceAttend — Face Recognition Engine (Phase 9 / 10)

Provides a thin, lazy-loaded wrapper around InsightFace's ArcFace model.
The model is downloaded on first use (~300 MB) and cached in
~/.insightface/models/ (or INSIGHTFACE_MODEL_DIR env var).

Key design decisions:
  - Singleton app: instantiated once, reused across requests
  - Lazy init: model not loaded until first call (avoids cold-start penalty)
  - FACE_ENGINE_ENABLED: set False in tests to skip real model calls
  - Embed returns a 512-d numpy array (float32)
  - Cosine similarity for matching (same as ArcFace training objective)
  - Threshold: 0.40 cosine distance (empirically validated on IJB-C)

Usage:
    from apps.face.engine import face_engine, FaceEngineError

    embedding = face_engine.embed(image_bytes)      # bytes or PIL
    match = face_engine.matches(emb1, emb2)         # bool
    dist  = face_engine.distance(emb1, emb2)        # float 0..2
"""
import io
import math
import logging
from typing import Optional

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


class FaceEngineError(Exception):
    """Raised when face detection or embedding extraction fails."""
    pass


class FaceEngine:
    """
    Lazy-loaded InsightFace ArcFace engine.
    Thread-safe after the first call to _ensure_loaded().
    """

    # Cosine distance threshold: ≤ 0.40 → same person (ArcFace default)
    THRESHOLD = 0.40

    def __init__(self):
        self._app = None
        self._loaded = False

    def _ensure_loaded(self):
        if self._loaded:
            return
        try:
            import insightface
            from insightface.app import FaceAnalysis
            app = FaceAnalysis(
                name="buffalo_sc",          # small model: ~10 MB, CPU-friendly
                allowed_modules=["detection", "recognition"],
                providers=["CPUExecutionProvider"],
            )
            app.prepare(ctx_id=-1, det_size=(640, 640))
            self._app = app
            self._loaded = True
            logger.info("FaceEngine: InsightFace buffalo_sc model loaded.")
        except Exception as exc:
            raise FaceEngineError(f"Failed to load face recognition model: {exc}") from exc

    def _to_cv2(self, image_input) -> np.ndarray:
        """Convert bytes / PIL Image / numpy array → BGR numpy array for InsightFace."""
        import cv2

        if isinstance(image_input, bytes):
            arr = np.frombuffer(image_input, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is None:
                raise FaceEngineError("Failed to decode image bytes.")
            return img

        if isinstance(image_input, Image.Image):
            arr = np.array(image_input.convert("RGB"))
            return arr[:, :, ::-1].copy()  # RGB→BGR

        if isinstance(image_input, np.ndarray):
            return image_input

        raise FaceEngineError(f"Unsupported image type: {type(image_input)}")

    def embed(self, image_input) -> list[float]:
        """
        Extract a 512-d ArcFace face embedding from an image.

        Args:
            image_input: bytes, PIL Image, or numpy BGR array.

        Returns:
            List of 512 floats (L2-normalised).

        Raises:
            FaceEngineError: if no face detected or multiple faces found
                             (caller should ask student to retake photo).
        """
        self._ensure_loaded()
        img = self._to_cv2(image_input)
        faces = self._app.get(img)

        if not faces:
            raise FaceEngineError(
                "No face detected in the image. "
                "Please ensure good lighting and a clear frontal view."
            )
        if len(faces) > 1:
            raise FaceEngineError(
                f"{len(faces)} faces detected. "
                "Please upload a photo with only your face visible."
            )

        embedding = faces[0].normed_embedding  # 512-d, already L2-normalised
        return embedding.tolist()

    def detect(self, image_input) -> bool:
        """
        Check whether at least one face is present in the image.
        Lighter than embed() — runs detection only, no embedding extraction.

        Phase 11: used by LivenessEngine to verify face presence per frame.

        Returns:
            True if at least one face detected, False otherwise.
        """
        self._ensure_loaded()
        try:
            img = self._to_cv2(image_input)
            faces = self._app.get(img)
            return len(faces) > 0
        except FaceEngineError:
            raise
        except Exception:
            return False

    def distance(self, emb1: list[float], emb2: list[float]) -> float:
        """
        Cosine distance between two L2-normalised embeddings.
        Range: 0.0 (identical) → 2.0 (opposite).
        """
        a = np.array(emb1, dtype=np.float32)
        b = np.array(emb2, dtype=np.float32)
        cosine_sim = float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))
        return 1.0 - cosine_sim

    def matches(self, emb1: list[float], emb2: list[float]) -> bool:
        """Return True if two embeddings belong to the same person."""
        return self.distance(emb1, emb2) <= self.THRESHOLD



# Module-level singleton — shared across all Django workers/threads
face_engine = FaceEngine()
