/**
 * FaceAttend — Phase 18: Student AI Insights Page
 * Full breakdown: risk per subject, anomalies, and improvement suggestions.
 */
import { useQuery } from "@tanstack/react-query";
import {
  Brain, TrendingUp, TrendingDown, Minus,
  AlertTriangle, ShieldCheck, Zap, CheckCircle2, Clock,
} from "lucide-react";
import { aiApi, RiskLevel, TrendDirection, AnomalyType } from "@/features/ai/api";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; icon: React.ReactNode }> = {
  LOW:    { label: "Low Risk",    color: "text-emerald-400", icon: <ShieldCheck size={14} /> },
  MEDIUM: { label: "Medium Risk", color: "text-amber-400",   icon: <AlertTriangle size={14} /> },
  HIGH:   { label: "High Risk",   color: "text-red-400",     icon: <Zap size={14} /> },
};

const TREND_CONFIG: Record<TrendDirection, { icon: React.ReactNode; label: string; color: string }> = {
  IMPROVING: { icon: <TrendingUp size={13} />,  label: "Improving", color: "text-emerald-400" },
  STABLE:    { icon: <Minus size={13} />,        label: "Stable",    color: "text-slate-400" },
  DECLINING: { icon: <TrendingDown size={13} />, label: "Declining", color: "text-red-400" },
};

const ANOMALY_ICONS: Record<AnomalyType, React.ReactNode> = {
  REPEATED_FAILURE: <AlertTriangle size={14} className="text-red-400" />,
  REPEATED_LATE:    <Clock size={14} className="text-amber-400" />,
  ABSENCE_SPIKE:    <Zap size={14} className="text-red-400" />,
  DECLINING_TREND:  <TrendingDown size={14} className="text-amber-400" />,
};

function PercentageBar({ pct, risk }: { pct: number; risk: RiskLevel }) {
  const colors: Record<RiskLevel, string> = {
    LOW: "bg-emerald-500", MEDIUM: "bg-amber-500", HIGH: "bg-red-500"
  };
  return (
    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${colors[risk]}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function StudentAIInsightsPage() {
  const { data: riskData, isLoading: rL } = useQuery({
    queryKey: ["ai-risk"],
    queryFn: () => aiApi.risk(),
    staleTime: 5 * 60_000,
  });

  const { data: anomData, isLoading: aL } = useQuery({
    queryKey: ["ai-anomalies"],
    queryFn: () => aiApi.anomalies(),
    staleTime: 5 * 60_000,
  });

  const { data: insData, isLoading: iL } = useQuery({
    queryKey: ["ai-insights"],
    queryFn: () => aiApi.insights(),
    staleTime: 5 * 60_000,
  });

  const isLoading = rL || aL || iL;
  const risk = riskData?.data;
  const anom = anomData?.data;
  const insights = insData?.data;

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const overallCfg = RISK_CONFIG[risk?.overall_risk ?? "LOW"];

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20
                        flex items-center justify-center shrink-0">
          <Brain size={18} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">AI Attendance Insights</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            AI-powered analysis of your attendance patterns.
          </p>
        </div>
      </div>

      {/* Overall Risk Banner */}
      {risk && (
        <div className={`rounded-xl p-5 border flex items-center gap-4 ${
          risk.overall_risk === "HIGH"   ? "bg-red-500/10 border-red-500/20" :
          risk.overall_risk === "MEDIUM" ? "bg-amber-500/10 border-amber-500/20" :
                                           "bg-emerald-500/10 border-emerald-500/20"
        }`}>
          <div className={`text-4xl font-black ${overallCfg.color}`}>
            {risk.overall_risk}
          </div>
          <div>
            <p className={`font-semibold ${overallCfg.color}`}>{overallCfg.label}</p>
            <p className="text-slate-400 text-sm mt-0.5">{risk.reason}</p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Subject Breakdown */}
        <div className="bg-white/3 border border-white/8 rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold text-sm">Subject Breakdown</h2>
          {(risk?.subjects ?? []).length === 0 ? (
            <p className="text-slate-600 text-sm italic">No attendance data yet.</p>
          ) : (
            <div className="space-y-4">
              {risk?.subjects.map((subj) => {
                const subjCfg = RISK_CONFIG[subj.risk];
                const insight = insights?.subjects.find((s) => s.subject_code === subj.subject_code);
                const trendCfg = insight ? TREND_CONFIG[insight.trend] : null;
                return (
                  <div key={subj.subject_id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">{subj.subject_name}</p>
                        <p className="text-slate-600 text-xs">{subj.subject_code}</p>
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <p className={`text-lg font-bold ${subjCfg.color}`}>{subj.percentage}%</p>
                        {trendCfg && (
                          <div className={`flex items-center gap-1 justify-end text-xs ${trendCfg.color}`}>
                            {trendCfg.icon} {trendCfg.label}
                          </div>
                        )}
                      </div>
                    </div>
                    <PercentageBar pct={subj.percentage} risk={subj.risk} />
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>{subj.present}/{subj.total} sessions attended</span>
                      <span className={subjCfg.color}>{subj.risk}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Insights + Suggestions */}
        <div className="space-y-4">
          {/* Suggestions */}
          <div className="bg-white/3 border border-white/8 rounded-xl p-5 space-y-3">
            <h2 className="text-white font-semibold text-sm">Suggestions</h2>
            {(insights?.subjects ?? []).length === 0 ? (
              <p className="text-slate-600 text-sm italic">No data to analyze yet.</p>
            ) : (
              insights?.subjects.map((subj) => (
                <div key={subj.subject_code}
                     className="flex items-start gap-2.5 p-3 bg-white/3 rounded-lg">
                  <CheckCircle2 size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-slate-300 text-xs font-medium">{subj.subject_name}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{subj.suggestion}</p>
                    {subj.classes_can_miss_safely > 0 && (
                      <p className="text-emerald-600 text-xs mt-0.5">
                        Can miss up to {subj.classes_can_miss_safely} more class(es) safely.
                      </p>
                    )}
                    {subj.sessions_to_recover !== null && subj.sessions_to_recover > 0 && (
                      <p className="text-red-500 text-xs mt-0.5">
                        Attend {subj.sessions_to_recover} consecutive session(s) to recover.
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Anomalies */}
          <div className="bg-white/3 border border-white/8 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold text-sm">Anomaly Report</h2>
              {anom && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
                  ${anom.risk === "HIGH"   ? "bg-red-500/20 text-red-400" :
                    anom.risk === "MEDIUM" ? "bg-amber-500/20 text-amber-400" :
                                            "bg-emerald-500/20 text-emerald-400"}`}>
                  {anom.risk}
                </span>
              )}
            </div>
            {anom?.anomaly_count === 0 ? (
              <div className="flex items-center gap-2 text-emerald-500 text-sm">
                <ShieldCheck size={14} />
                <span>No anomalies detected. Great attendance!</span>
              </div>
            ) : (
              <div className="space-y-2">
                {anom?.anomalies.map((a, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 bg-white/3 rounded-lg">
                    <span className="shrink-0 mt-0.5">
                      {ANOMALY_ICONS[a.type] ?? <AlertTriangle size={14} className="text-amber-400" />}
                    </span>
                    <p className="text-slate-400 text-xs leading-relaxed">{a.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
