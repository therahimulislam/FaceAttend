/**
 * FaceAttend — Faculty Dashboard (Phase 14)
 *
 * Shows:
 *  - Greeting + weekly session summary
 *  - Active session card (if any) with live attendance count
 *  - Today's full schedule with status badges and attendance mini-ring
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ChevronRight, Clock, MapPin, Users, Activity,
  BookOpen, CheckCircle2, Calendar, BarChart2,
} from "lucide-react";
import { dashboardApi, type ScheduleSlot } from "@/features/dashboard/api";

// ---------------------------------------------------------------------------
// Mini attendance ring (inline)
// ---------------------------------------------------------------------------
function MiniRing({ pct }: { pct: number }) {
  const r = 16;
  const circ = 2 * Math.PI * r;
  const filled = (Math.min(pct, 100) / 100) * circ;
  const color = pct >= 75 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative flex items-center justify-center w-10 h-10">
      <svg className="-rotate-90 absolute inset-0" viewBox="0 0 40 40" width="40" height="40">
        <circle cx="20" cy="20" r={r} fill="none" stroke="#1e293b" strokeWidth="5" />
        <circle cx="20" cy="20" r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <span className="text-[9px] font-bold text-white z-10">{Math.round(pct)}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session status badge
// ---------------------------------------------------------------------------
const STATUS_STYLES: Record<string, string> = {
  ACTIVE:    "bg-emerald-950/60 text-emerald-400 border-emerald-700/40",
  SCHEDULED: "bg-slate-800/60 text-slate-400 border-slate-700/40",
  COMPLETED: "bg-blue-950/60 text-blue-400 border-blue-700/40",
  CANCELLED: "bg-red-950/60 text-red-400 border-red-700/40",
};

function SessionBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-slate-600">—</span>;
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[status] ?? STATUS_STYLES.SCHEDULED}`}>
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Schedule slot row
// ---------------------------------------------------------------------------
function ScheduleRow({ slot }: { slot: ScheduleSlot }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 hover:bg-white/3 transition-colors">
      {/* Time */}
      <div className="w-12 text-right shrink-0">
        <span className="text-indigo-400 font-mono text-sm">{slot.start_time}</span>
      </div>
      <div className="w-px h-10 bg-white/10 shrink-0" />

      {/* Subject info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-white text-sm font-medium">{slot.subject_name}</p>
          <SessionBadge status={slot.session_status} />
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-slate-500 text-xs">
          <span className="flex items-center gap-1"><Users size={10} /> {slot.section_name}</span>
          {slot.room_name && <span className="flex items-center gap-1"><MapPin size={10} /> {slot.room_name}</span>}
        </div>
      </div>

      {/* Attendance mini */}
      {slot.session_id ? (
        <div className="flex items-center gap-2 shrink-0">
          <MiniRing pct={slot.attendance_percentage} />
          <span className="text-xs text-slate-400">
            {slot.present_count}/{slot.total_students}
          </span>
        </div>
      ) : (
        <span className="text-slate-700 text-xs shrink-0">No session</span>
      )}

      {/* Chevron for active → attendance page */}
      {slot.session_status === "ACTIVE" && (
        <Link to="/faculty/attendance" className="text-indigo-400 hover:text-indigo-300">
          <ChevronRight size={16} />
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default function FacultyDashboard() {
  const { data: dashData, isLoading } = useQuery({
    queryKey: ["faculty-dashboard"],
    queryFn: dashboardApi.faculty,
    refetchInterval: 20_000,
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
    <div className="space-y-6 max-w-3xl mx-auto pb-8">

      {/* ---- Header ---- */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {d?.greeting ?? "Welcome back"} 👋
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Here's your teaching summary for today.
          </p>
        </div>
        {/* Week summary pills */}
        <div className="flex gap-3">
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-center">
            <p className="text-xl font-bold text-white">{d?.this_week_sessions ?? 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">Sessions this week</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-center">
            <p className="text-xl font-bold text-indigo-400">{d?.this_week_avg_attendance ?? 0}%</p>
            <p className="text-xs text-slate-500 mt-0.5">Avg attendance</p>
          </div>
        </div>
      </div>

      {/* ---- Active session card ---- */}
      {d?.active_session ? (
        <div className="rounded-2xl bg-gradient-to-br from-emerald-900/50 to-teal-900/30 border border-emerald-700/40 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-emerald-400 text-xs font-semibold uppercase tracking-wide">
              Active Session
            </span>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">
                {d.active_session.subject_name}
              </h2>
              <div className="flex flex-wrap gap-3 text-sm text-slate-400 mt-2">
                <span className="flex items-center gap-1.5">
                  <Users size={13} /> {d.active_session.section_name}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={13} /> {d.active_session.start_time} – {d.active_session.end_time}
                </span>
                {d.active_session.room_name && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={13} /> {d.active_session.room_name}
                  </span>
                )}
              </div>
            </div>

            {/* Live count */}
            <div className="bg-black/20 rounded-xl p-3 text-center shrink-0">
              <p className="text-3xl font-bold text-emerald-400">
                {d.active_session.present_count}
              </p>
              <p className="text-slate-400 text-xs">/ {d.active_session.total_students}</p>
              <p className="text-emerald-500 text-xs font-medium mt-1">
                {d.active_session.attendance_percentage}%
              </p>
            </div>
          </div>

          <Link
            to="/faculty/attendance"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300
                       hover:text-white bg-emerald-900/40 hover:bg-emerald-800/50
                       border border-emerald-700/40 px-4 py-2 rounded-lg transition-all"
          >
            <Activity size={14} /> Manage Session <ChevronRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="rounded-xl bg-white/3 border border-white/8 p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
            <Calendar size={18} className="text-slate-500" />
          </div>
          <div>
            <p className="text-slate-300 text-sm font-medium">No active session right now</p>
            <p className="text-slate-600 text-xs mt-0.5">Start a session from the Attendance page</p>
          </div>
          <Link
            to="/faculty/attendance"
            className="ml-auto text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-sm transition-colors"
          >
            Attendance <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* ---- Today's schedule ---- */}
      <div className="rounded-xl bg-white/3 border border-white/8 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
          <h3 className="text-slate-300 text-sm font-semibold uppercase tracking-wide">
            Today's Schedule
          </h3>
          <span className="text-slate-500 text-xs">
            {d?.today_schedule?.length ?? 0} classes
          </span>
        </div>
        {d?.today_schedule && d.today_schedule.length > 0 ? (
          <div className="divide-y divide-white/5">
            {d.today_schedule.map((slot) => (
              <ScheduleRow key={slot.timetable_entry_id} slot={slot} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10">
            <BookOpen className="w-8 h-8 text-slate-700 mb-2" />
            <p className="text-slate-500 text-sm">No classes scheduled for today</p>
          </div>
        )}
      </div>

      {/* ---- Quick links ---- */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/faculty/attendance"
          className="flex items-center gap-3 bg-white/3 hover:bg-white/6 border border-white/8 rounded-xl p-4 transition-all group"
        >
          <div className="w-9 h-9 rounded-lg bg-indigo-600/20 flex items-center justify-center group-hover:bg-indigo-600/30 transition-colors">
            <CheckCircle2 size={16} className="text-indigo-400" />
          </div>
          <div>
            <p className="text-white text-sm font-medium">Attendance</p>
            <p className="text-slate-500 text-xs">Manage sessions</p>
          </div>
        </Link>
        <Link
          to="/faculty/timetable"
          className="flex items-center gap-3 bg-white/3 hover:bg-white/6 border border-white/8 rounded-xl p-4 transition-all group"
        >
          <div className="w-9 h-9 rounded-lg bg-violet-600/20 flex items-center justify-center group-hover:bg-violet-600/30 transition-colors">
            <BarChart2 size={16} className="text-violet-400" />
          </div>
          <div>
            <p className="text-white text-sm font-medium">Timetable</p>
            <p className="text-slate-500 text-xs">View schedule</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
