/**
 * FaceAttend — Admin Dashboard (Phase 14)
 *
 * Polished admin overview:
 *  - Stat grid: students, faculty, depts, active sessions, today's attendance, pending enrollments
 *  - Pending approvals count with recent list
 *  - Quick action links
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  GraduationCap, Users, Building2, Activity,
  CheckCircle, Clock, Camera, ChevronRight,
  TrendingUp, AlertTriangle, BookOpen,
} from "lucide-react";
import { dashboardApi, type PendingStudent } from "@/features/dashboard/api";

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
function StatCard({
  label, value, icon: Icon, colorClass, pulse, to,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  colorClass: string;
  pulse?: boolean;
  to?: string;
}) {
  const inner = (
    <div className="bg-white/4 hover:bg-white/7 border border-white/8 rounded-xl p-5 transition-all group cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClass}`}>
          <Icon size={18} className="text-white" />
        </div>
        {pulse && (
          <span className="relative flex h-2.5 w-2.5 mt-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
        )}
      </div>
      <p className="text-3xl font-bold text-white mb-1">{value}</p>
      <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">{label}</p>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

// ---------------------------------------------------------------------------
// Pending student row
// ---------------------------------------------------------------------------
function PendingRow({ student }: { student: PendingStudent }) {
  const initials = student.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const days = Math.floor(
    (Date.now() - new Date(student.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors">
      <div className="w-8 h-8 rounded-full bg-amber-600/20 flex items-center justify-center shrink-0">
        <span className="text-amber-300 text-xs font-bold">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{student.full_name}</p>
        <p className="text-slate-500 text-xs">{student.student_id} · {student.department_name}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-amber-400 text-xs">{days === 0 ? "Today" : `${days}d ago`}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default function AdminDashboard() {
  const { data: dashData, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: dashboardApi.admin,
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
    <div className="space-y-7 pb-8">
      {/* ---- Header ---- */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">System overview — live data</p>
      </div>

      {/* ---- Stat grid ---- */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Total Students" value={d?.total_students ?? 0}
          icon={GraduationCap} colorClass="bg-blue-600"
          to="/admin/students"
        />
        <StatCard
          label="Pending Approval" value={d?.pending_approvals ?? 0}
          icon={Clock} colorClass="bg-amber-600"
          to="/admin/students?status=PENDING"
        />
        <StatCard
          label="Faculty" value={d?.total_faculty ?? 0}
          icon={Users} colorClass="bg-violet-600"
          to="/admin/faculty"
        />
        <StatCard
          label="Departments" value={d?.total_departments ?? 0}
          icon={Building2} colorClass="bg-emerald-600"
          to="/admin/departments"
        />
        <StatCard
          label="Active Sessions" value={d?.active_sessions_now ?? 0}
          icon={Activity} colorClass="bg-teal-600"
          pulse={(d?.active_sessions_now ?? 0) > 0}
        />
        <StatCard
          label="Today Attended" value={d?.today_attendance_count ?? 0}
          icon={TrendingUp} colorClass="bg-indigo-600"
        />
      </div>

      {/* ---- Pending face enrollments alert (if any) ---- */}
      {(d?.pending_face_enrollments ?? 0) > 0 && (
        <div className="flex items-center gap-3 bg-amber-950/30 border border-amber-800/30 rounded-xl px-4 py-3">
          <Camera size={16} className="text-amber-400 shrink-0" />
          <p className="text-amber-300 text-sm flex-1">
            <span className="font-bold">{d?.pending_face_enrollments}</span> face enrollment
            {(d?.pending_face_enrollments ?? 0) !== 1 ? "s" : ""} pending review
          </p>
          <AlertTriangle size={14} className="text-amber-500 shrink-0" />
        </div>
      )}

      {/* ---- Two-column section ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pending approvals list */}
        <div className="rounded-xl bg-white/3 border border-white/8 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
            <h3 className="text-slate-300 text-sm font-semibold uppercase tracking-wide flex items-center gap-2">
              <Clock size={14} className="text-amber-400" /> Pending Approvals
            </h3>
            {(d?.pending_approvals ?? 0) > 0 && (
              <span className="text-xs bg-amber-900/60 text-amber-400 border border-amber-700/40 px-2 py-0.5 rounded-full">
                {d?.pending_approvals}
              </span>
            )}
          </div>

          {d?.recent_pending_students && d.recent_pending_students.length > 0 ? (
            <>
              <div className="divide-y divide-white/5">
                {d.recent_pending_students.map((s) => (
                  <PendingRow key={s.id} student={s} />
                ))}
              </div>
              <div className="px-4 py-3 border-t border-white/8">
                <Link
                  to="/admin/students?status=PENDING"
                  className="text-indigo-400 hover:text-indigo-300 text-sm flex items-center gap-1 transition-colors"
                >
                  Review all pending <ChevronRight size={14} />
                </Link>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-10">
              <CheckCircle size={28} className="text-emerald-600 mb-2" />
              <p className="text-slate-500 text-sm">No pending approvals</p>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="rounded-xl bg-white/3 border border-white/8 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8">
            <h3 className="text-slate-300 text-sm font-semibold uppercase tracking-wide">
              Quick Actions
            </h3>
          </div>
          <div className="p-4 space-y-2">
            {[
              { to: "/admin/students",    icon: GraduationCap, label: "Manage Students",    sub: "Approvals, details" },
              { to: "/admin/faculty",     icon: Users,          label: "Manage Faculty",     sub: "Add, edit faculty" },
              { to: "/admin/departments", icon: Building2,      label: "Departments",        sub: "Manage departments" },
              { to: "/admin/subjects",    icon: BookOpen,       label: "Subjects & Rooms",   sub: "Academic setup" },
              { to: "/admin/timetable",   icon: Activity,       label: "Timetable",          sub: "Schedule classes" },
            ].map(({ to, icon: Icon, label, sub }) => (
              <Link
                key={to} to={to}
                className="flex items-center gap-3 rounded-xl p-3 hover:bg-white/5 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-indigo-600/20 transition-colors shrink-0">
                  <Icon size={14} className="text-slate-400 group-hover:text-indigo-400 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{label}</p>
                  <p className="text-slate-500 text-xs">{sub}</p>
                </div>
                <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
