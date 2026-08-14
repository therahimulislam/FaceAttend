/**
 * FaceAttend — Admin Subjects Page (Phase 4)
 * CRUD management for academic subjects, filterable by department.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, RefreshCw, BookOpen, Edit2, Trash2, Loader2 } from "lucide-react";

import { subjectsApi, type Subject } from "@/features/academics/api";
import { departmentsApi } from "@/features/departments/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  code: z.string().min(2, "Code required").max(20).toUpperCase(),
  name: z.string().min(2, "Name required"),
  department: z.string().min(1, "Department required"),
  credits: z.coerce.number().int().min(1).max(10).default(3),
  hours_per_week: z.coerce.number().int().min(1).max(20).default(3),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});
type FormData = z.infer<typeof schema>;

function SubjectModal({
  open,
  onClose,
  editTarget,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editTarget?: Subject;
  onSaved: () => void;
}) {
  const isEdit = !!editTarget;
  const { data: deptData } = useQuery({
    queryKey: ["departments", "all"],
    queryFn: () => departmentsApi.list({ status: "ACTIVE", page_size: 100 }),
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: editTarget
      ? {
          code: editTarget.code,
          name: editTarget.name,
          department: editTarget.department,
          credits: editTarget.credits,
          hours_per_week: editTarget.hours_per_week,
          status: editTarget.status,
        }
      : { credits: 3, hours_per_week: 3, status: "ACTIVE" },
  });

  const onSubmit = async (data: FormData) => {
    if (isEdit && editTarget) {
      await subjectsApi.update(editTarget.id, data);
    } else {
      await subjectsApi.create(data);
    }
    reset();
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Subject" : "Add Subject"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Code *</Label>
              <Input
                placeholder="CS301"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-10 uppercase"
                {...register("code")}
              />
              {errors.code && <p className="text-red-400 text-xs">{errors.code.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Credits</Label>
              <Input
                type="number"
                min={1}
                max={10}
                className="bg-white/5 border-white/10 text-white h-10"
                {...register("credits")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Subject Name *</Label>
            <Input
              placeholder="Data Structures & Algorithms"
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-10"
              {...register("name")}
            />
            {errors.name && <p className="text-red-400 text-xs">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Department *</Label>
              <Select
                value={watch("department")}
                onValueChange={(v) => setValue("department", v)}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {deptData?.results.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.department && <p className="text-red-400 text-xs">{errors.department.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Hours/Week</Label>
              <Input
                type="number"
                min={1}
                max={20}
                className="bg-white/5 border-white/10 text-white h-10"
                {...register("hours_per_week")}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" size="sm"
              className="border-white/10 text-slate-300 hover:bg-white/5"
              onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm"
              className="bg-white text-slate-900 hover:bg-white/90"
              disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" size={14} />}
              {isEdit ? "Save Changes" : "Add Subject"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SubjectsPage() {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Subject | undefined>();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["subjects", search, deptFilter],
    queryFn: () =>
      subjectsApi.list({
        search: search || undefined,
        department: deptFilter || undefined,
        page_size: 100,
      }),
  });

  const { data: deptData } = useQuery({
    queryKey: ["departments", "all"],
    queryFn: () => departmentsApi.list({ status: "ACTIVE", page_size: 100 }),
  });

  const softDelete = useMutation({
    mutationFn: subjectsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subjects"] }),
  });

  const subjects = data?.results ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Subjects</h1>
          <p className="text-slate-400 text-sm mt-1">{data?.count ?? 0} subjects across all departments</p>
        </div>
        <Button size="sm" className="bg-white text-slate-900 hover:bg-white/90" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Add Subject
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Search by code or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-9 text-sm"
          />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-52 bg-white/5 border-white/10 text-white h-9 text-sm">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All departments</SelectItem>
            {deptData?.results.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="border-white/10 text-slate-300 hover:bg-white/5" onClick={() => refetch()}>
          <RefreshCw size={13} />
        </Button>
      </div>

      <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="animate-spin text-slate-500" size={20} />
          </div>
        ) : subjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <BookOpen className="w-10 h-10 text-slate-700 mb-3" />
            <p className="text-slate-400 text-sm">No subjects found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/8">
                {["Code", "Subject", "Department", "Credits", "Hrs/Week", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id} className="border-b border-white/5 hover:bg-white/3 transition-colors group">
                  <td className="px-4 py-3"><span className="font-mono text-slate-200 text-sm">{s.code}</span></td>
                  <td className="px-4 py-3"><p className="text-white text-sm">{s.name}</p></td>
                  <td className="px-4 py-3"><p className="text-slate-400 text-sm">{s.department_name}</p></td>
                  <td className="px-4 py-3"><span className="text-slate-300 text-sm">{s.credits}</span></td>
                  <td className="px-4 py-3"><span className="text-slate-300 text-sm">{s.hours_per_week}</span></td>
                  <td className="px-4 py-3">
                    <Badge variant={s.status === "ACTIVE" ? "success" : "secondary"} className="text-xs">
                      {s.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditTarget(s)} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => softDelete.mutate(s.id)} className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
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

      <SubjectModal open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["subjects"] })} />
      {editTarget && (
        <SubjectModal open={true} onClose={() => setEditTarget(undefined)}
          editTarget={editTarget}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["subjects"] })} />
      )}
    </div>
  );
}
