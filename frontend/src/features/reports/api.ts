/**
 * FaceAttend — Phase 15: Reports API
 */
import api from "@/services/api";

export type ReportFormat = "json" | "csv" | "xlsx" | "pdf";
export type ReportType = "student" | "subject" | "section" | "department";

export interface StudentReport {
  student: {
    id: string;
    full_name: string;
    student_id: string;
    department: string;
    section: string;
  };
  period: { from: string; to: string; label: string };
  overall: {
    total: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
    percentage: number;
  };
  by_subject: Array<{
    subject_code: string;
    subject_name: string;
    total: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
    percentage: number;
  }>;
}

export interface SubjectReport {
  subject: { id: string; code: string; name: string };
  period: { from: string; to: string; label: string };
  total_students: number;
  by_student: Array<{
    student_id: string;
    full_name: string;
    total_sessions: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
    percentage: number;
  }>;
}

export interface SectionReport {
  section: { id: string; name: string; semester: string; department: string };
  period: { from: string; to: string; label: string };
  subjects: string[];
  rows: Array<{
    student_id: string;
    full_name: string;
    by_subject: Record<string, number>;
    overall_percentage: number;
  }>;
}

export interface DepartmentReport {
  department: { id: string; name: string; code: string };
  period: { from: string; to: string; label: string };
  total_sections: number;
  by_section: Array<{
    section_name: string;
    total_students: number;
    total_sessions: number;
    avg_attendance: number;
  }>;
  overall_avg: number;
}

const BASE = "/reports";

export interface ReportParams {
  date_from?: string;
  date_to?: string;
  student_id?: string;
  subject_id?: string;
  section_id?: string;
  department_id?: string;
}

function buildUrl(path: string, params: ReportParams & { format?: string; export?: string }): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) q.set(k, v);
  });
  const qs = q.toString();
  return `${BASE}${path}${qs ? "?" + qs : ""}`;
}

export const reportsApi = {
  student: (params: ReportParams): Promise<{ data: StudentReport }> =>
    api.get(buildUrl("/student/", params)).then((r) => r.data),

  subject: (params: ReportParams): Promise<{ data: SubjectReport }> =>
    api.get(buildUrl("/subject/", params)).then((r) => r.data),

  section: (params: ReportParams): Promise<{ data: SectionReport }> =>
    api.get(buildUrl("/section/", params)).then((r) => r.data),

  department: (params: ReportParams): Promise<{ data: DepartmentReport }> =>
    api.get(buildUrl("/department/", params)).then((r) => r.data),

  /** Trigger a file download for a given format */
  download: async (
    type: ReportType,
    format: "csv" | "xlsx" | "pdf",
    params: ReportParams
  ): Promise<void> => {
    const url = buildUrl(`/${type}/`, { ...params, export: format });
    const token = localStorage.getItem("access_token");
    const response = await fetch(`/api/v1${url}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    const ext = format === "xlsx" ? "xlsx" : format;
    const filename =
      response.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
      `report.${ext}`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },
};
