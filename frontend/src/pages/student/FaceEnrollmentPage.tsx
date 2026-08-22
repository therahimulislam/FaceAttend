/**
 * FaceAttend — Student Face Enrollment Page (Phase 9)
 *
 * Three states:
 *  1. IDLE — No enrollment. Shows instructions + upload form
 *  2. UPLOADING — Progress indicator while processing
 *  3. ENROLLED — Success card showing enrollment status
 *
 * The student can also re-enroll to replace their existing face.
 */
import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  Camera, Upload, CheckCircle2, XCircle, AlertCircle,
  RefreshCw, Trash2, Loader2, Scan, Eye, EyeOff,
  ChevronRight,
} from "lucide-react";

import { faceApi } from "@/features/face/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ---- Helpers ----
const STATUS_CONFIG = {
  ACTIVE:   { label: "Enrolled",  variant: "success"   as const, icon: <CheckCircle2 size={14} />, color: "text-emerald-400" },
  PENDING:  { label: "Processing",variant: "warning"   as const, icon: <Loader2 size={14} className="animate-spin" />, color: "text-amber-400" },
  FAILED:   { label: "Failed",    variant: "secondary" as const, icon: <XCircle size={14} />,      color: "text-red-400"    },
  REVOKED:  { label: "Revoked",   variant: "secondary" as const, icon: <XCircle size={14} />,      color: "text-slate-400"  },
};

// ---- Guidelines ----
const GUIDELINES = [
  { icon: "💡", text: "Good lighting — face well-lit from the front" },
  { icon: "👁️", text: "Eyes open and looking directly at camera" },
  { icon: "😐", text: "Neutral expression, no glasses or face covering" },
  { icon: "🚫", text: "Only your face visible — no other people in frame" },
  { icon: "📐", text: "Photo at least 200×200 px, under 5 MB" },
];

// ================================================================
// Camera Capture Component
// ================================================================
function CameraCapture({ onCapture }: { onCapture: (blob: Blob) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");

  const startCamera = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreaming(true);
      }
    } catch {
      setError("Could not access camera. Please allow camera permission or upload a photo instead.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
  }, []);

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        onCapture(blob);
        stopCamera();
      }
    }, "image/jpeg", 0.9);
  }, [onCapture, stopCamera]);

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-square max-w-xs mx-auto">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          style={{ display: streaming ? "block" : "none" }}
        />
        {!streaming && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Camera size={40} className="text-slate-600" />
          </div>
        )}
        {streaming && (
          // Face guide overlay
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-40 h-40 rounded-full border-2 border-white/40 border-dashed" />
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {error && (
        <p className="text-red-400 text-xs text-center flex items-center justify-center gap-1">
          <AlertCircle size={11} /> {error}
        </p>
      )}

      <div className="flex gap-2 justify-center">
        {!streaming ? (
          <Button
            size="sm" variant="outline"
            className="border-white/10 text-slate-300 hover:bg-white/5"
            onClick={startCamera}
          >
            <Camera size={13} /> Start Camera
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              className="bg-white text-slate-900 hover:bg-white/90"
              onClick={capture}
            >
              <Scan size={13} /> Capture
            </Button>
            <Button
              size="sm" variant="outline"
              className="border-white/10 text-slate-400 hover:bg-white/5"
              onClick={stopCamera}
            >
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ================================================================
// Upload / Preview area
// ================================================================
function ImagePicker({ onFile }: { onFile: (file: File) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [useCamera, setUseCamera] = useState(false);

  const handleFile = useCallback((file: File) => {
    onFile(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
  }, [onFile]);

  const handleCapture = useCallback((blob: Blob) => {
    const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
    handleFile(file);
    setUseCamera(false);
  }, [handleFile]);

  if (useCamera) {
    return (
      <div className="space-y-3">
        <CameraCapture onCapture={handleCapture} />
        <button
          className="text-slate-400 hover:text-white text-xs w-full text-center transition-colors"
          onClick={() => setUseCamera(false)}
        >
          Switch to file upload instead
        </button>
      </div>
    );
  }

  if (preview) {
    return (
      <div className="space-y-3">
        <div className="relative max-w-xs mx-auto">
          <img
            src={preview}
            className="rounded-xl w-full aspect-square object-cover border border-white/10"
            alt="Face preview"
          />
          <button
            className="absolute top-2 right-2 bg-black/60 rounded-full p-1 hover:bg-black/80 transition-colors"
            onClick={() => setPreview(null)}
          >
            <XCircle size={16} className="text-white" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
          ${dragging ? "border-white/40 bg-white/5" : "border-white/15 hover:border-white/25 hover:bg-white/3"}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        <Upload size={28} className="text-slate-500 mx-auto mb-2" />
        <p className="text-slate-300 text-sm font-medium">Drop photo here or click to browse</p>
        <p className="text-slate-600 text-xs mt-1">JPEG / PNG · Max 5 MB · Min 200×200 px</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      <div className="text-center">
        <span className="text-slate-600 text-xs">or</span>
      </div>

      <Button
        size="sm" variant="outline"
        className="w-full border-white/10 text-slate-300 hover:bg-white/5"
        onClick={() => setUseCamera(true)}
      >
        <Camera size={13} /> Take a Selfie
      </Button>
    </div>
  );
}

// ================================================================
// Enrollment Status Card
// ================================================================
function EnrollmentStatusCard({
  enrollment,
  onRe,
  onDelete,
}: {
  enrollment: { status: string; is_active: boolean; error_message?: string; created_at: string; updated_at: string };
  onRe: () => void;
  onDelete: () => void;
}) {
  const cfg = STATUS_CONFIG[enrollment.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.FAILED;
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cfg.color}>{cfg.icon}</span>
          <span className="text-white font-medium">Face Enrollment</span>
        </div>
        <Badge variant={cfg.variant}>{cfg.label}</Badge>
      </div>

      {enrollment.status === "ACTIVE" && (
        <div className="flex items-center gap-2 text-emerald-400 bg-emerald-950/30 border border-emerald-800/30 rounded-lg px-3 py-2.5 text-sm">
          <CheckCircle2 size={14} />
          Your face is enrolled and ready for attendance verification.
        </div>
      )}

      {enrollment.status === "FAILED" && enrollment.error_message && (
        <div className="bg-red-950/30 border border-red-800/30 rounded-lg px-3 py-2 text-sm">
          <p className="text-red-400 font-medium text-xs mb-0.5">Processing Failed</p>
          <p className="text-red-300/80 text-xs">{enrollment.error_message}</p>
        </div>
      )}

      {enrollment.status === "REVOKED" && (
        <div className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm">
          <p className="text-slate-400 text-xs">Your enrollment has been revoked by an administrator. Please re-enroll.</p>
        </div>
      )}

      <div className="text-slate-600 text-xs space-y-0.5">
        <div>Enrolled: {new Date(enrollment.created_at).toLocaleDateString()}</div>
        <div>Last updated: {new Date(enrollment.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="bg-white text-slate-900 hover:bg-white/90 flex-1"
          onClick={onRe}
        >
          <RefreshCw size={13} /> Re-enroll
        </Button>
        <Button
          size="sm" variant="outline"
          className="border-red-800/40 text-red-400 hover:bg-red-950/30"
          onClick={onDelete}
        >
          <Trash2 size={13} />
        </Button>
      </div>
    </div>
  );
}

// ================================================================
// Main Page
// ================================================================
export default function FaceEnrollmentPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const queryClient = useQueryClient();

  const { data: enrollment, isLoading } = useQuery({
    queryKey: ["my-face-enrollment"],
    queryFn: faceApi.myEnrollment,
  });

  const enrollMutation = useMutation({
    mutationFn: (file: File) => faceApi.enroll(file),
    onSuccess: (data) => {
      queryClient.setQueryData(["my-face-enrollment"], data);
      setSelectedFile(null);
      setShowForm(false);
      setSubmitError("");
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        setSubmitError(err.response?.data?.message ?? "Enrollment failed. Please try again.");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: faceApi.deleteEnrollment,
    onSuccess: () => {
      queryClient.setQueryData(["my-face-enrollment"], null);
    },
  });

  const hasActiveEnrollment = enrollment?.status === "ACTIVE";
  const showUploadForm = showForm || (!isLoading && !enrollment);

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Scan size={22} className="text-slate-400" /> Face Enrollment
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Register your face for biometric attendance verification
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="animate-spin text-slate-500" size={20} />
        </div>
      ) : (
        <>
          {/* Existing enrollment */}
          {enrollment && !showForm && (
            <EnrollmentStatusCard
              enrollment={enrollment}
              onRe={() => setShowForm(true)}
              onDelete={() => {
                if (confirm("Remove your face enrollment? You will need to re-enroll to use face attendance.")) {
                  deleteMutation.mutate();
                }
              }}
            />
          )}

          {/* Upload form */}
          {showUploadForm && (
            <div className="space-y-5">
              {/* Guidelines */}
              <div className="rounded-xl bg-white/3 border border-white/8 p-4">
                <p className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">
                  Photo Guidelines
                </p>
                <ul className="space-y-2">
                  {GUIDELINES.map((g) => (
                    <li key={g.text} className="flex items-start gap-2 text-slate-400 text-sm">
                      <span>{g.icon}</span>
                      <span>{g.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Image picker */}
              <ImagePicker onFile={(f) => { setSelectedFile(f); setSubmitError(""); }} />

              {/* Error */}
              {submitError && (
                <div className="flex items-start gap-2 text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2.5">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Submit */}
              <div className="flex gap-2">
                {enrollment && (
                  <Button
                    variant="outline"
                    className="border-white/10 text-slate-400 hover:bg-white/5"
                    onClick={() => { setShowForm(false); setSelectedFile(null); }}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  className="flex-1 h-12 bg-white text-slate-900 hover:bg-white/90 font-semibold"
                  disabled={!selectedFile || enrollMutation.isPending}
                  onClick={() => selectedFile && enrollMutation.mutate(selectedFile)}
                >
                  {enrollMutation.isPending ? (
                    <><Loader2 className="animate-spin" size={16} /> Processing face…</>
                  ) : (
                    <><ChevronRight size={16} /> {hasActiveEnrollment ? "Re-enroll Face" : "Enroll Face"}</>
                  )}
                </Button>
              </div>

              <p className="text-slate-600 text-xs text-center">
                Your face data is stored securely and used only for attendance verification.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
