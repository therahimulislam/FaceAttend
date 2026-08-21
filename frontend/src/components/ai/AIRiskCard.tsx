/**
 * FaceAttend — Phase 18: AI Risk Card (for Student Dashboard)
 * Shows overall risk level and per-subject breakdown.
 */
import { useQuery } from "@tanstack/react-query";
import { Brain, TrendingDown, TrendingUp, Minus, AlertTriangle, ShieldCheck, Zap } from "lucide-react";
import { aiApi, RiskLevel, TrendDirection } from "@/features/ai/api";
import { useNavigate } from "react-router-dom";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  LOW:    { label: "Low Risk",    color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: <ShieldCheck size={16} className="text-emerald-400" /> },
  MEDIUM: { label: "Medium Risk", color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20",   icon: <AlertTriangle size={16} className="text-amber-400" /> },
  HIGH:   { label: "High Risk",   color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20",       icon: <Zap size={16} className="text-red-400" /> },
};

const TREND_ICON: Record<TrendDirection, React.ReactNode> = {
  IMPROVING: <TrendingUp  size={12} className="text-emerald-400" />,
  STABLE:    <Minus        size={12} className="text-slate-400" />,
  DECLINING: <TrendingDown size={12} className="text-red-400" />,
};

function PercentageBar({ pct, risk }: { pct: number; risk: RiskLevel }) {
  const colors = { LOW: "bg-emerald-500", MEDIUM: "bg-amber-500", HIGH: "bg-red-500" };
  return (
    <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${colors[risk]}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AIRiskCard() {
  const navigate = useNavigate();

  const { data: riskData, isLoading: riskLoading } = useQuery({
    queryKey: ["ai-risk"],
    queryFn: () => aiApi.risk(),
    staleTime: 5 * 60_000,
  });

  const { data: insightsData } = useQuery({
    queryKey: ["ai-insights"],
    queryFn: () => aiApi.insights(),
    staleTime: 5 * 60_000,
  });

  const risk = riskData?.data;
  const insights = insightsData?.data;

  if (riskLoading) {
    return (
      <div className="bg-white/3 border border-white/8 rounded-xl p-5 space-y-3 animate-pulse">
        <div className="h-4 w-32 bg-white/10 rounded" />
        <div className="h-8 w-24 bg-white/10 rounded" />
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-12 bg-white/5 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!risk) return null;

  const cfg = RISK_CONFIG[risk.overall_risk];

  return (
    <div className={`bg-white/3 border rounded-xl p-5 space-y-4 ${cfg.bg}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-300 text-sm font-semibold">
          <Brain size={15} className="text-indigo-400" />
          AI Attendance Risk
        </div>
        <button
          id="ai-view-insights"
          onClick={() => navigate("/student/ai-insights")}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Details →
        </button>
      </div>

      {/* Overall Risk Badge */}
      <div className="flex items-center gap-2">
        {cfg.icon}
        <span className={`text-xl font-bold ${cfg.color}`}>{cfg.label}</span>
      </div>
      <p className="text-slate-500 text-xs leading-relaxed">{risk.reason}</p>

      {/* Per-subject breakdown */}
      {risk.subjects.length > 0 && (
        <div className="space-y-3 pt-1">
          {risk.subjects.slice(0, 4).map((subj) => {
            const insight = insights?.subjects.find((s) => s.subject_code === subj.subject_code);
            const subjCfg = RISK_CONFIG[subj.risk];
            return (
              <div key={subj.subject_id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {insight && TREND_ICON[insight.trend]}
                    <span className="text-slate-300 text-xs truncate">{subj.subject_name}</span>
                  </div>
                  <span className={`text-xs font-semibold shrink-0 ml-2 ${subjCfg.color}`}>
                    {subj.percentage}%
                  </span>
                </div>
                <PercentageBar pct={subj.percentage} risk={subj.risk} />
              </div>
            );
          })}
        </div>
      )}

      {risk.subjects.length === 0 && (
        <p className="text-slate-600 text-xs italic">No attendance data yet.</p>
      )}
    </div>
  );
}
