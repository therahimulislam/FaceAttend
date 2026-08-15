/**
 * FaceAttend — Faculty Attendance Sessions Page (Phase 6)
 *
 * Shows today's scheduled classes and allows faculty to:
 *  - Create ad-hoc sessions
 *  - Start a session (generates a live session code)
 *  - View active session's attendance roll in real-time
 *  - Manually mark students as present/absent/late/excused
 *  - End or cancel a session
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Play, Square, X, Users, Clock, MapPin,
  CheckCircle2, XCircle, Clock3, BookOpen,
  RefreshCw, Plus, Loader2, Copy, Check, AlertCircle,
  ChevronRight, Calendar,
} from "lucide-react";

import {
  attendanceApi,
  type AttendanceSession,
  type AttendanceRecord,
  type AttendanceStatus,
} from "@/features/attendance/api";
import { timetableApi } from "@/features/timetable/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ---- Status helpers ----
const SESSION_STATUS_STYLES: Record<AttendanceSession["status"], string> = {
  SCHEDULED: "text-slate-400 bg-slate-800/60 border-slate-700/40",
  ACTIVE:    "text-emerald-400 bg-emerald-950/60 border-emerald-700/40",
  COMPLETED: "text-blue-400 bg-blue-950/60 border-blue-700/40",
  CANCELLED: "text-red-400 bg-red-950/60 border-red-700/40",
};

const RECORD_STATUS_ICONS: Record<AttendanceStatus, React.ReactNode> = {
  PRESENT: <CheckCircle2 size={13} className="text-emerald-400" />,
  ABSENT:  <XCircle size={13} className="text-red-400" />,
  LATE:    <Clock3 size={13} className="text-amber-400" />,
  EXCUSED: <CheckCircle2 size={13} className="text-blue-400" />,
};

// ---- Session Code Display ----
function SessionCodeBadge({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl px-4 py-3 transition-colors group"
    >
      <span className="font-mono text-3xl font-bold text-white tracking-[0.25em]">{code}</span>
      <span className="text-slate-400 group-hover:text-white transition-colors">
        {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
      </span>
    </button>
  );
}

// ---- Manual Mark Modal ----
const markSchema = z.object({
  status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
  rejection_reason: z.string().optional().default(""),
});

function ManualMarkModal({
  open,
  onClose,
  session,
  record,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  session: AttendanceSession;
  record?: AttendanceRecord;
  onSaved: () => void;
}) {
  const [studentId, setStudentId] = useState(record?.student ?? "");
  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<z.infer<typeof markSchema>>({
    resolver: zodResolver(markSchema),
    defaultValues: { status: (record?.status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED") ?? "PRESENT", rejection_reason: "" },
  });

  const onSubmit = async (data: z.infer<typeof markSchema>) => {
    await attendanceApi.manualMark(
      session.id,
      studentId,
      data.status as AttendanceStatus,
      data.rejection_reason,
    );
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Manual Attendance Mark</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Student UUID</Label>
            <Input
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="Student ID…"
              className="bg-white/5 border-white/10 text-white h-10 font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Status</Label>
            <Select value={watch("status")} onValueChange={(v) => setValue("status", v as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED")}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRESENT">✅ Present</SelectItem>
                <SelectItem value="LATE">⏰ Late</SelectItem>
                <SelectItem value="ABSENT">❌ Absent</SelectItem>
                <SelectItem value="EXCUSED">💼 Excused</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {watch("status") !== "PRESENT" && (
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Reason (optional)</Label>
              <Input
                placeholder="Reason for absence or excuse…"
                className="bg-white/5 border-white/10 text-white h-10 placeholder:text-slate-600"
                {...register("rejection_reason")}
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm"
              className="border-white/10 text-slate-300 hover:bg-white/5" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm"
              className="bg-white text-slate-900 hover:bg-white/90" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" size={14} />}
              Mark Attendance
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Active Session Panel ----
function ActiveSessionPanel({
  session,
  onEnd,
  onCancel,
}: {
  session: AttendanceSession;
  onEnd: () => void;
  onCancel: () => void;
}) {
  const [markOpen, setMarkOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: records, refetch } = useQuery({
    queryKey: ["session-records", session.id],
    queryFn: () => attendanceApi.getRecords(session.id),
    refetchInterval: 5000, // Poll every 5s during active session
  });

  const allRecords = records?.results ?? [];
  const presentCount = allRecords.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;

  return (
    <div className="space-y-4">
      {/* Live Banner */}
      <div className="rounded-xl bg-emerald-950/40 border border-emerald-700/40 p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-emerald-400 font-semibold text-sm">Session Active</span>
            </div>
            <p className="text-white font-bold text-lg">
              {session.subject_code} — {session.subject_name}
            </p>
            <p className="text-slate-400 text-sm">
              Sec {session.section_name} · {session.room_name ?? "No room"} ·{" "}
              {presentCount}/{session.total_students || "—"} marked
            </p>
          </div>

          {/* Session Code */}
          {session.session_code && (
            <div className="text-center">
              <p className="text-slate-400 text-xs mb-2">Share code with students</p>
              <SessionCodeBadge code={session.session_code} />
            </div>
          )}
        </div>

        {/* Valid until */}
        {session.valid_until && (
          <div className="mt-4 flex items-center gap-2 text-slate-400 text-xs">
            <Clock size={11} />
            Window closes at {new Date(session.valid_until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" variant="outline"
            className="border-white/10 text-slate-300 hover:bg-white/5"
            onClick={() => setMarkOpen(true)}>
            <Plus size={13} /> Manual Mark
          </Button>
          <Button size="sm" variant="outline"
            className="border-white/10 text-slate-300 hover:bg-white/5"
            onClick={() => refetch()}>
            <RefreshCw size={13} />
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm"
              className="bg-blue-600 hover:bg-blue-500 text-white border-0"
              onClick={onEnd}>
              <Square size={12} /> End Session
            </Button>
            <Button size="sm" variant="outline"
              className="border-red-800/50 text-red-400 hover:bg-red-950/40"
              onClick={onCancel}>
              <X size={13} /> Cancel
            </Button>
          </div>
        </div>
      </div>

      {/* Attendance Roll */}
      <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
          <h3 className="text-slate-300 font-semibold text-sm">Attendance Roll</h3>
          <span className="text-slate-500 text-xs">{allRecords.length} records</span>
        </div>
        {allRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <Users className="w-8 h-8 text-slate-700 mb-2" />
            <p className="text-slate-500 text-sm">Waiting for students…</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {allRecords.map((record) => (
              <div key={record.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors">
                <div className="flex items-center gap-3">
                  {RECORD_STATUS_ICONS[record.status]}
                  <div>
                    <p className="text-white text-sm font-medium">{record.student_name}</p>
                    <p className="text-slate-500 text-xs">{record.student_id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <Badge
                      variant={record.status === "PRESENT" ? "success" : record.status === "LATE" ? "warning" : "secondary"}
                      className="text-[11px]"
                    >
                      {record.status}
                    </Badge>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      {record.verification_method} · {new Date(record.marked_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {markOpen && (
        <ManualMarkModal
          open={true}
          onClose={() => setMarkOpen(false)}
          session={session}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["session-records", session.id] });
            queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
          }}
        />
      )}
    </div>
  );
}

// ---- Session Card ----
function SessionCard({
  session,
  onStart,
  onEnd,
  onCancel,
  onSelect,
}: {
  session: AttendanceSession;
  onStart: (id: string) => void;
  onEnd: (id: string) => void;
  onCancel: (id: string) => void;
  onSelect: (s: AttendanceSession) => void;
}) {
  return (
    <div
      className={`border rounded-xl p-4 cursor-pointer transition-all ${SESSION_STATUS_STYLES[session.status]}`}
      onClick={() => onSelect(session)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs bg-white/10 px-2 py-0.5 rounded text-slate-300">
              {session.subject_code}
            </span>
            <Badge
              variant={session.status === "ACTIVE" ? "success" : session.status === "COMPLETED" ? "secondary" : "outline"}
              className="text-[11px] h-5"
            >
              {session.status}
            </Badge>
          </div>
          <p className="text-white font-semibold text-sm">{session.subject_name}</p>
          <p className="text-slate-400 text-xs mt-0.5">Sec {session.section_name}</p>
        </div>
        <ChevronRight size={15} className="text-slate-500 mt-1 flex-shrink-0" />
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        {session.room_name && (
          <span className="flex items-center gap-1"><MapPin size={10} />{session.room_name}</span>
        )}
        {session.valid_from && (
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {new Date(session.valid_from).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Users size={10} />
          {session.attendance_count}/{session.total_students || "—"}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {session.status === "SCHEDULED" && (
          <Button size="sm"
            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white border-0"
            onClick={() => onStart(session.id)}>
            <Play size={11} /> Start
          </Button>
        )}
        {session.status === "ACTIVE" && (
          <Button size="sm"
            className="h-7 text-xs bg-blue-600 hover:bg-blue-500 text-white border-0"
            onClick={() => onEnd(session.id)}>
            <Square size={11} /> End
          </Button>
        )}
        {(session.status === "SCHEDULED" || session.status === "ACTIVE") && (
          <Button size="sm" variant="outline"
            className="h-7 text-xs border-red-800/50 text-red-400 hover:bg-red-950/40"
            onClick={() => onCancel(session.id)}>
            <X size={11} /> Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

// ---- Main Page ----
export default function FacultyAttendancePage() {
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["attendance-today"],
    queryFn: () => attendanceApi.today(),
    refetchInterval: 10000,
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => attendanceApi.startSession(id, 60),
    onSuccess: (updatedSession) => {
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      setActiveSession(updatedSession);
    },
  });

  const endMutation = useMutation({
    mutationFn: (id: string) => attendanceApi.endSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      setActiveSession(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => attendanceApi.cancelSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      setActiveSession(null);
    },
  });

  const sessions = data?.results ?? [];
  const active = sessions.find((s) => s.status === "ACTIVE");
  const scheduled = sessions.filter((s) => s.status === "SCHEDULED");
  const completed = sessions.filter((s) => s.status === "COMPLETED" || s.status === "CANCELLED");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Attendance</h1>
          <p className="text-slate-400 text-sm mt-1">
            {new Date().toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"
            className="border-white/10 text-slate-300 hover:bg-white/5"
            onClick={() => refetch()}>
            <RefreshCw size={13} />
          </Button>
          <Button size="sm"
            className="bg-white text-slate-900 hover:bg-white/90"
            onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> New Session
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="animate-spin text-slate-500" size={20} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: session list */}
          <div className="lg:col-span-1 space-y-4">
            {/* Active */}
            {active && (
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Active Now</p>
                <SessionCard
                  session={active}
                  onStart={(id) => startMutation.mutate(id)}
                  onEnd={(id) => endMutation.mutate(id)}
                  onCancel={(id) => cancelMutation.mutate(id)}
                  onSelect={setActiveSession}
                />
              </div>
            )}

            {/* Scheduled */}
            {scheduled.length > 0 && (
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Scheduled Today</p>
                <div className="space-y-2">
                  {scheduled.map((s) => (
                    <SessionCard key={s.id} session={s}
                      onStart={(id) => startMutation.mutate(id)}
                      onEnd={(id) => endMutation.mutate(id)}
                      onCancel={(id) => cancelMutation.mutate(id)}
                      onSelect={setActiveSession}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {sessions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 bg-white/3 border border-white/8 rounded-xl">
                <Calendar className="w-10 h-10 text-slate-700 mb-3" />
                <p className="text-slate-400 text-sm">No sessions today</p>
                <button
                  className="mt-3 text-sm text-white underline underline-offset-4"
                  onClick={() => setCreateOpen(true)}
                >
                  Create a session
                </button>
              </div>
            )}

            {/* Completed today */}
            {completed.length > 0 && (
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Completed Today</p>
                <div className="space-y-2">
                  {completed.map((s) => (
                    <SessionCard key={s.id} session={s}
                      onStart={() => {}}
                      onEnd={() => {}}
                      onCancel={() => {}}
                      onSelect={setActiveSession}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Active session panel or placeholder */}
          <div className="lg:col-span-2">
            {activeSession ? (
              <ActiveSessionPanel
                session={activeSession}
                onEnd={() => endMutation.mutate(activeSession.id)}
                onCancel={() => cancelMutation.mutate(activeSession.id)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-64 bg-white/3 border border-white/8 rounded-xl">
                <BookOpen className="w-10 h-10 text-slate-700 mb-3" />
                <p className="text-slate-400 text-sm">Select a session to manage</p>
                <p className="text-slate-600 text-xs mt-1">Start a scheduled class or create a new session</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
