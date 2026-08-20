/**
 * LiveAttendancePanel — Phase 13
 *
 * Real-time attendance dashboard panel for faculty.
 * Shows animated present/late/absent counts, attendance percentage ring,
 * connection status indicator, and a live feed of the last 5 students.
 *
 * Props:
 *   sessionId  – UUID of the active AttendanceSession
 */
import { useSessionSocket, LastStudent } from '@/hooks/useSessionSocket';
import { useEffect, useRef, useState } from 'react';

interface LiveAttendancePanelProps {
  sessionId: string;
}

// ---------------------------------------------------------------------------
// Animated counter
// ---------------------------------------------------------------------------
function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) return;
    const diff = value - prev.current;
    const steps = Math.min(Math.abs(diff), 12);
    let step = 0;
    const id = setInterval(() => {
      step++;
      setDisplay(Math.round(prev.current + (diff * step) / steps));
      if (step >= steps) {
        clearInterval(id);
        prev.current = value;
      }
    }, 30);
    return () => clearInterval(id);
  }, [value]);

  return <>{display}</>;
}

// ---------------------------------------------------------------------------
// SVG ring chart
// ---------------------------------------------------------------------------
function AttendanceRing({
  percentage,
  present,
  late,
  total,
}: {
  percentage: number;
  present: number;
  late: number;
  total: number;
}) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const filled = (percentage / 100) * circ;

  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100" width="128" height="128">
        {/* Track */}
        <circle cx="50" cy="50" r={r} fill="none" stroke="#1e293b" strokeWidth="10" />
        {/* Fill */}
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={percentage >= 75 ? '#10b981' : percentage >= 50 ? '#f59e0b' : '#ef4444'}
          strokeWidth="10"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="text-center z-10">
        <span className="text-2xl font-bold text-white">{Math.round(percentage)}%</span>
        <p className="text-xs text-slate-400 mt-0.5">
          {present + late}/{total}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status dot
// ---------------------------------------------------------------------------
const STATUS_CONFIG = {
  idle: { color: 'bg-slate-500', label: 'Idle' },
  connecting: { color: 'bg-amber-400 animate-pulse', label: 'Connecting…' },
  connected: { color: 'bg-emerald-400', label: 'Live' },
  disconnected: { color: 'bg-slate-500', label: 'Reconnecting…' },
  error: { color: 'bg-red-500', label: 'Error' },
} as const;

// ---------------------------------------------------------------------------
// Student feed entry
// ---------------------------------------------------------------------------
function StudentFeedEntry({ student }: { student: LastStudent }) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/5 border border-white/5
                    animate-in slide-in-from-top-2 duration-300">
      <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center shrink-0">
        <span className="text-indigo-300 text-xs font-bold">
          {student.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{student.name}</p>
        <p className="text-xs text-slate-400">{student.student_id}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            student.status === 'PRESENT'
              ? 'bg-emerald-900/50 text-emerald-400'
              : student.status === 'LATE'
              ? 'bg-amber-900/50 text-amber-400'
              : 'bg-red-900/50 text-red-400'
          }`}
        >
          {student.status}
        </span>
        <div className="flex gap-1">
          {student.face_verified && (
            <span title="Face verified" className="text-xs">🪪</span>
          )}
          {student.liveness_verified && (
            <span title="Liveness verified" className="text-xs">👁️</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function LiveAttendancePanel({ sessionId }: LiveAttendancePanelProps) {
  const {
    present_count,
    late_count,
    absent_count,
    total_students,
    percentage,
    last_student,
    status,
    reconnect,
  } = useSessionSocket(sessionId);

  // Keep a rolling feed of the last 5 students
  const [feed, setFeed] = useState<LastStudent[]>([]);

  useEffect(() => {
    if (!last_student) return;
    setFeed((prev) => {
      const already = prev.some(
        (s) => s.student_id === last_student.student_id && s.marked_at === last_student.marked_at
      );
      if (already) return prev;
      return [last_student, ...prev].slice(0, 5);
    });
  }, [last_student]);

  const statusCfg = STATUS_CONFIG[status];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
          Live Attendance
        </h3>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusCfg.color}`} />
          <span className="text-xs text-slate-400">{statusCfg.label}</span>
          {(status === 'disconnected' || status === 'error') && (
            <button
              onClick={reconnect}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline ml-1"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Ring + count cards */}
      <div className="flex items-center gap-4">
        <AttendanceRing
          percentage={percentage}
          present={present_count}
          late={late_count}
          total={total_students}
        />

        <div className="flex-1 grid grid-cols-3 gap-2">
          {/* Present */}
          <div className="bg-emerald-950/40 border border-emerald-800/30 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">
              <AnimatedNumber value={present_count} />
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">Present</p>
          </div>
          {/* Late */}
          <div className="bg-amber-950/40 border border-amber-800/30 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-amber-400">
              <AnimatedNumber value={late_count} />
            </p>
            <p className="text-xs text-amber-600 mt-0.5">Late</p>
          </div>
          {/* Absent */}
          <div className="bg-red-950/40 border border-red-800/30 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-red-400">
              <AnimatedNumber value={absent_count} />
            </p>
            <p className="text-xs text-red-600 mt-0.5">Not marked</p>
          </div>
        </div>
      </div>

      {/* Live student feed */}
      {feed.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
            Recent Activity
          </p>
          {feed.map((s, i) => (
            <StudentFeedEntry key={`${s.student_id}-${s.marked_at}-${i}`} student={s} />
          ))}
        </div>
      )}

      {feed.length === 0 && status === 'connected' && (
        <div className="text-center py-6 text-slate-500 text-sm">
          Waiting for students to mark attendance…
        </div>
      )}
    </div>
  );
}
