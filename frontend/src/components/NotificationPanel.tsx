/**
 * FaceAttend — Phase 16: NotificationPanel
 *
 * A dropdown panel showing recent notifications with:
 * - Unread badge count on the bell icon
 * - Per-category icons and colours
 * - Read/unread highlight
 * - Mark-all-read button
 * - Click item → marks read
 * - "View all" link
 */
import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Bell, CheckCircle2, XCircle, AlertTriangle,
  Calendar, ShieldAlert, ChevronRight, CheckCheck,
} from "lucide-react";
import { type NotificationCategory, type NotificationItem } from "@/features/notifications/api";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuthStore } from "@/store/authStore";

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------
type CatConfig = { icon: React.ReactNode; color: string; bg: string };

const CAT_MAP: Record<NotificationCategory, CatConfig> = {
  REGISTRATION_APPROVED: {
    icon: <CheckCircle2 size={15} />,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  REGISTRATION_REJECTED: {
    icon: <XCircle size={15} />,
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
  ATTENDANCE_SUCCESS: {
    icon: <CheckCircle2 size={15} />,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
  },
  ATTENDANCE_FAILED: {
    icon: <XCircle size={15} />,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
  },
  LOW_ATTENDANCE: {
    icon: <AlertTriangle size={15} />,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  UPCOMING_CLASS: {
    icon: <Calendar size={15} />,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
  },
  SUSPICIOUS_ATTEMPT: {
    icon: <ShieldAlert size={15} />,
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
};

// ---------------------------------------------------------------------------
// Relative time
// ---------------------------------------------------------------------------
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Single notification row
// ---------------------------------------------------------------------------
function NotifRow({ n, onRead }: { n: NotificationItem; onRead: (id: string) => void }) {
  const cat = CAT_MAP[n.category] ?? CAT_MAP.ATTENDANCE_SUCCESS;
  return (
    <button
      id={`notif-${n.id}`}
      onClick={() => { if (!n.is_read) onRead(n.id); }}
      className={`w-full text-left px-4 py-3 flex gap-3 transition-colors hover:bg-white/5
                  ${!n.is_read ? "bg-white/3" : ""}`}
    >
      {/* Icon */}
      <span
        className={`mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center
                    ${cat.bg} ${cat.color}`}
      >
        {cat.icon}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-medium leading-snug truncate ${!n.is_read ? "text-white" : "text-slate-300"}`}>
            {n.title}
          </p>
          <span className="text-slate-600 text-xs shrink-0">{relativeTime(n.created_at)}</span>
        </div>
        <p className="text-slate-500 text-xs mt-0.5 line-clamp-2 leading-relaxed">{n.body}</p>
      </div>

      {/* Unread dot */}
      {!n.is_read && (
        <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Bell + Panel
// ---------------------------------------------------------------------------
export function NotificationBell() {
  const { unreadCount, notifications, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Infer notifications path from role
  const notifPath =
    user?.role === "STUDENT" ? "/student/notifications"
    : user?.role === "FACULTY" ? "/faculty/notifications"
    : "/admin/notifications";

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        id="notification-bell"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/6
                   transition-all focus-visible:outline-none focus-visible:ring-2
                   focus-visible:ring-indigo-500"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center
                       justify-center rounded-full bg-indigo-600 text-white text-[10px] font-bold
                       leading-none border border-slate-900"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-slate-900 border border-white/10
                     rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden
                     animate-[fadeInDown_0.15s_ease]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              <Bell size={14} className="text-indigo-400" />
              Notifications
              {unreadCount > 0 && (
                <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                id="mark-all-read-btn"
                onClick={() => markAllRead()}
                className="flex items-center gap-1 text-slate-500 hover:text-indigo-400
                           text-xs transition-colors"
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-600 gap-2">
                <Bell size={24} />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.slice(0, 8).map((n) => (
                <NotifRow key={n.id} n={n} onRead={markRead} />
              ))
            )}
          </div>

          {/* Footer */}
          <Link
            to={notifPath}
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 py-3 text-sm text-slate-500
                       hover:text-indigo-400 border-t border-white/8 transition-colors"
          >
            View all notifications <ChevronRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}
