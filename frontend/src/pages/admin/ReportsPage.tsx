/**
 * FaceAttend — Phase 15: Reports Page
 *
 * Supports 4 report types: Student, Subject, Section, Department
 * - Filterable by date range and entity (student/subject/section/dept)
 * - JSON preview table shown inline
 * - Download buttons for CSV, Excel, PDF
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText, Download, Filter, RefreshCw,
  AlertCircle, User, BookOpen,
  Users, Building2, FileSpreadsheet,
} from "lucide-react";
import { reportsApi, type ReportType, type ReportParams } from "@/features/reports/api";
import { studentsApi } from "@/features/students/api";
import { departmentsApi } from "@/features/departments/api";
import { useAuthStore } from "@/store/authStore";

// ---------------------------------------------------------------------------
// Stat mini-card
// ---------------------------------------------------------------------------
function Stat({ label, value, color = "text-white" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white/4 border border-white/8 rounded-xl p-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-slate-500 text-xs mt-0.5">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Percentage badge
// ---------------------------------------------------------------------------
function PctBadge({ pct }: { pct: number }) {
  const color = pct >= 75 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400";
  return <span className={`font-semibold ${color}`}>{pct}%</span>;
}

// ---------------------------------------------------------------------------
// Download button row
// ---------------------------------------------------------------------------
function DownloadButtons({
  type, params, disabled,
}: { type: ReportType; params: ReportParams; disabled: boolean }) {
  const [loading, setLoading] = useState<string | null>(null);

  async function doDownload(fmt: "csv" | "xlsx" | "pdf") {
    setLoading(fmt);
    try {
      await reportsApi.download(type, fmt, params);
    } finally {
      setLoading(null);
    }
  }

  const btns: Array<{ fmt: "csv" | "xlsx" | "pdf"; label: string; icon: React.ReactNode; cls: string }> = [
    { fmt: "csv",  label: "CSV",   icon: <FileText size={14} />,        cls: "bg-slate-700/60 hover:bg-slate-700 border-slate-600/40" },
    { fmt: "xlsx", label: "Excel", icon: <FileSpreadsheet size={14} />, cls: "bg-emerald-900/40 hover:bg-emerald-800/60 border-emerald-700/40" },
    { fmt: "pdf",  label: "PDF",   icon: <FileText size={14} />,        cls: "bg-red-900/40 hover:bg-red-800/60 border-red-700/40" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {btns.map(({ fmt, label, icon, cls }) => (
        <button
          key={fmt}
          id={`download-${type}-${fmt}`}
          disabled={disabled || loading !== null}
          onClick={() => doDownload(fmt)}
          className={`flex items-center gap-2 text-sm text-white font-medium px-4 py-2 rounded-lg border transition-all
                      disabled:opacity-40 disabled:cursor-not-allowed ${cls}`}
        >
          {loading === fmt ? (
            <div className="w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            icon
          )}
          <Download size={12} />
          {label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Student Report Preview
// ---------------------------------------------------------------------------
function StudentPreview({ data }: { data: import("@/features/reports/api").StudentReport }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total Classes" value={data.overall.total} />
        <Stat label="Present" value={data.overall.present} color="text-emerald-400" />
        <Stat label="Absent" value={data.overall.absent} color="text-red-400" />
        <Stat label="Overall %" value={`${data.overall.percentage}%`}
          color={data.overall.percentage >= 75 ? "text-emerald-400" : data.overall.percentage >= 50 ? "text-amber-400" : "text-red-400"} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 bg-white/4">
              {["Subject", "Total", "Present", "Late", "Absent", "%"].map((h) => (
                <th key={h} className="text-left text-slate-400 text-xs font-semibold px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.by_subject.map((row) => (
              <tr key={row.subject_code} className="hover:bg-white/3 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{row.subject_name}</p>
                  <p className="text-slate-500 text-xs">{row.subject_code}</p>
                </td>
                <td className="px-4 py-3 text-slate-300">{row.total}</td>
                <td className="px-4 py-3 text-emerald-400">{row.present}</td>
                <td className="px-4 py-3 text-amber-400">{row.late}</td>
                <td className="px-4 py-3 text-red-400">{row.absent}</td>
                <td className="px-4 py-3"><PctBadge pct={row.percentage} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subject Report Preview
// ---------------------------------------------------------------------------
function SubjectPreview({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Total Students" value={data.total_students} />
        <Stat label="Period" value={data.period.label} color="text-slate-300" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 bg-white/4">
              {["Student", "Sessions", "Present", "Late", "Absent", "%"].map((h) => (
                <th key={h} className="text-left text-slate-400 text-xs font-semibold px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.by_student.map((row: any) => (
              <tr key={row.student_id} className="hover:bg-white/3 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{row.full_name}</p>
                  <p className="text-slate-500 text-xs">{row.student_id}</p>
                </td>
                <td className="px-4 py-3 text-slate-300">{row.total_sessions}</td>
                <td className="px-4 py-3 text-emerald-400">{row.present}</td>
                <td className="px-4 py-3 text-amber-400">{row.late}</td>
                <td className="px-4 py-3 text-red-400">{row.absent}</td>
                <td className="px-4 py-3"><PctBadge pct={row.percentage} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Report Preview
// ---------------------------------------------------------------------------
function SectionPreview({ data }: { data: any }) {
  const subjects = data.subjects ?? [];
  return (
    <div className="overflow-x-auto rounded-xl border border-white/8">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/8 bg-white/4">
            <th className="text-left text-slate-400 text-xs font-semibold px-4 py-3 whitespace-nowrap">Student</th>
            {subjects.map((s: string) => (
              <th key={s} className="text-left text-slate-400 text-xs font-semibold px-4 py-3 whitespace-nowrap">{s}</th>
            ))}
            <th className="text-left text-slate-400 text-xs font-semibold px-4 py-3">Overall</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {data.rows.map((row: any) => (
            <tr key={row.student_id} className="hover:bg-white/3 transition-colors">
              <td className="px-4 py-3 whitespace-nowrap">
                <p className="text-white font-medium">{row.full_name}</p>
                <p className="text-slate-500 text-xs">{row.student_id}</p>
              </td>
              {subjects.map((s: string) => (
                <td key={s} className="px-4 py-3"><PctBadge pct={row.by_subject[s] ?? 0} /></td>
              ))}
              <td className="px-4 py-3"><PctBadge pct={row.overall_percentage} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Department Report Preview
// ---------------------------------------------------------------------------
function DeptPreview({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Sections" value={data.total_sections} />
        <Stat label="Overall Avg" value={`${data.overall_avg}%`}
          color={data.overall_avg >= 75 ? "text-emerald-400" : "text-amber-400"} />
        <Stat label="Period" value={data.period.label} color="text-slate-300" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 bg-white/4">
              {["Section", "Students", "Sessions", "Avg %"].map((h) => (
                <th key={h} className="text-left text-slate-400 text-xs font-semibold px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.by_section.map((row: any) => (
              <tr key={row.section_name} className="hover:bg-white/3 transition-colors">
                <td className="px-4 py-3 text-white font-medium">{row.section_name}</td>
                <td className="px-4 py-3 text-slate-300">{row.total_students}</td>
                <td className="px-4 py-3 text-slate-300">{row.total_sessions}</td>
                <td className="px-4 py-3"><PctBadge pct={row.avg_attendance} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Reports Page
// ---------------------------------------------------------------------------
const REPORT_TYPES: Array<{ id: ReportType; label: string; icon: React.ReactNode; desc: string }> = [
  { id: "student",    label: "Student",    icon: <User size={16} />,      desc: "Individual attendance by subject" },
  { id: "subject",    label: "Subject",    icon: <BookOpen size={16} />,  desc: "Per-student breakdown for a subject" },
  { id: "section",    label: "Section",    icon: <Users size={16} />,     desc: "Grid view: students × subjects" },
  { id: "department", label: "Department", icon: <Building2 size={16} />, desc: "Cross-section summary" },
];

export default function ReportsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "DEPARTMENT_ADMIN" || user?.role === "SUPER_ADMIN";
  const isFaculty = user?.role === "FACULTY";
  const isStudent = user?.role === "STUDENT";

  // Filter to relevant report types per role
  const availableTypes = REPORT_TYPES.filter((t) => {
    if (isStudent) return t.id === "student";
    if (isFaculty) return t.id !== "department";
    return true;
  });

  const [activeType, setActiveType] = useState<ReportType>(availableTypes[0].id);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [studentId, setStudentId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [deptId, setDeptId] = useState("");
  const [generate, setGenerate] = useState(false);

  const params: ReportParams = {
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    student_id: activeType === "student" && studentId ? studentId : undefined,
    subject_id: activeType === "subject" && subjectId ? subjectId : undefined,
    section_id: activeType === "section" && sectionId ? sectionId : undefined,
    department_id: activeType === "department" && deptId ? deptId : undefined,
  };

  const isParamMissing =
    (activeType === "subject" && !subjectId) ||
    (activeType === "section" && !sectionId) ||
    (activeType === "department" && !deptId);

  const { data: reportData, isLoading, isError, error } = useQuery({
    queryKey: ["report", activeType, params],
    queryFn: () => (reportsApi[activeType] as (p: ReportParams) => Promise<{ data: unknown }>)(params),
    enabled: generate && !isParamMissing,
    retry: false,
  });

  // Load students for admin/faculty filtering
  const { data: studentsList } = useQuery({
    queryKey: ["admin-students-all"],
    queryFn: () => studentsApi.list({ page_size: 200 }),
    enabled: (isAdmin || isFaculty) && activeType === "student",
  });

  // Load departments for admin
  const { data: deptList } = useQuery({
    queryKey: ["dept-list-all"],
    queryFn: () => departmentsApi.list({ status: "ACTIVE" }),
    enabled: isAdmin && activeType === "department",
  });

  function handleGenerate() {
    setGenerate(true);
  }

  function handleTypeChange(t: ReportType) {
    setActiveType(t);
    setGenerate(false);
  }

  const d = (reportData as any)?.data;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <p className="text-slate-400 text-sm mt-1">
          Generate and export attendance reports in CSV, Excel, or PDF
        </p>
      </div>

      {/* Report type tabs */}
      <div className="flex flex-wrap gap-2">
        {availableTypes.map((t) => (
          <button
            key={t.id}
            id={`report-tab-${t.id}`}
            onClick={() => handleTypeChange(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all
              ${activeType === t.id
                ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/30"
                : "bg-white/4 border-white/8 text-slate-400 hover:text-white hover:bg-white/7"
              }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Filter panel */}
      <div className="bg-white/3 border border-white/8 rounded-xl p-5 space-y-4">
        <h3 className="text-slate-300 text-sm font-semibold flex items-center gap-2">
          <Filter size={14} /> Filters
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date range */}
          <div>
            <label className="text-slate-500 text-xs mb-1.5 block">From Date</label>
            <input
              type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm
                         focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-slate-500 text-xs mb-1.5 block">To Date</label>
            <input
              type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm
                         focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Entity-specific filter */}
          {activeType === "student" && (isAdmin || isFaculty) && studentsList?.results && (
            <div>
              <label className="text-slate-500 text-xs mb-1.5 block">Student</label>
              <select
                value={studentId} onChange={(e) => setStudentId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm
                           focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="">My own report</option>
                {studentsList.results.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.full_name} ({s.student_id})</option>
                ))}
              </select>
            </div>
          )}

          {activeType === "department" && isAdmin && deptList && (
            <div>
              <label className="text-slate-500 text-xs mb-1.5 block">Department <span className="text-red-400">*</span></label>
              <select
                value={deptId} onChange={(e) => setDeptId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm
                           focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="">Select department…</option>
                {(deptList as any).results?.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          {(activeType === "subject" || activeType === "section") && (
            <div>
              <label className="text-slate-500 text-xs mb-1.5 block">
                {activeType === "subject" ? "Subject ID" : "Section ID"}{" "}
                <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="Paste UUID…"
                value={activeType === "subject" ? subjectId : sectionId}
                onChange={(e) =>
                  activeType === "subject"
                    ? setSubjectId(e.target.value)
                    : setSectionId(e.target.value)
                }
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm
                           focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          )}
        </div>

        <button
          id="generate-report-btn"
          onClick={handleGenerate}
          disabled={isParamMissing}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40
                     disabled:cursor-not-allowed text-white font-semibold text-sm px-5 py-2.5
                     rounded-xl transition-all hover:scale-[1.02] active:scale-95"
        >
          <RefreshCw size={14} /> Generate Report
        </button>
      </div>

      {/* Results area */}
      {generate && (
        <div className="space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {isError && (
            <div className="flex items-center gap-3 bg-red-950/30 border border-red-800/30 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <p className="text-red-300 text-sm">{(error as any)?.message ?? "Failed to generate report."}</p>
            </div>
          )}

          {d && (
            <>
              {/* Preview */}
              <div className="bg-white/3 border border-white/8 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <FileText size={16} className="text-indigo-400" />
                    Preview
                    {d.period && (
                      <span className="text-slate-500 text-xs font-normal ml-1">
                        {d.period.label}
                      </span>
                    )}
                  </h3>
                  <DownloadButtons type={activeType} params={params} disabled={false} />
                </div>

                {activeType === "student" && <StudentPreview data={d} />}
                {activeType === "subject" && <SubjectPreview data={d} />}
                {activeType === "section" && <SectionPreview data={d} />}
                {activeType === "department" && <DeptPreview data={d} />}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
