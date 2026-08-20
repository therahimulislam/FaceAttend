/**
 * FaceAttend — Phase 16: Full Notifications Page
 * Paginated list of all notifications with filter by read/unread
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell, CheckCircle2, XCircle, AlertTriangle,
  Calendar, ShieldAlert, CheckCheck, Filter,
} from "lucide-react";
import { notificationsApi, type NotificationCategory, type NotificationItem } from "@/features/notifications/api";

const CAT_LABELS: Record<NotificationCategory, { label: string; color: string }> = {
  REGISTRATION_APPROVED: { label: "Approved",          color: "text-emerald-400" },
  REGISTRATION_REJECTED: { label: "Rejected",          color: "text-red-400" },
  ATTENDANCE_SUCCESS:    { label: "Attendance ✓",      color: "text-indigo-400" },
  ATTENDANCE_FAILED:     { label: "Attendance ✗",      color: "text-rose-400" },
  LOW_ATTENDANCE:        { label: "Low Attendance",    color: "text-amber-400" },
  UPCOMING_CLASS:        { label: "Upcoming Class",    color: "text-sky-400" },
  SUSPICIOUS_ATTEMPT:    { label: "Suspicious",        color: "text-red-400" },
};

const CAT_ICONS: Record<NotificationCategory, React.ReactNode> = {
  REGISTRATION_APPROVED: <CheckCircle2 size={16} />,
  REGISTRATION_REJECTED: <XCircle size={16} />,
  ATTENDANCE_SUCCESS:    <CheckCircle2 size={16} />,
  ATTENDANCE_FAILED:     <XCircle size={16} />,
  LOW_ATTENDANCE:        <AlertTriangle size={16} />,
  UPCOMING_CLASS:        <Calendar size={16} />,
  SUSPICIOUS_ATTEMPT:    <ShieldAlert size={16} />,
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["notifications-page", page],
    queryFn: () => notificationsApi.list(page),
    staleTime: 15_000,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-page"] });
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
      qc.invalidateQueries({ queryKey: ["notifications-list"] });
    },
  });

  const markAllMut = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-page"] });
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
      qc.invalidateQueries({ queryKey: ["notifications-list"] });
    },
  });

  const allItems: NotificationItem[] = data?.data?.results ?? [];
  const filtered = allItems.filter((n) => {
    if (filter === "unread") return !n.is_read;
    if (filter === "read") return n.is_read;
    return true;
  });

  const total = data?.data?.count ?? 0;
  const hasNext = !!data?.data?.next;
  const hasPrev = !!data?.data?.previous;
  const unreadCount = allItems.filter((n) => !n.is_read).length;

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell size={20} className="text-indigo-400" /> Notifications
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">{total} total notification{total !== 1 ? "s" : ""}</p>
        </div>
        {unreadCount > 0 && (
          <button
            id="mark-all-read-full"
            onClick={() => markAllMut.mutate()}
            disabled={markAllMut.isPending}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
                       text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all"
          >
            <CheckCheck size={14} />
            Mark all read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "unread", "read"] as const).map((f) => (
          <button
            key={f}
            id={`notif-filter-${f}`}
            onClick={() => { setFilter(f); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all capitalize
              ${filter === f
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "bg-white/4 border-white/8 text-slate-400 hover:text-white hover:bg-white/7"
              }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-600 gap-3">
          <Bell size={32} />
          <p className="text-slate-500">No {filter !== "all" ? filter + " " : ""}notifications</p>
        </div>
      ) : (
        <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden divide-y divide-white/6">
          {filtered.map((n) => {
            const cat = CAT_LABELS[n.category] ?? { label: n.category, color: "text-slate-400" };
            const icon = CAT_ICONS[n.category] ?? <Bell size={16} />;
            return (
              <div
                key={n.id}
                className={`flex gap-4 px-5 py-4 transition-colors hover:bg-white/4
                            ${!n.is_read ? "bg-white/2" : ""}`}
              >
                {/* Icon */}
                <div className={`mt-0.5 shrink-0 ${cat.color}`}>{icon}</div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`font-medium text-sm ${!n.is_read ? "text-white" : "text-slate-300"}`}>
                        {n.title}
                      </p>
                      <span className={`text-[11px] font-semibold ${cat.color}`}>{cat.label}</span>
                    </div>
                    <span className="text-slate-600 text-xs shrink-0 mt-0.5">{relativeTime(n.created_at)}</span>
                  </div>
                  <p className="text-slate-500 text-sm mt-1 leading-relaxed">{n.body}</p>
                </div>

                {/* Mark read */}
                {!n.is_read && (
                  <button
                    id={`mark-read-${n.id}`}
                    onClick={() => markReadMut.mutate(n.id)}
                    disabled={markReadMut.isPending}
                    className="shrink-0 mt-0.5 text-slate-600 hover:text-indigo-400 transition-colors"
                    title="Mark as read"
                  >
                    <CheckCircle2 size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {(hasNext || hasPrev) && (
        <div className="flex items-center justify-between">
          <button
            id="notif-prev-page"
            disabled={!hasPrev}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 bg-white/4 border border-white/8 text-sm text-slate-300
                       rounded-xl disabled:opacity-30 hover:bg-white/8 transition-all"
          >
            ← Previous
          </button>
          <span className="text-slate-500 text-sm">Page {page}</span>
          <button
            id="notif-next-page"
            disabled={!hasNext}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 bg-white/4 border border-white/8 text-sm text-slate-300
                       rounded-xl disabled:opacity-30 hover:bg-white/8 transition-all"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
