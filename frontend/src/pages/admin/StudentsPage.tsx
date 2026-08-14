/**
 * FaceAttend — Admin Student Management Page
 * Lists all student registrations with filtering and approve/reject actions.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle, XCircle, Clock, Ban, Search, RefreshCw,
  GraduationCap, Filter, ChevronDown,
} from "lucide-react";
import { studentsApi } from "@/features/students/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Student, ApprovalStatus } from "@/types";

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; color: "default" | "success" | "destructive" | "warning" | "secondary" | "outline"; icon: React.ElementType }> = {
  PENDING:   { label: "Pending",   color: "warning",     icon: Clock },
  APPROVED:  { label: "Approved",  color: "success",     icon: CheckCircle },
  REJECTED:  { label: "Rejected",  color: "destructive", icon: XCircle },
  SUSPENDED: { label: "Suspended", color: "secondary",   icon: Ban },
};

const FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: "All",       value: "" },
  { label: "Pending",   value: "PENDING" },
  { label: "Approved",  value: "APPROVED" },
  { label: "Rejected",  value: "REJECTED" },
  { label: "Suspended", value: "SUSPENDED" },
];

function StudentRow({
  student,
  onApprove,
  onReject,
}: {
  student: Student;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const cfg = STATUS_CONFIG[student.approval_status];
  const Icon = cfg.icon;

  return (
    <tr className="border-b border-white/5 hover:bg-white/3 transition-colors group">
      {/* Student */}
      <td className="px-4 py-3">
        <div>
          <p className="text-white font-medium text-sm">{student.full_name}</p>
          <p className="text-slate-500 text-xs mt-0.5">{student.email}</p>
        </div>
      </td>
      {/* Student ID */}
      <td className="px-4 py-3">
        <span className="font-mono text-slate-300 text-sm">{student.student_id}</span>
      </td>
      {/* Department */}
      <td className="px-4 py-3">
        <p className="text-slate-300 text-sm">{student.department_display || "—"}</p>
        <p className="text-slate-600 text-xs">{student.semester_display} / {student.section_display}</p>
      </td>
      {/* Status */}
      <td className="px-4 py-3">
        <Badge variant={cfg.color} className="gap-1">
          <Icon size={11} />
          {cfg.label}
        </Badge>
      </td>
      {/* Registered */}
      <td className="px-4 py-3">
        <span className="text-slate-500 text-xs">
          {new Date(student.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
      </td>
      {/* Actions */}
      <td className="px-4 py-3">
        {student.approval_status === "PENDING" && (
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              className="h-7 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
              onClick={() => onApprove(student.id)}
            >
              <CheckCircle size={11} /> Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 px-3 text-xs"
              onClick={() => onReject(student.id)}
            >
              <XCircle size={11} /> Reject
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function StudentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-students", search, statusFilter],
    queryFn: () =>
      studentsApi.list({
        search: search || undefined,
        approval_status: statusFilter || undefined,
        page_size: 50,
      }),
  });

  const approve = useMutation({
    mutationFn: (id: string) => studentsApi.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-students"] }),
  });

  const reject = useMutation({
    mutationFn: (id: string) => studentsApi.reject(id, "Registration could not be verified."),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-students"] }),
  });

  const students = data?.results ?? [];
  const total = data?.count ?? 0;

  const pendingCount = students.filter((s) => s.approval_status === "PENDING").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Students</h1>
          <p className="text-slate-400 text-sm mt-1">
            {total} total · <span className="text-amber-400">{pendingCount} pending approval</span>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-white/10 text-slate-300 hover:bg-white/5"
          onClick={() => refetch()}
        >
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Search by name, ID or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-9 text-sm"
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                statusFilter === opt.value
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="animate-spin text-slate-500" size={20} />
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <GraduationCap className="w-10 h-10 text-slate-700 mb-3" />
            <p className="text-slate-400 text-sm">No students found</p>
            <p className="text-slate-600 text-xs mt-1">Try adjusting your search or filter</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/8">
                {["Student", "Student ID", "Department", "Status", "Registered", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <StudentRow
                  key={student.id}
                  student={student}
                  onApprove={(id) => approve.mutate(id)}
                  onReject={(id) => reject.mutate(id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
