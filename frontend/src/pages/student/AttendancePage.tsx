/**
 * FaceAttend — Student Attendance Page (Phase 7)
 *
 * Three states:
 *  1. IDLE      — Code entry form
 *  2. PREVIEW   — Session details + GPS capture + submit
 *  3. SUCCESS   — Confirmation with status
 *
 * History tab shows personal attendance records + per-subject summary.
 */
import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  QrCode, MapPin, CheckCircle2, XCircle, Clock3,
  RefreshCw, ChevronRight, BookOpen, AlertCircle,
  Users, Navigation, Loader2, ArrowLeft, Scan, Camera,
} from "lucide-react";

import {
  attendanceApi,
  type AttendanceSession,
  type AttendanceRecord,
  type MyAttendanceRecord,
  type SubjectSummary,
} from "@/features/attendance/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ---- Helpers ----
type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

const STATUS_STYLES: Record<AttendanceStatus, { color: string; icon: React.ReactNode; label: string }> = {
  PRESENT: { color: "text-emerald-400", icon: <CheckCircle2 size={14} />, label: "Present" },
  LATE:    { color: "text-amber-400",   icon: <Clock3 size={14} />,       label: "Late"    },
  ABSENT:  { color: "text-red-400",     icon: <XCircle size={14} />,      label: "Absent"  },
  EXCUSED: { color: "text-blue-400",    icon: <CheckCircle2 size={14} />, label: "Excused" },
};

function attendanceColor(pct: number): string {
  if (pct >= 75) return "text-emerald-400";
  if (pct >= 60) return "text-amber-400";
  return "text-red-400";
}

function progressBarColor(pct: number): string {
  if (pct >= 75) return "bg-emerald-500";
  if (pct >= 60) return "bg-amber-500";
  return "bg-red-500";
}

// ---- GPS Hook ----
type GpsState = "idle" | "fetching" | "granted" | "denied";

function useGPS() {
  const [gpsState, setGpsState] = useState<GpsState>("idle");
  const [coords, setCoords] = useState<{ latitude: string; longitude: string } | null>(null);

  const requestGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsState("denied");
      return;
    }
    setGpsState("fetching");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: String(pos.coords.latitude),
          longitude: String(pos.coords.longitude),
        });
        setGpsState("granted");
      },
      () => setGpsState("denied"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  return { gpsState, coords, requestGPS };
}

// ================================================================
// Step 1 — Code Entry
// ================================================================
function CodeEntryStep({ onFound }: { onFound: (session: AttendanceSession) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 6) {
      setError("Session code must be 6 characters.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const session = await attendanceApi.lookupByCode(code.trim().toUpperCase());
      onFound(session);
    } catch {
      setError("Invalid or expired session code. Check with your faculty.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto space-y-8 py-12">
      {/* Icon */}
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4">
          <QrCode size={28} className="text-slate-300" />
        </div>
        <h2 className="text-xl font-bold text-white">Mark Attendance</h2>
        <p className="text-slate-400 text-sm mt-1">Enter the 6-character code shared by your faculty</p>
      </div>

      <form onSubmit={handleLookup} className="space-y-4">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          placeholder="e.g. AB1C2D"
          className={`
            text-center text-3xl font-mono font-bold tracking-[0.3em] h-16
            bg-white/5 border-white/10 text-white placeholder:text-slate-700
            uppercase focus:ring-2 focus:ring-white/20
            ${error ? "border-red-600/50" : ""}
          `}
          autoFocus
          autoComplete="off"
        />

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-12 bg-white text-slate-900 hover:bg-white/90 font-semibold text-sm"
          disabled={loading || code.length < 6}
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <ChevronRight size={16} />}
          {loading ? "Looking up…" : "Find Session"}
        </Button>
      </form>
    </div>
  );
}

// ================================================================
// Step 2 — Session Preview + GPS + Submit
// ================================================================
function SessionPreviewStep({
  session,
  onSuccess,
  onBack,
}: {
  session: AttendanceSession;
  onSuccess: (record: AttendanceRecord) => void;
  onBack: () => void;
}) {
  const { gpsState, coords, requestGPS } = useGPS();
  const [submitError, setSubmitError] = useState("");
  const [geofenceError, setGeofenceError] = useState<{
    message: string;
    distance: number;
    radius: number;
    exceededBy: number;
  } | null>(null);
  const [faceMismatchError, setFaceMismatchError] = useState<{
    message: string;
    distance: number;
  } | null>(null);

  // Face image capture state (optional)
  const [faceImage, setFaceImage] = useState<File | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const faceFileRef = useRef<HTMLInputElement>(null);

  const handleFaceFile = useCallback((file: File) => {
    setFaceImage(file);
    setFacePreview(URL.createObjectURL(file));
    setFaceMismatchError(null);
  }, []);

  const roomHasGps = session.room_has_gps ?? false;
  const geofenceRadius = session.room_geofence_radius;
  const gpsRequired = roomHasGps;

  const submitMutation = useMutation({
    mutationFn: () =>
      attendanceApi.submitAttendance(session.id, coords ?? undefined, faceImage ?? undefined),
    onSuccess: (record) => onSuccess(record),
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data;
        if (data?.code === "GEOFENCE_VIOLATION") {
          setGeofenceError({
            message: data.message,
            distance: data.errors?.distance_meters ?? 0,
            radius: data.errors?.allowed_radius ?? 0,
            exceededBy: data.errors?.exceeded_by ?? 0,
          });
        } else if (data?.code === "FACE_MISMATCH") {
          setFaceMismatchError({
            message: data.message,
            distance: data.errors?.distance ?? 0,
          });
          setFaceImage(null);
          setFacePreview(null);
        } else {
          setSubmitError(data?.message ?? "Failed to submit attendance.");
        }
      }
    },
  });

  return (
    <div className="max-w-sm mx-auto space-y-6 py-8">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors">
        <ArrowLeft size={14} /> Back
      </button>

      {/* Session Card */}
      <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-emerald-400 text-xs font-semibold">Session Active</span>
        </div>

        <h3 className="text-white font-bold text-lg">{session.subject_name}</h3>
        <p className="text-emerald-300 font-mono text-sm mt-0.5">{session.subject_code}</p>

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <Users size={13} />
            <span>Section {session.section_name} · {session.semester_name}</span>
          </div>
          {session.room_name && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400">
                <MapPin size={13} />
                <span>{session.room_name}</span>
              </div>
              {roomHasGps && geofenceRadius && (
                <span className="text-xs bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                  📍 {geofenceRadius}m radius
                </span>
              )}
            </div>
          )}
          {session.valid_until && (
            <div className="flex items-center gap-2 text-slate-400">
              <Clock3 size={13} />
              <span>
                Window closes at{" "}
                {new Date(session.valid_until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* GPS Section */}
      <div className="rounded-xl bg-white/3 border border-white/8 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Navigation size={14} className="text-slate-400" />
            <span className="text-slate-300 text-sm font-medium">
              Location Verification
              {gpsRequired && <span className="text-amber-400 text-xs ml-1">(Recommended)</span>}
            </span>
          </div>
          {gpsState === "granted" && (
            <span className="text-emerald-400 text-xs flex items-center gap-1">
              <CheckCircle2 size={11} /> Captured
            </span>
          )}
          {gpsState === "denied" && (
            <span className="text-amber-400 text-xs">Unavailable</span>
          )}
        </div>

        {gpsState === "idle" && (
          <Button
            size="sm"
            variant="outline"
            className="w-full border-white/10 text-slate-300 hover:bg-white/5"
            onClick={requestGPS}
          >
            <Navigation size={13} /> Share My Location
          </Button>
        )}
        {gpsState === "fetching" && (
          <div className="flex items-center justify-center gap-2 py-2 text-slate-400 text-sm">
            <Loader2 className="animate-spin" size={14} /> Fetching location…
          </div>
        )}
        {gpsState === "granted" && coords && (
          <p className="text-slate-500 text-xs font-mono">
            {parseFloat(coords.latitude).toFixed(5)}, {parseFloat(coords.longitude).toFixed(5)}
          </p>
        )}
        {gpsState === "denied" && (
          <p className="text-amber-400/70 text-xs">
            Location access denied.{" "}
            {gpsRequired
              ? "GPS verification will be skipped, but this room enforces geofencing — submitting may be rejected."
              : "Attendance will be marked without GPS verification."}
          </p>
        )}
      </div>

      {/* Face Verification Section (Phase 10) */}
      <div className="rounded-xl bg-white/3 border border-white/8 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Scan size={14} className="text-slate-400" />
          <span className="text-slate-300 text-sm font-medium">Face Verification</span>
          <span className="text-slate-600 text-xs">(Optional)</span>
          {faceImage && (
            <span className="ml-auto text-emerald-400 text-xs flex items-center gap-1">
              <CheckCircle2 size={11} /> Ready
            </span>
          )}
        </div>

        {facePreview ? (
          <div className="flex items-center gap-3">
            <img
              src={facePreview}
              className="w-14 h-14 rounded-lg object-cover border border-white/10"
              alt="Face capture"
            />
            <div className="flex-1">
              <p className="text-slate-300 text-xs">Face captured</p>
              <button
                className="text-slate-500 hover:text-white text-xs mt-0.5 transition-colors"
                onClick={() => { setFaceImage(null); setFacePreview(null); }}
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-slate-500 text-xs">
              Take a selfie to verify your identity with face recognition.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm" variant="outline"
                className="flex-1 border-white/10 text-slate-300 hover:bg-white/5"
                onClick={() => faceFileRef.current?.click()}
              >
                <Camera size={13} /> Upload Photo
              </Button>
            </div>
            <input
              ref={faceFileRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFaceFile(f);
              }}
            />
          </div>
        )}
      </div>

      {/* Face mismatch error */}
      {faceMismatchError && (
        <div className="rounded-lg bg-red-950/40 border border-red-800/40 p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
            <AlertCircle size={14} /> Face Verification Failed
          </div>
          <p className="text-red-300 text-xs">{faceMismatchError.message}</p>
          <p className="text-slate-500 text-xs">
            Please retake your photo with better lighting and try again.
          </p>
        </div>
      )}

      {/* Geofence violation error */}
      {geofenceError && (
        <div className="rounded-lg bg-red-950/40 border border-red-800/40 p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
            <AlertCircle size={14} /> You're outside the classroom
          </div>
          <p className="text-red-300 text-xs">{geofenceError.message}</p>
          <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
            <span>📍 You: {geofenceError.distance.toFixed(0)}m away</span>
            <span>✅ Allowed: {geofenceError.radius}m</span>
            <span>⚠️ Over by: {geofenceError.exceededBy.toFixed(0)}m</span>
          </div>
          <p className="text-slate-600 text-xs">Move closer to {session.room_name ?? "the classroom"} and try again.</p>
        </div>
      )}

      {/* General submit error */}
      {submitError && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">
          <AlertCircle size={14} />
          {submitError}
        </div>
      )}

      <Button
        className="w-full h-12 bg-white text-slate-900 hover:bg-white/90 font-semibold"
        onClick={() => submitMutation.mutate()}
        disabled={submitMutation.isPending || gpsState === "fetching"}
      >
        {submitMutation.isPending ? (
          <><Loader2 className="animate-spin" size={16} /> Submitting…</>
        ) : (
          <><CheckCircle2 size={16} /> Submit Attendance</>
        )}
      </Button>

      <p className="text-center text-slate-600 text-xs">
        Location and face sharing are optional but recommended for verification.
      </p>
    </div>
  );
}

// ================================================================
// Step 3 — Success Confirmation
// ================================================================
function SuccessStep({ record, onDone }: { record: AttendanceRecord; onDone: () => void }) {
  const isLate = record.status === "LATE";
  return (
    <div className="max-w-sm mx-auto text-center py-12 space-y-6">
      <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto
        ${isLate ? "bg-amber-950/60 border-2 border-amber-700/50" : "bg-emerald-950/60 border-2 border-emerald-700/50"}`}>
        {isLate
          ? <Clock3 size={32} className="text-amber-400" />
          : <CheckCircle2 size={32} className="text-emerald-400" />
        }
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white">
          {isLate ? "Marked Late" : "Attendance Recorded!"}
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          {isLate
            ? "You were marked late as you submitted after the 15-minute grace period."
            : "Your attendance has been successfully submitted."}
        </p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Status</span>
          <span className={isLate ? "text-amber-400 font-medium" : "text-emerald-400 font-medium"}>
            {record.status}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Verification</span>
          <span className="text-slate-300">{record.verification_method}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">GPS</span>
          <span className="text-slate-300">{record.gps_verified ? "✅ Verified" : "Not captured"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Face</span>
          <span className="text-slate-300">{record.face_verified ? "✅ Verified" : "Not verified"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Time</span>
          <span className="text-slate-300">
            {new Date(record.marked_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>

      <Button
        className="w-full bg-white text-slate-900 hover:bg-white/90"
        onClick={onDone}
      >
        Done
      </Button>
    </div>
  );
}

// ================================================================
// History Tab
// ================================================================
function AttendanceHistory() {
  const [tab, setTab] = useState<"records" | "summary">("summary");

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["my-attendance-summary"],
    queryFn: () => attendanceApi.mySummary(),
  });

  const { data: recordsData, isLoading: recordsLoading } = useQuery({
    queryKey: ["my-attendance-records"],
    queryFn: () => attendanceApi.myList({ page_size: 50 }),
    enabled: tab === "records",
  });

  return (
    <div className="space-y-5">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-white/5 border border-white/10 rounded-lg p-1 w-fit">
        {(["summary", "records"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded text-sm transition-colors capitalize ${
              tab === t ? "bg-white/15 text-white font-medium" : "text-slate-400 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <div className="space-y-3">
          {summaryLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="animate-spin text-slate-500" size={18} />
            </div>
          ) : !summaryData?.length ? (
            <div className="flex flex-col items-center justify-center py-12 bg-white/3 border border-white/8 rounded-xl">
              <BookOpen className="w-10 h-10 text-slate-700 mb-3" />
              <p className="text-slate-400 text-sm">No attendance records yet</p>
            </div>
          ) : (
            <>
              {/* Overall stats */}
              {(() => {
                const total = summaryData.reduce((s, x) => s + x.total, 0);
                const attended = summaryData.reduce((s, x) => s + x.present + x.late, 0);
                const overall = total ? Math.round(attended / total * 100) : 0;
                return (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Overall Attendance</p>
                    <div className="flex items-end justify-between">
                      <span className={`text-4xl font-bold ${attendanceColor(overall)}`}>{overall}%</span>
                      <span className="text-slate-500 text-sm">{attended}/{total} classes</span>
                    </div>
                    <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${progressBarColor(overall)}`}
                        style={{ width: `${overall}%` }}
                      />
                    </div>
                    {overall < 75 && (
                      <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
                        <AlertCircle size={11} />
                        Below 75% threshold — contact your advisor
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Per-subject cards */}
              {summaryData.map((s) => (
                <SubjectCard key={s.subject_id} summary={s} />
              ))}
            </>
          )}
        </div>
      )}

      {tab === "records" && (
        <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
          {recordsLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="animate-spin text-slate-500" size={18} />
            </div>
          ) : !recordsData?.results.length ? (
            <div className="flex flex-col items-center justify-center py-12">
              <BookOpen className="w-8 h-8 text-slate-700 mb-2" />
              <p className="text-slate-400 text-sm">No records found</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {recordsData.results.map((r) => (
                <RecordRow key={r.id} record={r} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubjectCard({ summary }: { summary: SubjectSummary }) {
  const pct = summary.percentage;
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="font-mono text-xs bg-white/10 px-2 py-0.5 rounded text-slate-300">
            {summary.subject_code}
          </span>
          <p className="text-white font-medium text-sm mt-1">{summary.subject_name}</p>
        </div>
        <span className={`text-2xl font-bold ${attendanceColor(pct)}`}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full ${progressBarColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="text-emerald-400">{summary.present + summary.late} attended</span>
        <span>·</span>
        <span className="text-red-400">{summary.absent} absent</span>
        {summary.excused > 0 && <><span>·</span><span className="text-blue-400">{summary.excused} excused</span></>}
        <span className="ml-auto">{summary.total} total</span>
      </div>
    </div>
  );
}

function RecordRow({ record }: { record: MyAttendanceRecord }) {
  const s = STATUS_STYLES[record.status as AttendanceStatus] ?? STATUS_STYLES.ABSENT;
  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-white/3 transition-colors">
      <div className={`flex-shrink-0 ${s.color}`}>{s.icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-white text-sm font-medium truncate">{record.subject_name}</p>
        <p className="text-slate-500 text-xs">{record.faculty_name} · {record.session_date}</p>
      </div>
      <div className="text-right">
        <Badge
          variant={record.status === "PRESENT" ? "success" : record.status === "LATE" ? "warning" : "secondary"}
          className="text-[11px] h-5"
        >
          {record.status}
        </Badge>
        {record.gps_verified && <p className="text-slate-600 text-[10px] mt-0.5">📍 GPS</p>}
      </div>
    </div>
  );
}

// ================================================================
// Main Page
// ================================================================
type PageTab = "mark" | "history";
type MarkStep = "code" | "preview" | "success";

export default function StudentAttendancePage() {
  const [activeTab, setActiveTab] = useState<PageTab>("mark");
  const [step, setStep] = useState<MarkStep>("code");
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const queryClient = useQueryClient();

  const handleFound = (s: AttendanceSession) => {
    setSession(s);
    setStep("preview");
  };

  const handleSuccess = (r: AttendanceRecord) => {
    setRecord(r);
    setStep("success");
    queryClient.invalidateQueries({ queryKey: ["my-attendance-summary"] });
    queryClient.invalidateQueries({ queryKey: ["my-attendance-records"] });
  };

  const handleDone = () => {
    setStep("code");
    setSession(null);
    setRecord(null);
    setActiveTab("history");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Attendance</h1>
        <p className="text-slate-400 text-sm mt-1">
          Mark your attendance or view your records
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
        {(["mark", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              activeTab === t
                ? "bg-white/15 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t === "mark" ? "📋 Mark Attendance" : "📊 My History"}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "mark" && (
        <>
          {step === "code" && <CodeEntryStep onFound={handleFound} />}
          {step === "preview" && session && (
            <SessionPreviewStep
              session={session}
              onSuccess={handleSuccess}
              onBack={() => setStep("code")}
            />
          )}
          {step === "success" && record && (
            <SuccessStep record={record} onDone={handleDone} />
          )}
        </>
      )}

      {activeTab === "history" && <AttendanceHistory />}
    </div>
  );
}
