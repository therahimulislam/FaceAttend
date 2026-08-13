/**
 * Typed access to Vite environment variables.
 * All values come from .env (VITE_ prefix required by Vite).
 * No secrets should ever be in frontend env vars.
 */

export const env = {
  API_BASE_URL: import.meta.env["VITE_API_BASE_URL"] as string ?? "http://localhost:8000/api/v1",
  WS_BASE_URL: import.meta.env["VITE_WS_BASE_URL"] as string ?? "ws://localhost:8000/ws",
  APP_NAME: import.meta.env["VITE_APP_NAME"] as string ?? "FaceAttend",
  APP_TAGLINE: import.meta.env["VITE_APP_TAGLINE"] as string ?? "Smart Attendance. Verified Presence.",
  features: {
    faceRecognition: import.meta.env["VITE_FEATURE_FACE_RECOGNITION"] === "true",
    livenessDetection: import.meta.env["VITE_FEATURE_LIVENESS_DETECTION"] === "true",
    gpsVerification: import.meta.env["VITE_FEATURE_GPS_VERIFICATION"] === "true",
  },
} as const;
