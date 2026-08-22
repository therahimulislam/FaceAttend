/**
 * FaceAttend — Admin Student Management Page
 * Lists all student registrations with filtering and full lifecycle actions:
 * Approve (with Dept/Semester/Section allotment), Reject, Suspend, Complete, Delete.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CheckCircle, XCircle, Clock, Ban, Search, RefreshCw,
  GraduationCap, Loader2, AlertCircle, Trash2, Award, ShieldAlert,
} from "lucide-react";
import { studentsApi } from "@/features/students/api";
import { departmentsApi } from "@/features/departments/api";
import { semestersApi, sectionsApi } from "@/features/academics/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Student, ApprovalStatus } from "@/types";
import { useAuthStore } from "@/store/authStore";

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  ApprovalStatus,
  { label: string; color: "default" | "success" | "destructive" | "warning" | "secondary" | "outline"; icon: React.ElementType }
> = {
  PENDING:   { label: "Pending",   color: "warning",     icon: Clock },
  APPROVED:  { label: "Approved",  color: "success",     icon: CheckCircle },
  REJECTED:  { label: "Rejected",  color: "destructive", icon: XCircle },
  SUSPENDED: { label: "Suspended", color: "secondary",   icon: Ban },
  COMPLETED: { label: "Completed", color: "outline",     icon: Award },
};

const FILTER_OPTIONS = [
  { label: "All",       value: "" },
  { label: "Pending",   value: "PENDING" },
  { label: "Approved",  value: "APPROVED" },
  { label: "Rejected",  value: "REJECTED" },
  { label: "Suspended", value: "SUSPENDED" },
  { label: "Completed", value: "COMPLETED" },
];

// ── Approve Modal Schema ───────────────────────────────────────────────────────
const approveSchema = z.object({
  department: z.string().min(1, "Please select a department"),
  semester:   z.string().min(1, "Please select a semester"),
  section:    z.string().min(1, "Please select a section"),
});
type ApproveFormData = z.infer<typeof approveSchema>;

// ── Approve Student Modal ──────────────────────────────────────────────────────
function ApproveStudentModal({
  student,
  onClose,
  onConfirm,
  isLoading,
}: {
  student: Student;
  onClose: () => void;
  onConfirm: (data: ApproveFormData) => void;
  isLoading: boolean;
}) {
  const { control, handleSubmit, watch, formState: { errors } } = useForm<ApproveFormData>({
    resolver: zodResolver(approveSchema),
    defaultValues: {
      department: student.department || "",
      semester:   student.semester || "",
      section:    student.section || "",
    },
  });

  const selectedDept = watch("department");
  const selectedSem  = watch("semester");

  const { data: depts } = useQuery({
    queryKey: ["departments", "all"],
    queryFn:  () => departmentsApi.list({ status: "ACTIVE", page_size: 100 }),
  });
  const { data: semesters } = useQuery({
    queryKey: ["semesters-approve", selectedDept],
    queryFn:  () => semestersApi.list({ department: selectedDept, status: "ACTIVE", page_size: 100 }),
    enabled:  !!selectedDept,
  });
  const { data: sections } = useQuery({
    queryKey: ["sections-approve", selectedSem],
    queryFn:  () => sectionsApi.list({ semester: selectedSem, page_size: 100 }),
    enabled:  !!selectedSem,
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Approve &amp; Allot Student</DialogTitle>
          <DialogDescription className="text-slate-400">
            Assign <span className="text-white font-medium">{student.full_name}</span> to their
            department, semester and section before approving.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onConfirm)} className="space-y-4 pt-2">
          {/* Department */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Department *</Label>
            <Controller
              name="department"
              control={control}
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white h-10 text-sm">
                    <SelectValue placeholder="Select department…" />
                  </SelectTrigger>
                  <SelectContent className="z-[200]">
                    {depts?.results.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.department && <p className="text-red-400 text-xs">{errors.department.message}</p>}
          </div>

          {/* Semester */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Semester *</Label>
            <Controller
              name="semester"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                  disabled={!selectedDept}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white h-10 text-sm disabled:opacity-50">
                    <SelectValue placeholder={selectedDept ? "Select semester…" : "Select department first"} />
                  </SelectTrigger>
                  <SelectContent className="z-[200]">
                    {semesters?.results.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.semester && <p className="text-red-400 text-xs">{errors.semester.message}</p>}
          </div>

          {/* Section */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Section *</Label>
            <Controller
              name="section"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                  disabled={!selectedSem}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white h-10 text-sm disabled:opacity-50">
                    <SelectValue placeholder={selectedSem ? "Select section…" : "Select semester first"} />
                  </SelectTrigger>
                  <SelectContent className="z-[200]">
                    {sections?.results.map((sec) => (
                      <SelectItem key={sec.id} value={sec.id}>Section {sec.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.section && <p className="text-red-400 text-xs">{errors.section.message}</p>}
          </div>

          {/* Student's own claimed department for reference */}
          {student.department_display && (
            <div className="bg-blue-950/30 border border-blue-800/30 rounded-lg px-3 py-2 text-xs text-blue-300">
              <span className="font-medium">Student's self-declared:</span>{" "}
              {student.department_display}
              {student.semester_display ? ` · ${student.semester_display}` : ""}
              {student.section_display  ? ` · Sec ${student.section_display}` : ""}
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" size="sm"
              className="border-white/10 text-slate-300 hover:bg-white/5" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white" disabled={isLoading}>
              {isLoading && <Loader2 className="animate-spin" size={13} />}
              Confirm Approval
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────────
function DeleteConfirmModal({
  student,
  onClose,
  onConfirm,
  isLoading,
}: {
  student: Student;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-red-400 flex items-center gap-2">
            <Trash2 size={18} /> Delete Student
          </DialogTitle>
          <DialogDescription className="text-slate-400 pt-2">
            This will <span className="text-red-400 font-medium">permanently delete</span> the account
            of <span className="text-white font-medium">{student.full_name}</span> ({student.student_id}).
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" size="sm"
            className="border-white/10 text-slate-300 hover:bg-white/5" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="animate-spin" size={13} />}
            Yes, Delete Permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Student Row ────────────────────────────────────────────────────────────────
function StudentRow({
  student,
  onApprove,
  onReject,
  onSuspend,
  onComplete,
  onDelete,
  isFaculty,
}: {
  student: Student;
  onApprove:  (student: Student) => void;
  onReject:   (id: string) => void;
  onSuspend:  (id: string) => void;
  onComplete: (id: string) => void;
  onDelete:   (student: Student) => void;
  isFaculty: boolean;
}) {
  const cfg = STATUS_CONFIG[student.approval_status];
  const Icon = cfg.icon;

  const pct = student.overall_attendance ?? 0;
  const pctColor = pct >= 75 ? "text-emerald-400" : pct >= 60 ? "text-amber-400" : "text-red-400";

  return (
    <tr className="border-b border-white/5 hover:bg-white/3 transition-colors group">
      {/* Student */}
      <td className="px-4 py-3">
        <p className="text-white font-medium text-sm">{student.full_name}</p>
        <p className="text-slate-500 text-xs mt-0.5">{student.email}</p>
      </td>
      {/* Student ID */}
      <td className="px-4 py-3">
        <span className="font-mono text-slate-300 text-sm">{student.student_id}</span>
      </td>
      {/* Department / Sem / Sec */}
      <td className="px-4 py-3">
        <p className="text-slate-300 text-sm">{student.department_display || "—"}</p>
        <p className="text-slate-600 text-xs">
          {student.semester_display || ""}
          {student.section_display ? ` · Sec ${student.section_display}` : ""}
        </p>
      </td>
      {/* Status */}
      <td className="px-4 py-3">
        <Badge variant={cfg.color} className="gap-1">
          <Icon size={11} /> {cfg.label}
        </Badge>
      </td>
      {/* Registered */}
      <td className="px-4 py-3">
        <span className="text-slate-500 text-xs">
          {new Date(student.created_at).toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
          })}
        </span>
      </td>
      {/* Attendance % */}
      <td className="px-4 py-3">
        <span className={`font-semibold text-sm ${pctColor}`}>
          {pct}%
        </span>
      </td>
      {/* Actions */}
      <td className="px-4 py-3">
        {!isFaculty && (
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-wrap">
            {student.approval_status === "PENDING" && (
            <>
              <Button size="sm"
                className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                onClick={() => onApprove(student)}>
                <CheckCircle size={11} /> Approve
              </Button>
              <Button size="sm" variant="destructive"
                className="h-7 px-2.5 text-xs"
                onClick={() => onReject(student.id)}>
                <XCircle size={11} /> Reject
              </Button>
            </>
          )}
          {student.approval_status === "APPROVED" && (
            <>
              <Button size="sm" variant="outline"
                className="h-7 px-2.5 text-xs border-amber-700/40 text-amber-400 hover:bg-amber-950/30"
                onClick={() => onSuspend(student.id)}>
                <ShieldAlert size={11} /> Suspend
              </Button>
              <Button size="sm" variant="outline"
                className="h-7 px-2.5 text-xs border-sky-700/40 text-sky-400 hover:bg-sky-950/30"
                onClick={() => onComplete(student.id)}>
                <Award size={11} /> Complete
              </Button>
            </>
          )}
          {student.approval_status === "SUSPENDED" && (
            <Button size="sm" variant="outline"
              className="h-7 px-2.5 text-xs border-sky-700/40 text-sky-400 hover:bg-sky-950/30"
              onClick={() => onComplete(student.id)}>
              <Award size={11} /> Complete
            </Button>
          )}
          <Button size="sm" variant="outline"
            className="h-7 px-2.5 text-xs border-red-900/40 text-red-400 hover:bg-red-950/30"
            onClick={() => onDelete(student)}>
            <Trash2 size={11} />
          </Button>
        </div>
        )}
      </td>
    </tr>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function StudentsPage() {
  const [search, setSearch]                     = useState("");
  const [statusFilter, setStatusFilter]         = useState("");
  const [approveTarget, setApproveTarget]       = useState<Student | null>(null);
  const [deleteTarget, setDeleteTarget]         = useState<Student | null>(null);
  const queryClient = useQueryClient();
  const user = useAuthStore((s: any) => s.user);
  const isFaculty = user?.role === "FACULTY";

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-students", search, statusFilter],
    queryFn: () => studentsApi.list({
      search: search || undefined,
      approval_status: statusFilter || undefined,
      page_size: 50,
    }),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApproveFormData }) =>
      studentsApi.approve(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      setApproveTarget(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => studentsApi.reject(id, "Registration could not be verified."),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-students"] }),
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => studentsApi.suspend(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-students"] }),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => studentsApi.complete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-students"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => studentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      setDeleteTarget(null);
    },
  });

  const students     = data?.results ?? [];
  const total        = data?.count ?? 0;
  const pendingCount = students.filter((s) => s.approval_status === "PENDING").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Students</h1>
          <p className="text-slate-400 text-sm mt-1">
            {total} total ·{" "}
            <span className="text-amber-400">{pendingCount} pending approval</span>
          </p>
        </div>
        <Button variant="outline" size="sm"
          className="border-white/10 text-slate-300 hover:bg-white/5" onClick={() => refetch()}>
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Search by name, ID or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1 flex-wrap">
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
                {["Student", "Student ID", "Department / Section", "Status", "Registered", "Attendance %", "Actions"].map((h) => (
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
                  onApprove={setApproveTarget}
                  onReject={(id) => rejectMutation.mutate(id)}
                  onSuspend={(id) => suspendMutation.mutate(id)}
                  onComplete={(id) => completeMutation.mutate(id)}
                  onDelete={setDeleteTarget}
                  isFaculty={isFaculty}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Approve Modal */}
      {approveTarget && (
        <ApproveStudentModal
          student={approveTarget}
          onClose={() => setApproveTarget(null)}
          onConfirm={(formData) =>
            approveMutation.mutate({ id: approveTarget.id, data: formData })
          }
          isLoading={approveMutation.isPending}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          student={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          isLoading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
