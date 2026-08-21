/**
 * FaceAttend — Phase 18: Admin AI Insights Overview Page
 * Section-level risk heatmap + high-risk student list.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Brain, AlertTriangle, ShieldCheck, Zap, Users, TrendingDown,
} from "lucide-react";
import { aiApi, RiskLevel, AIOverviewStudent } from "@/features/ai/api";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const RISK_CONFIG: Record<RiskLevel, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  LOW:    { color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Low",    icon: <ShieldCheck size={13} /> },
  MEDIUM: { color: "text-amber-400",   bg: "bg-amber-500/10",   label: "Medium", icon: <AlertTriangle size={13} /> },
  HIGH:   { color: "text-red-400",     bg: "bg-red-500/10",     label: "High",   icon: <Zap size={13} /> },
};

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const cfg = RISK_CONFIG[risk];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5
                      rounded-full ${cfg.bg} ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AdminAIInsightsPage() {
  const [filter, setFilter] = useState<"" | RiskLevel>("");

  const { data, isLoading } = useQuery({
    queryKey: ["ai-overview"],
    queryFn: () => aiApi.overview(),
    staleTime: 2 * 60_000,
  });

  const overview = data?.data;
  const students: AIOverviewStudent[] = (overview?.students ?? []).filter(
    (s) => !filter || s.overall_risk === filter
  );

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20
                        flex items-center justify-center shrink-0">
          <Brain size={18} className="text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">AI Insights Overview</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Student attendance risk across all sections.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {overview && (
        <div className="grid grid-cols-3 gap-4">
          {(["HIGH", "MEDIUM", "LOW"] as RiskLevel[]).map((r) => {
            const cfg = RISK_CONFIG[r];
            const count = overview.summary[r];
            return (
              <button
                id={`ai-filter-${r.toLowerCase()}`}
                key={r}
                onClick={() => setFilter(filter === r ? "" : r)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  filter === r
                    ? `${cfg.bg} border-current ${cfg.color}`
                    : "bg-white/3 border-white/8 hover:bg-white/6"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`${cfg.color}`}>{cfg.icon}</span>
                  <span className={`text-2xl font-black ${cfg.color}`}>{count}</span>
                </div>
                <p className="text-slate-400 text-xs">{cfg.label} Risk Students</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Student Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : students.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3 text-slate-600">
          <Users size={32} />
          <p className="text-slate-500">No students{filter ? ` with ${filter} risk` : ""}</p>
        </div>
      ) : (
        <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_2fr] gap-4 px-5 py-3
                          border-b border-white/8 text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Student</span>
            <span>Section</span>
            <span>Risk</span>
            <span>Reason</span>
          </div>
          <div className="divide-y divide-white/6">
            {students.map((s) => (
              <div
                key={s.student_id}
                className="px-5 py-3.5 grid md:grid-cols-[2fr_1fr_1fr_2fr] gap-3 md:gap-4 items-center"
              >
                <div>
                  <p className="text-white text-sm font-medium">{s.full_name}</p>
                  <p className="text-slate-600 text-xs">{s.student_id}</p>
                </div>
                <p className="text-slate-400 text-sm">{s.section}</p>
                <RiskBadge risk={s.overall_risk} />
                <p className="text-slate-500 text-xs line-clamp-2">{s.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {filter && (
        <p className="text-center text-slate-600 text-sm">
          Showing {students.length} {filter.toLowerCase()} risk student(s).{" "}
          <button
            id="ai-clear-filter"
            onClick={() => setFilter("")}
            className="text-indigo-400 hover:text-indigo-300 underline"
          >
            Clear filter
          </button>
        </p>
      )}
    </div>
  );
}
