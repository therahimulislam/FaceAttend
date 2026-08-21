/**
 * FaceAttend — Phase 18: AI Insights API
 */
import api from "@/services/api";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type TrendDirection = "IMPROVING" | "STABLE" | "DECLINING";
export type AnomalyType =
  | "REPEATED_FAILURE" | "REPEATED_LATE"
  | "ABSENCE_SPIKE" | "DECLINING_TREND";

export interface SubjectRisk {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  total: number;
  present: number;
  absent: number;
  percentage: number;
  risk: RiskLevel;
  reason: string;
  consecutive_absent: number;
}

export interface RiskAssessment {
  overall_risk: RiskLevel;
  reason: string;
  subjects: SubjectRisk[];
}

export interface Anomaly {
  type: AnomalyType;
  severity: "LOW" | "MEDIUM" | "HIGH";
  reason: string;
}

export interface AnomalyReport {
  risk: RiskLevel;
  anomaly_count: number;
  anomalies: Anomaly[];
}

export interface SubjectInsight {
  subject_code: string;
  subject_name: string;
  total_sessions: number;
  present: number;
  percentage: number;
  trend: TrendDirection;
  classes_can_miss_safely: number;
  sessions_to_recover: number | null;
  suggestion: string;
}

export interface InsightsReport {
  student_id: string;
  generated_at: string;
  subjects: SubjectInsight[];
}

export interface AIOverviewStudent {
  student_id: string;
  full_name: string;
  section: string;
  overall_risk: RiskLevel;
  reason: string;
}

export interface AIOverview {
  summary: { LOW: number; MEDIUM: number; HIGH: number };
  students: AIOverviewStudent[];
  total: number;
}

const BASE = "/ai";

export const aiApi = {
  risk: (studentId?: string): Promise<{ data: RiskAssessment }> => {
    const q = studentId ? `?student_id=${studentId}` : "";
    return api.get(`${BASE}/risk/${q}`).then((r) => r.data);
  },
  anomalies: (studentId?: string): Promise<{ data: AnomalyReport }> => {
    const q = studentId ? `?student_id=${studentId}` : "";
    return api.get(`${BASE}/anomalies/${q}`).then((r) => r.data);
  },
  insights: (studentId?: string): Promise<{ data: InsightsReport }> => {
    const q = studentId ? `?student_id=${studentId}` : "";
    return api.get(`${BASE}/insights/${q}`).then((r) => r.data);
  },
  overview: (sectionId?: string): Promise<{ data: AIOverview }> => {
    const q = sectionId ? `?section_id=${sectionId}` : "";
    return api.get(`${BASE}/overview/${q}`).then((r) => r.data);
  },
};
