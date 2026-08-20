/**
 * FaceAttend — Student Dashboard (Phase 14)
 *
 * Polished dashboard showing:
 *  - Greeting + overall attendance ring
 *  - Current class with Mark Attendance CTA
 *  - Upcoming classes today
 *  - Recent attendance records
 */
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen, Clock, MapPin, ChevronRight, TrendingUp,
  CheckCircle2, XCircle, Clock3, Zap, Calendar,
  GraduationCap, AlertCircle,
} from "lucide-react";
import { dashboardApi, type RecentRecord } from "@/features/dashboard/api";

// ---------------------------------------------------------------------------
// Attendance ring
// ---------------------------------------------------------------------------
function AttendanceRing({ percentage }: { percentage: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const filled = Math.min((percentage / 100) * circ, circ);
  const color =
    percentage >= 75 ? "#10b981" : percentage >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg className="-rotate-90 absolute inset-0" viewBox="0 0 120 120" width="144" height="144">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#1e293b" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="text-center z-10">
        <span className="text-3xl font-bold text-white">{Math.round(percentage)}%</span>
        <p className="text-xs text-slate-400 mt-0.5">Overall</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status icons for records
// ---------------------------------------------------------------------------
const RECORD_ICONS: Record<RecentRecord["status"], React.ReactNode> = {
  PRESENT: <CheckCircle2 size={14} className="text-emerald-400" />,
  ABSENT:  <XCircle size={14} className="text-red-400" />,
  LATE:    <Clock3 size={14} className="text-amber-400" />,
  EXCUSED: <CheckCircle2 size={14} className="text-blue-400" />,
};
const RECORD_COLORS: Record<RecentRecord["status"], string> = {
  PRESENT: "text-emerald-400",
  ABSENT:  "text-red-400",
  LATE:    "text-amber-400",
  EXCUSED: "text-blue-400",
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default function StudentDashboard() {
  const navigate = useNavigate();

  const { data: dashData, isLoading } = useQuery({
    queryKey: ["student-dashboard"],
    queryFn: dashboardApi.student,
    refetchInterval: 30_000,
  });

  const d = dashData?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-8">

      {/* ---- Header + ring ---- */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {d?.greeting ?? "Welcome back"} 👋
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {d?.attended_classes ?? 0} of {d?.total_classes ?? 0} classes attended
          </p>
        </div>
        <AttendanceRing percentage={d?.overall_percentage ?? 0} />
      </div>

      {/* ---- Current class ---- */}
      {d?.current_class ? (
        <div className="rounded-2xl bg-gradient-to-br from-indigo-900/60 to-violet-900/40 border border-indigo-700/40 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-emerald-400 text-xs font-semibold uppercase tracking-wide">
              Current Class
            </span>
          </div>

          <h2 className="text-xl font-bold text-white mb-1">
            {d.current_class.subject_name}
          </h2>
          <p className="text-slate-300 text-sm font-medium mb-3">
            {d.current_class.subject_code}
          </p>

          <div className="flex flex-wrap gap-4 text-sm text-slate-400 mb-5">
            <span className="flex items-center gap-1.5">
              <Clock size={13} /> {d.current_class.start_time} – {d.current_class.end_time}
            </span>
            {d.current_class.room_name && (
              <span className="flex items-center gap-1.5">
                <MapPin size={13} /> {d.current_class.room_name}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <GraduationCap size={13} /> {d.current_class.faculty_name}
            </span>
          </div>

          {d.current_class.session_id ? (
            d.current_class.already_marked ? (
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium bg-emerald-950/40 border border-emerald-800/30 rounded-lg px-4 py-2.5 w-fit">
                <CheckCircle2 size={15} /> Attendance marked ✓
              </div>
            ) : (
              <button
                id="mark-attendance-cta"
                onClick={() => navigate("/student/attendance")}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white
                           font-semibold text-sm px-5 py-2.5 rounded-xl transition-all
                           hover:scale-[1.02] active:scale-95 shadow-lg shadow-indigo-900/40"
              >
                <Zap size={15} /> Mark Attendance
                <ChevronRight size={14} />
              </button>
            )
          ) : (
            <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-950/30 border border-amber-800/20 rounded-lg px-3 py-2 w-fit">
              <AlertCircle size={13} /> No active session yet
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-white/3 border border-white/8 p-6 text-center">
          <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 text-sm font-medium">No class right now</p>
          <p className="text-slate-600 text-xs mt-1">Enjoy your break!</p>
        </div>
      )}

      {/* ---- Upcoming classes ---- */}
      {d?.upcoming_classes && d.upcoming_classes.length > 0 && (
        <div className="rounded-xl bg-white/3 border border-white/8 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8">
            <h3 className="text-slate-300 text-sm font-semibold uppercase tracking-wide">
              Upcoming Today
            </h3>
          </div>
          <div className="divide-y divide-white/5">
            {d.upcoming_classes.map((cls) => (
              <div
                key={cls.timetable_entry_id}
                className="flex items-center gap-4 px-4 py-3"
              >
                <div className="w-12 text-right shrink-0">
                  <span className="text-indigo-400 font-mono text-sm">{cls.start_time}</span>
                </div>
                <div className="w-px h-8 bg-white/10 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{cls.subject_name}</p>
                  {cls.room_name && (
                    <p className="text-slate-500 text-xs flex items-center gap-1 mt-0.5">
                      <MapPin size={10} /> {cls.room_name}
                    </p>
                  )}
                </div>
                <span className="text-slate-600 text-xs shrink-0">{cls.subject_code}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- Recent attendance ---- */}
      {d?.recent_records && d.recent_records.length > 0 && (
        <div className="rounded-xl bg-white/3 border border-white/8 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
            <h3 className="text-slate-300 text-sm font-semibold uppercase tracking-wide">
              Recent Attendance
            </h3>
            <Link
              to="/student/attendance"
              className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1 transition-colors"
            >
              View all <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {d.recent_records.map((rec, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <div className="shrink-0">{RECORD_ICONS[rec.status]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{rec.subject_name}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{rec.session_date}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-xs font-semibold ${RECORD_COLORS[rec.status]}`}>
                    {rec.status}
                  </span>
                  {rec.is_fully_verified && (
                    <p className="text-emerald-600 text-[10px] mt-0.5">Fully verified</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- Quick links ---- */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/student/attendance"
          className="flex items-center gap-3 bg-white/3 hover:bg-white/6 border border-white/8
                     rounded-xl p-4 transition-all group"
        >
          <div className="w-9 h-9 rounded-lg bg-indigo-600/20 flex items-center justify-center group-hover:bg-indigo-600/30 transition-colors">
            <BookOpen size={16} className="text-indigo-400" />
          </div>
          <div>
            <p className="text-white text-sm font-medium">My Attendance</p>
            <p className="text-slate-500 text-xs">Full history</p>
          </div>
        </Link>
        <Link
          to="/student/face-enroll"
          className="flex items-center gap-3 bg-white/3 hover:bg-white/6 border border-white/8
                     rounded-xl p-4 transition-all group"
        >
          <div className="w-9 h-9 rounded-lg bg-violet-600/20 flex items-center justify-center group-hover:bg-violet-600/30 transition-colors">
            <TrendingUp size={16} className="text-violet-400" />
          </div>
          <div>
            <p className="text-white text-sm font-medium">Face Enroll</p>
            <p className="text-slate-500 text-xs">Biometric setup</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
