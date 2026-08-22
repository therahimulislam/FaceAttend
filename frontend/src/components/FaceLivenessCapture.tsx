import { useState, useRef, useCallback, useEffect } from "react";
import { Loader2, Camera, CheckCircle2, XCircle, AlertCircle, RefreshCw, Scan, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/services/api";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

interface Challenge {
  challenge_id: string;
  challenge_type: string;
  instruction: string;
  expires_at: string;
  nonce: string;
}

type LivenessState =
  | "initializing"   // loading mediapipe & requesting challenge
  | "ready"          // ready to start webcam
  | "capturing"      // webcam active, waiting for blink
  | "analyzing"      // sending frames to backend
  | "passed"         // liveness verified
  | "failed"         // liveness failed (retry possible)
  | "error";         // unrecoverable error

const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
const EAR_THRESHOLD = 0.22;

function calculateEAR(landmarks: any[], indices: number[]) {
  const p1 = landmarks[indices[0]];
  const p2 = landmarks[indices[1]];
  const p3 = landmarks[indices[2]];
  const p4 = landmarks[indices[3]];
  const p5 = landmarks[indices[4]];
  const p6 = landmarks[indices[5]];

  const dist = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y);

  const vertical1 = dist(p2, p6);
  const vertical2 = dist(p3, p5);
  const horizontal = dist(p1, p4);

  return (vertical1 + vertical2) / (2.0 * horizontal);
}

interface Props {
  sessionCode?: string;
  onVerified: (challengeId: string, faceFile: File) => void;
}

let globalFaceLandmarker: FaceLandmarker | null = null;

export default function FaceLivenessCapture({ sessionCode, onVerified }: Props) {
  const [state, setState] = useState<LivenessState>("initializing");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Use a ref to store the challenge ID so startCapture always has it immediately
  const challengeIdRef = useRef<string>("");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const framesRef = useRef<Blob[]>([]);
  const captureIntervalRef = useRef<any>(null);
  const requestRef = useRef<number>(0);
  
  const isBlinkingRef = useRef(false);

  // Initialize and load everything
  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      try {
        if (!globalFaceLandmarker) {
          const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
          );
          globalFaceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate: "GPU"
            },
            runningMode: "VIDEO",
            numFaces: 1,
          });
        }
        
        const res = await api.post<{ success: boolean; data: Challenge }>(
          "/face/liveness/challenge/",
          { session_code: sessionCode ?? "" },
        );
        
        if (mounted) {
          const challengeData = res.data.data;
          // Store in ref immediately — state update is async and would be empty when startCapture runs
          challengeIdRef.current = challengeData.challenge_id;
          setChallenge(challengeData);
          setState("ready");
          startCapture(challengeData.challenge_id); // Pass ID directly
        }
      } catch (err: any) {
        if (mounted) {
          setErrorMsg(err?.response?.data?.message ?? "Failed to initialize liveness detection.");
          setState("error");
        }
      }
    };
    
    init();
    
    return () => {
      mounted = false;
      stopWebcam();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCode]);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
  }, []);

  const submitFrames = useCallback(async (challengeId: string, blobs: Blob[]) => {
    setState("analyzing");
    const form = new FormData();
    form.append("challenge_id", challengeId);
    blobs.forEach((blob, i) => {
      form.append("frames", blob, `frame_${i}.jpg`);
    });

    try {
      await api.post("/face/liveness/verify/", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setState("passed");
      const faceFile = new File([blobs[blobs.length - 1]], "live_face.jpg", { type: "image/jpeg" });
      onVerified(challengeId, faceFile);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.code === "LIVENESS_FAILED") {
        setErrorMsg(data.message ?? "Liveness check failed. Please try again.");
        setState("failed");
      } else if (data?.code === "CHALLENGE_EXPIRED") {
        setErrorMsg("Challenge expired. Please refresh the page.");
        setState("error");
      } else {
        setErrorMsg(data?.message ?? "An error occurred during liveness verification.");
        setState("error");
      }
    }
  }, [onVerified]);

  const startCapture = useCallback(async (challengeId?: string) => {
    setState("capturing");
    framesRef.current = [];
    isBlinkingRef.current = false;

    // Resolve challenge ID: prefer the directly-passed argument, then ref, then state
    const resolvedChallengeId = challengeId || challengeIdRef.current || challenge?.challenge_id || "";

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
      videoRef.current.play();
    }

    const canvas = canvasRef.current!;
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d")!;

    // Rolling frame capture every 300ms
    captureIntervalRef.current = setInterval(() => {
      if (!videoRef.current) return;
      ctx.drawImage(videoRef.current, 0, 0, 320, 240);
      canvas.toBlob((blob) => {
        if (blob) {
          framesRef.current.push(blob);
          if (framesRef.current.length > 6) {
            framesRef.current.shift(); // Keep last 6 frames
          }
        }
      }, "image/jpeg", 0.85);
    }, 300);

    let lastVideoTime = -1;
    let blinkSubmitted = false;
    const detectBlink = () => {
      if (!videoRef.current || !globalFaceLandmarker || blinkSubmitted) return;

      const video = videoRef.current;
      if (video.currentTime !== lastVideoTime && video.readyState >= 2) {
        lastVideoTime = video.currentTime;
        const result = globalFaceLandmarker.detectForVideo(video, performance.now());
        
        if (result.faceLandmarks && result.faceLandmarks.length > 0) {
          const landmarks = result.faceLandmarks[0];
          const leftEAR = calculateEAR(landmarks, LEFT_EYE);
          const rightEAR = calculateEAR(landmarks, RIGHT_EYE);
          const ear = (leftEAR + rightEAR) / 2;

          if (ear < EAR_THRESHOLD) {
            isBlinkingRef.current = true;
          } else if (isBlinkingRef.current && ear > EAR_THRESHOLD) {
            // Blink complete!
            isBlinkingRef.current = false;
            if (framesRef.current.length >= 3 && resolvedChallengeId) {
              blinkSubmitted = true;
              stopWebcam();
              submitFrames(resolvedChallengeId, [...framesRef.current]);
              return;
            }
          }
        }
      }
      requestRef.current = requestAnimationFrame(detectBlink);
    };

    // Delay start of blink detection slightly to let webcam stabilize
    setTimeout(() => {
      requestRef.current = requestAnimationFrame(detectBlink);
    }, 1000);

  }, [challenge, submitFrames, stopWebcam]);

  return (
    <div className="rounded-xl bg-white/3 border border-white/8 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scan size={14} className="text-purple-400" />
          <span className="text-slate-300 text-sm font-medium">Liveness Detection (Mandatory)</span>
        </div>
        {state === "passed" && (
          <span className="text-emerald-400 text-xs flex items-center gap-1">
            <CheckCircle2 size={11} /> Verified
          </span>
        )}
      </div>

      {state === "initializing" && (
        <div className="flex flex-col items-center justify-center gap-2 py-6 text-slate-400 text-sm">
          <Loader2 className="animate-spin text-purple-400" size={24} />
          <p>Loading AI models...</p>
        </div>
      )}

      {state === "ready" && (
         <div className="flex flex-col items-center justify-center gap-2 py-6 text-slate-400 text-sm">
           <Loader2 className="animate-spin text-purple-400" size={24} />
           <p>Starting camera...</p>
         </div>
      )}

      {state === "capturing" && (
        <div className="space-y-3">
          <div className="bg-purple-950/40 border border-purple-800/40 rounded-lg p-3 text-center animate-pulse">
            <p className="text-purple-300 text-sm font-semibold flex items-center justify-center gap-2">
              <Eye size={16} /> Please blink your eyes to verify
            </p>
          </div>
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video ring-2 ring-purple-500/50">
            <video
              ref={videoRef}
              className="w-full h-full object-cover transform -scale-x-100" // mirror
              playsInline
              muted
            />
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {state === "analyzing" && (
        <div className="flex items-center justify-center gap-2 py-6 text-slate-400 text-sm">
          <Loader2 className="animate-spin text-purple-400" size={20} /> Securing verification...
        </div>
      )}

      {state === "passed" && (
        <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-lg p-4 text-center">
          <CheckCircle2 size={24} className="text-emerald-400 mx-auto mb-2" />
          <p className="text-emerald-300 text-sm font-medium">Liveness Verified</p>
          <p className="text-slate-500 text-xs mt-1">Your presence has been confirmed.</p>
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
            onClick={async () => {
              // Must get a NEW challenge — old one is marked used on backend
              setState("initializing");
              try {
                const res = await api.post<{ success: boolean; data: Challenge }>(
                  "/face/liveness/challenge/",
                  { session_code: sessionCode ?? "" },
                );
                const challengeData = res.data.data;
                challengeIdRef.current = challengeData.challenge_id;
                setChallenge(challengeData);
                startCapture(challengeData.challenge_id);
              } catch (err: any) {
                setErrorMsg(err?.response?.data?.message ?? "Failed to get a new challenge.");
                setState("error");
              }
            }}
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
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={13} /> Reload Page
          </Button>
        </div>
      )}
    </div>
  );
}
