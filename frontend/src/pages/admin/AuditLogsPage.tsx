/**
 * FaceAttend — Phase 17: Audit Logs Page (Admin only)
 * Paginated, filterable table of all audit events
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck, AlertTriangle, ShieldAlert,
  CheckCircle2, XCircle, BookOpen, Calendar, Lock,
  Search, Filter,
} from "lucide-react";
import api from "@/services/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type AuditEventType =
  | "STUDENT_APPROVED" | "STUDENT_REJECTED"
  | "ATTENDANCE_CORRECTION" | "ROLE_CHANGE"
  | "SUBJECT_CHANGE" | "TIMETABLE_CHANGE"
  | "SECURITY_EVENT" | "SUSPICIOUS_ATTEMPT";

type AuditSeverity = "INFO" | "WARNING" | "CRITICAL";

interface AuditLogEntry {
  id: string;
  event_type: AuditEventType;
  event_type_display: string;
  severity: AuditSeverity;
  severity_display: string;
  actor_email: string | null;
  target_email: string | null;
  description: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface PaginatedAuditLogs {
  count: number;
  next: string | null;
  previous: string | null;
  results: AuditLogEntry[];
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const EVENT_ICONS: Record<AuditEventType, React.ReactNode> = {
  STUDENT_APPROVED:      <CheckCircle2 size={14} />,
  STUDENT_REJECTED:      <XCircle size={14} />,
  ATTENDANCE_CORRECTION: <ShieldCheck size={14} />,
  ROLE_CHANGE:           <Lock size={14} />,
  SUBJECT_CHANGE:        <BookOpen size={14} />,
  TIMETABLE_CHANGE:      <Calendar size={14} />,
  SECURITY_EVENT:        <ShieldAlert size={14} />,
  SUSPICIOUS_ATTEMPT:    <AlertTriangle size={14} />,
};

const SEV_CONFIG: Record<AuditSeverity, { badge: string; row: string }> = {
  INFO:     { badge: "bg-slate-700 text-slate-300",       row: "" },
  WARNING:  { badge: "bg-amber-500/20 text-amber-400",    row: "bg-amber-500/5" },
  CRITICAL: { badge: "bg-red-500/20 text-red-400",        row: "bg-red-500/5" },
};

const EVENT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All events" },
  { value: "STUDENT_APPROVED",      label: "Student Approved" },
  { value: "STUDENT_REJECTED",      label: "Student Rejected" },
  { value: "ATTENDANCE_CORRECTION", label: "Attendance Correction" },
  { value: "ROLE_CHANGE",           label: "Role Change" },
  { value: "SUBJECT_CHANGE",        label: "Subject Change" },
  { value: "TIMETABLE_CHANGE",      label: "Timetable Change" },
  { value: "SECURITY_EVENT",        label: "Security Event" },
  { value: "SUSPICIOUS_ATTEMPT",    label: "Suspicious Attempt" },
];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------
function fetchLogs(params: Record<string, string>, page: number) {
  const q = new URLSearchParams({ page: String(page) });
  Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
  return api.get(`/audit-logs/?${q}`).then((r) => r.data as { data: PaginatedAuditLogs });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState("");
  const [severity, setSeverity]   = useState("");
  const [actorEmail, setActorEmail] = useState("");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");
  const [expanded, setExpanded]   = useState<string | null>(null);

  const params = { event_type: eventType, severity, actor_email: actorEmail, date_from: dateFrom, date_to: dateTo };

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", params, page],
    queryFn: () => fetchLogs(params, page),
    staleTime: 15_000,
  });

  const logs = data?.data?.results ?? [];
  const total = data?.data?.count ?? 0;
  const hasNext = !!data?.data?.next;
  const hasPrev = !!data?.data?.previous;

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShieldCheck size={20} className="text-indigo-400" /> Audit Logs
        </h1>
        <p className="text-slate-400 text-sm mt-0.5">{total.toLocaleString()} total entries</p>
      </div>

      {/* Filters */}
      <div className="bg-white/3 border border-white/8 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3 text-slate-400 text-sm font-medium">
          <Filter size={13} /> Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {/* Event Type */}
          <select
            id="filter-event-type"
            value={eventType}
            onChange={(e) => { setEventType(e.target.value); setPage(1); }}
            className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm
                       text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {EVENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Severity */}
          <select
            id="filter-severity"
            value={severity}
            onChange={(e) => { setSeverity(e.target.value); setPage(1); }}
            className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm
                       text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All severities</option>
            <option value="INFO">Info</option>
            <option value="WARNING">Warning</option>
            <option value="CRITICAL">Critical</option>
          </select>

          {/* Actor email search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              id="filter-actor-email"
              type="text"
              placeholder="Actor email..."
              value={actorEmail}
              onChange={(e) => { setActorEmail(e.target.value); setPage(1); }}
              className="w-full pl-8 pr-3 py-2 bg-slate-800 border border-white/10 rounded-lg
                         text-sm text-slate-200 placeholder-slate-600
                         focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Date from */}
          <input
            id="filter-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm
                       text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          {/* Date to */}
          <input
            id="filter-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm
                       text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-slate-600 gap-3">
          <ShieldCheck size={32} />
          <p className="text-slate-500">No audit logs found</p>
        </div>
      ) : (
        <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3
                          border-b border-white/8 text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Event / Description</span>
            <span>Actor</span>
            <span>Target</span>
            <span>Severity</span>
            <span>Time</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/6">
            {logs.map((log) => {
              const sev = SEV_CONFIG[log.severity] ?? SEV_CONFIG.INFO;
              const icon = EVENT_ICONS[log.event_type] ?? <ShieldCheck size={14} />;
              const isOpen = expanded === log.id;

              return (
                <div key={log.id} className={sev.row}>
                  {/* Main row */}
                  <button
                    id={`audit-row-${log.id}`}
                    onClick={() => setExpanded(isOpen ? null : log.id)}
                    className="w-full text-left px-5 py-3.5 grid md:grid-cols-[2fr_1fr_1fr_1fr_auto]
                               gap-3 md:gap-4 items-start hover:bg-white/4 transition-colors"
                  >
                    {/* Event */}
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="mt-0.5 shrink-0 text-slate-400">{icon}</span>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                          {log.event_type_display}
                        </p>
                        <p className="text-slate-500 text-xs mt-0.5 line-clamp-2 leading-relaxed">
                          {log.description}
                        </p>
                      </div>
                    </div>

                    {/* Actor */}
                    <p className="text-slate-400 text-xs truncate self-center">
                      {log.actor_email ?? <span className="text-slate-600 italic">system</span>}
                    </p>

                    {/* Target */}
                    <p className="text-slate-400 text-xs truncate self-center">
                      {log.target_email ?? <span className="text-slate-700">—</span>}
                    </p>

                    {/* Severity */}
                    <div className="self-center">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold
                                        px-2 py-0.5 rounded-full ${sev.badge}`}>
                        {log.severity}
                      </span>
                    </div>

                    {/* Time */}
                    <p className="text-slate-600 text-xs shrink-0 self-center">
                      {relativeTime(log.created_at)}
                    </p>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="px-5 pb-4 space-y-3 border-t border-white/5 pt-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        {log.ip_address && (
                          <div>
                            <p className="text-slate-600 mb-0.5">IP Address</p>
                            <p className="text-slate-300 font-mono">{log.ip_address}</p>
                          </div>
                        )}
                        {log.created_at && (
                          <div>
                            <p className="text-slate-600 mb-0.5">Timestamp</p>
                            <p className="text-slate-300">{new Date(log.created_at).toLocaleString()}</p>
                          </div>
                        )}
                        {log.user_agent && (
                          <div className="col-span-full">
                            <p className="text-slate-600 mb-0.5">User Agent</p>
                            <p className="text-slate-500 truncate">{log.user_agent}</p>
                          </div>
                        )}
                      </div>
                      {(log.old_value || log.new_value) && (
                        <div className="grid sm:grid-cols-2 gap-3">
                          {log.old_value && (
                            <div>
                              <p className="text-slate-600 text-xs mb-1">Before</p>
                              <pre className="bg-slate-800/60 rounded-lg px-3 py-2 text-xs text-slate-400
                                             overflow-auto max-h-28 leading-relaxed">
                                {JSON.stringify(log.old_value, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.new_value && (
                            <div>
                              <p className="text-slate-600 text-xs mb-1">After</p>
                              <pre className="bg-slate-800/60 rounded-lg px-3 py-2 text-xs text-slate-400
                                             overflow-auto max-h-28 leading-relaxed">
                                {JSON.stringify(log.new_value, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {(hasNext || hasPrev) && (
        <div className="flex items-center justify-between">
          <button
            id="audit-prev-page"
            disabled={!hasPrev}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 bg-white/4 border border-white/8 text-sm text-slate-300
                       rounded-xl disabled:opacity-30 hover:bg-white/8 transition-all"
          >
            ← Previous
          </button>
          <span className="text-slate-500 text-sm">Page {page} · {total.toLocaleString()} total</span>
          <button
            id="audit-next-page"
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
