/**
 * FaceAttend — FaceLivenessCapture Component (Phase 11)
 *
 * Handles the complete liveness verification flow:
 *  1. Request a challenge from the backend
 *  2. Display the challenge instruction to the student
 *  3. Start the webcam and capture frames over 2.5 seconds
 *  4. Send frames to /face/liveness/verify/
 *  5. Return the verified challenge_id to the parent
 *
 * Props:
 *   sessionCode  — ties the challenge to the current attendance session
 *   onVerified   — called with challenge_id when liveness is confirmed
 *   onSkip       — called when student skips liveness
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Loader2, Camera, CheckCircle2, XCircle, AlertCircle, RefreshCw, Scan } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/services/api";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Challenge {
  challenge_id: string;
  challenge_type: "BLINK" | "NOD" | "TURN_LEFT" | "TURN_RIGHT";
  instruction: string;
  expires_at: string;
  nonce: string;
}

type LivenessState =
  | "idle"           // initial state, challenge not yet requested
  | "requesting"     // fetching challenge from backend
  | "ready"          // challenge received, waiting for user to start
  | "capturing"      // webcam active, capturing frames
  | "analyzing"      // sending frames to backend
  | "passed"         // liveness verified
  | "failed"         // liveness failed (retry possible)
  | "error";         // unrecoverable error

// Number of frames to capture
const FRAME_COUNT = 6;
// Interval between frames (ms)
const FRAME_INTERVAL_MS = 400;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  sessionCode?: string;
  onVerified: (challengeId: string) => void;
  onSkip: () => void;
}

export default function FaceLivenessCapture({ sessionCode, onVerified, onSkip }: Props) {
  const [state, setState] = useState<LivenessState>("idle");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [captureProgress, setCaptureProgress] = useState(0); // 0–FRAME_COUNT

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const framesRef = useRef<Blob[]>([]);

  // ── Cleanup webcam on unmount ──
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // ── Step 1: Request challenge ──
  const requestChallenge = useCallback(async () => {
    setState("requesting");
    setErrorMsg("");
    try {
      const res = await api.post<{ success: boolean; data: Challenge }>(
        "/face/liveness/challenge/",
        { session_code: sessionCode ?? "" },
      );
      setChallenge(res.data.data);
      setState("ready");
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message ?? "Failed to request liveness challenge.");
      setState("error");
    }
  }, [sessionCode]);

  // ── Step 2: Start webcam + capture frames ──
  const startCapture = useCallback(async () => {
    if (!challenge) return;

    setState("capturing");
    framesRef.current = [];
    setCaptureProgress(0);

    // Open webcam
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
      });
    } catch {
      setErrorMsg("Camera access denied. Please allow camera access and try again.");
      setState("error");
      return;
    }
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
    }

    // Capture frames at intervals
    const canvas = canvasRef.current!;
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d")!;

    let captured = 0;
    const captureFrame = () => {
      if (!videoRef.current || captured >= FRAME_COUNT) return;
      ctx.drawImage(videoRef.current, 0, 0, 320, 240);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            framesRef.current.push(blob);
            captured++;
            setCaptureProgress(captured);
            if (captured < FRAME_COUNT) {
              setTimeout(captureFrame, FRAME_INTERVAL_MS);
            } else {
              // Done capturing — submit
              stopWebcam();
              submitFrames(challenge.challenge_id);
            }
          }
        },
        "image/jpeg",
        0.85,
      );
    };

    // Small delay so webcam stabilises
    setTimeout(captureFrame, 400);
  }, [challenge, stopWebcam]);

  // ── Step 3: Submit frames to backend ──
  const submitFrames = useCallback(async (challengeId: string) => {
    setState("analyzing");
    const form = new FormData();
    form.append("challenge_id", challengeId);
    framesRef.current.forEach((blob, i) => {
      form.append("frames", blob, `frame_${i}.jpg`);
    });

    try {
      await api.post(
        "/face/liveness/verify/",
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      setState("passed");
      onVerified(challengeId);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.code === "LIVENESS_FAILED") {
        setErrorMsg(data.message ?? "Liveness check failed. Please try again.");
        setState("failed");
      } else if (data?.code === "CHALLENGE_EXPIRED") {
        setErrorMsg("Challenge expired. Requesting a new one…");
        setState("idle");
        requestChallenge();
      } else {
        setErrorMsg(data?.message ?? "An error occurred during liveness verification.");
        setState("error");
      }
    }
  }, [onVerified, requestChallenge]);

  // ── Render ──
  return (
    <div className="rounded-xl bg-white/3 border border-white/8 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scan size={14} className="text-purple-400" />
          <span className="text-slate-300 text-sm font-medium">Liveness Detection</span>
          <span className="text-slate-600 text-xs">(Optional)</span>
        </div>
        {state === "passed" && (
          <span className="text-emerald-400 text-xs flex items-center gap-1">
            <CheckCircle2 size={11} /> Verified
          </span>
        )}
      </div>

      {/* State machine UI */}

      {state === "idle" && (
        <div className="space-y-3">
          <p className="text-slate-500 text-xs">
            Prove you are physically present — not a photo or recording.
          </p>
          <Button
            size="sm" variant="outline"
            className="w-full border-white/10 text-slate-300 hover:bg-white/5"
            onClick={requestChallenge}
          >
            <Camera size={13} /> Start Liveness Check
          </Button>
        </div>
      )}

      {state === "requesting" && (
        <div className="flex items-center justify-center gap-2 py-3 text-slate-400 text-sm">
          <Loader2 className="animate-spin" size={14} /> Preparing challenge…
        </div>
      )}

      {state === "ready" && challenge && (
        <div className="space-y-3">
          {/* Challenge instruction */}
          <div className="bg-purple-950/40 border border-purple-800/40 rounded-lg p-3">
            <p className="text-purple-300 text-xs font-semibold mb-1">Your challenge:</p>
            <p className="text-white text-sm">{challenge.instruction}</p>
          </div>
          <p className="text-slate-500 text-xs">
            Click below, then perform the action in front of your camera. 6 frames will be captured over ~2.5 seconds.
          </p>
          <Button
            size="sm"
            className="w-full bg-purple-700 hover:bg-purple-600 text-white"
            onClick={startCapture}
          >
            <Camera size={13} /> Open Camera & Verify
          </Button>
        </div>
      )}

      {state === "capturing" && (
        <div className="space-y-3">
          {challenge && (
            <div className="bg-purple-950/40 border border-purple-800/40 rounded-lg p-2 text-center">
              <p className="text-purple-300 text-xs">{challenge.instruction}</p>
            </div>
          )}
          {/* Live video preview */}
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />
            {/* Frame counter overlay */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {Array.from({ length: FRAME_COUNT }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i < captureProgress ? "bg-purple-400" : "bg-white/20"
                  }`}
                />
              ))}
            </div>
          </div>
          <p className="text-slate-400 text-xs text-center">
            Capturing frame {captureProgress + 1}/{FRAME_COUNT}…
          </p>
          {/* Hidden canvas for frame extraction */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {state === "analyzing" && (
        <div className="flex items-center justify-center gap-2 py-3 text-slate-400 text-sm">
          <Loader2 className="animate-spin" size={14} /> Analyzing liveness…
        </div>
      )}

      {state === "passed" && (
        <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-lg p-3 text-center">
          <CheckCircle2 size={20} className="text-emerald-400 mx-auto mb-1" />
          <p className="text-emerald-300 text-sm font-medium">Liveness Verified</p>
          <p className="text-slate-500 text-xs mt-0.5">Your presence has been confirmed.</p>
        </div>
      )}

      {state === "failed" && (
        <div className="space-y-3">
          <div className="bg-amber-950/40 border border-amber-800/40 rounded-lg p-3">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm mb-1">
              <AlertCircle size={14} /> Liveness Check Failed
            </div>
            <p className="text-amber-300/80 text-xs">{errorMsg}</p>
          </div>
          <Button
            size="sm" variant="outline"
            className="w-full border-white/10 text-slate-300 hover:bg-white/5"
            onClick={requestChallenge}
          >
            <RefreshCw size={13} /> Try Again
          </Button>
        </div>
      )}

      {state === "error" && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-red-400 text-xs bg-red-950/30 border border-red-800/40 rounded-lg p-3">
            <XCircle size={13} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
          <Button
            size="sm" variant="outline"
            className="w-full border-white/10 text-slate-300 hover:bg-white/5"
            onClick={() => { setState("idle"); setErrorMsg(""); }}
          >
            <RefreshCw size={13} /> Retry
          </Button>
        </div>
      )}

      {/* Skip link (except when passed or actively capturing/analyzing) */}
      {!["capturing", "analyzing", "passed"].includes(state) && (
        <button
          className="w-full text-slate-600 hover:text-slate-400 text-xs transition-colors py-1"
          onClick={onSkip}
        >
          Skip liveness verification
        </button>
      )}
    </div>
  );
}
