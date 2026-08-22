/**
 * FaceAttend — Admin Semesters Management Page
 * Full CRUD for semesters, cascaded by department.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Search, RefreshCw, BookOpen, Edit2, Trash2, Loader2, CalendarDays,
} from "lucide-react";
import { semestersApi, type Semester } from "@/features/academics/api";
import { departmentsApi } from "@/features/departments/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const schema = z.object({
  name:        z.string().min(1, "Name is required"),
  department:  z.string().min(1, "Department is required"),
  year:        z.coerce.number().int().min(1).max(8),
  start_date:  z.string().optional(),
  end_date:    z.string().optional(),
  is_current:  z.boolean().default(false),
  status:      z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});
type FormData = z.infer<typeof schema>;

function SemesterFormModal({
  open, onClose, editTarget, onSaved,
}: {
  open: boolean; onClose: () => void; editTarget?: Semester; onSaved: () => void;
}) {
  const isEdit = !!editTarget;
  const { data: depts } = useQuery({
    queryKey: ["departments", "all"],
    queryFn: () => departmentsApi.list({ status: "ACTIVE", page_size: 100 }),
  });

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: editTarget
        ? {
            name:       editTarget.name,
            department: editTarget.department,
            year:       editTarget.year,
            start_date: editTarget.start_date?.slice(0, 10),
            end_date:   editTarget.end_date?.slice(0, 10),
            is_current: editTarget.is_current,
            status:     editTarget.status as "ACTIVE" | "INACTIVE",
          }
        : { year: 1, status: "ACTIVE", is_current: false },
    });

  const onSubmit = async (data: FormData) => {
    if (isEdit && editTarget) {
      await semestersApi.update(editTarget.id, data);
    } else {
      await semestersApi.create(data);
    }
    reset();
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={() => { reset(); onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Semester" : "Create Semester"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Department */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Department *</Label>
            <Controller name="department" control={control} render={({ field }) => (
              <Select value={field.value || undefined} onValueChange={field.onChange}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-10 text-sm">
                  <SelectValue placeholder="Select department…" />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  {depts?.results.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )} />
            {errors.department && <p className="text-red-400 text-xs">{errors.department.message}</p>}
          </div>

          {/* Name + Year */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Semester Name *</Label>
              <Input placeholder="e.g. Semester 1" className="bg-white/5 border-white/10 text-white h-10" {...register("name")} />
              {errors.name && <p className="text-red-400 text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Year (1–8)</Label>
              <Input type="number" min={1} max={8} className="bg-white/5 border-white/10 text-white h-10" {...register("year")} />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Start Date</Label>
              <Input type="date" className="bg-white/5 border-white/10 text-white h-10" {...register("start_date")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">End Date</Label>
              <Input type="date" className="bg-white/5 border-white/10 text-white h-10" {...register("end_date")} />
            </div>
          </div>

          {/* Status + Current */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Status</Label>
              <Controller name="status" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[200]">
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Mark as Current</Label>
              <div className="flex items-center h-10 gap-2">
                <input type="checkbox" id="is_current" className="w-4 h-4 accent-white" {...register("is_current")} />
                <label htmlFor="is_current" className="text-slate-400 text-sm">Is current semester</label>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" size="sm"
              className="border-white/10 text-slate-300 hover:bg-white/5" onClick={() => { reset(); onClose(); }}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="bg-white text-slate-900 hover:bg-white/90" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" size={14} />}
              {isEdit ? "Save Changes" : "Create Semester"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SemestersPage() {
  const [deptFilter, setDeptFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Semester | undefined>();
  const queryClient = useQueryClient();

  const { data: depts } = useQuery({
    queryKey: ["departments", "all"],
    queryFn: () => departmentsApi.list({ status: "ACTIVE", page_size: 100 }),
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["semesters-admin", deptFilter],
    queryFn: () => semestersApi.list({ department: deptFilter || undefined, page_size: 100 }),
  });

  const deleteMutation = useMutation({
    mutationFn: semestersApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["semesters-admin"] }),
  });

  const semesters = data?.results ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Semesters</h1>
          <p className="text-slate-400 text-sm mt-1">{data?.count ?? 0} semesters</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-white/10 text-slate-300 hover:bg-white/5" onClick={() => refetch()}>
            <RefreshCw size={13} />
          </Button>
          <Button size="sm" className="bg-white text-slate-900 hover:bg-white/90" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> New Semester
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-52 bg-white/5 border-white/10 text-white h-9 text-sm">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All departments</SelectItem>
            {depts?.results.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><RefreshCw className="animate-spin text-slate-500" size={20} /></div>
        ) : semesters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <CalendarDays className="w-10 h-10 text-slate-700 mb-3" />
            <p className="text-slate-400 text-sm">No semesters found</p>
            <button className="mt-3 text-sm text-white underline underline-offset-4" onClick={() => setCreateOpen(true)}>
              Create first semester
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/8">
                {["Semester", "Department", "Year", "Dates", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {semesters.map((sem) => (
                <tr key={sem.id} className="border-b border-white/5 hover:bg-white/3 transition-colors group">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium text-sm">{sem.name}</p>
                    {sem.is_current && <span className="text-xs text-emerald-400">● Current</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-sm">{sem.department_name || "—"}</td>
                  <td className="px-4 py-3 text-slate-400 text-sm">Year {sem.year}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {sem.start_date ? sem.start_date.slice(0, 10) : "—"} → {sem.end_date ? sem.end_date.slice(0, 10) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={sem.status === "ACTIVE" ? "success" : "secondary"} className="text-xs">{sem.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditTarget(sem)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => deleteMutation.mutate(sem.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SemesterFormModal open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["semesters-admin"] })} />
      {editTarget && (
        <SemesterFormModal open={true} onClose={() => setEditTarget(undefined)} editTarget={editTarget}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["semesters-admin"] })} />
      )}
    </div>
  );
}
