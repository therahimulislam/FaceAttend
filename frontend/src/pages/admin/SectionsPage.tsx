/**
 * FaceAttend — Admin Sections Management Page
 * Full CRUD for sections, cascaded by department → semester.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, RefreshCw, Edit2, Trash2, Loader2, Users2 } from "lucide-react";
import { sectionsApi, semestersApi, type Section } from "@/features/academics/api";
import { departmentsApi } from "@/features/departments/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const schema = z.object({
  name:     z.string().min(1, "Section name is required"),
  semester: z.string().min(1, "Semester is required"),
  capacity: z.coerce.number().int().min(1).max(500).default(60),
  status:   z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});
type FormData = z.infer<typeof schema>;

function SectionFormModal({
  open, onClose, editTarget, onSaved,
}: {
  open: boolean; onClose: () => void; editTarget?: Section; onSaved: () => void;
}) {
  const isEdit = !!editTarget;
  const [selectedDept, setSelectedDept] = useState("");

  const { data: depts } = useQuery({
    queryKey: ["departments", "all"],
    queryFn: () => departmentsApi.list({ status: "ACTIVE", page_size: 100 }),
  });
  const { data: semesters } = useQuery({
    queryKey: ["semesters-for-sections", selectedDept],
    queryFn: () => semestersApi.list({ department: selectedDept, status: "ACTIVE", page_size: 100 }),
    enabled: !!selectedDept,
  });

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: editTarget
        ? { name: editTarget.name, semester: editTarget.semester, capacity: editTarget.capacity, status: editTarget.status }
        : { capacity: 60, status: "ACTIVE" },
    });

  const onSubmit = async (data: FormData) => {
    if (isEdit && editTarget) {
      await sectionsApi.update(editTarget.id, data);
    } else {
      await sectionsApi.create(data);
    }
    reset();
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={() => { reset(); onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Section" : "Create Section"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Department (not stored — drives semester filter) */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Department</Label>
            <Select value={selectedDept || undefined} onValueChange={setSelectedDept}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white h-10 text-sm">
                <SelectValue placeholder="Select department first…" />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                {depts?.results.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Semester */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Semester *</Label>
            <Controller name="semester" control={control} render={({ field }) => (
              <Select value={field.value || undefined} onValueChange={field.onChange} disabled={!selectedDept}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-10 text-sm disabled:opacity-50">
                  <SelectValue placeholder={selectedDept ? "Select semester…" : "Pick department first"} />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  {semesters?.results.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )} />
            {errors.semester && <p className="text-red-400 text-xs">{errors.semester.message}</p>}
          </div>

          {/* Name + Capacity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Section Name *</Label>
              <Input placeholder="e.g. A or CS-A" className="bg-white/5 border-white/10 text-white h-10" {...register("name")} />
              {errors.name && <p className="text-red-400 text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Capacity</Label>
              <Input type="number" min={1} max={500} className="bg-white/5 border-white/10 text-white h-10" {...register("capacity")} />
            </div>
          </div>

          {/* Status */}
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

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" size="sm"
              className="border-white/10 text-slate-300 hover:bg-white/5" onClick={() => { reset(); onClose(); }}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="bg-white text-slate-900 hover:bg-white/90" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" size={14} />}
              {isEdit ? "Save Changes" : "Create Section"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SectionsPage() {
  const [deptFilter, setDeptFilter]   = useState("");
  const [semFilter,  setSemFilter]    = useState("");
  const [createOpen, setCreateOpen]   = useState(false);
  const [editTarget, setEditTarget]   = useState<Section | undefined>();
  const queryClient = useQueryClient();

  const { data: depts } = useQuery({
    queryKey: ["departments", "all"],
    queryFn: () => departmentsApi.list({ status: "ACTIVE", page_size: 100 }),
  });
  const { data: semesterList } = useQuery({
    queryKey: ["semesters-filter", deptFilter],
    queryFn: () => semestersApi.list({ department: deptFilter || undefined, status: "ACTIVE", page_size: 100 }),
  });
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["sections-admin", semFilter],
    queryFn: () => sectionsApi.list({ semester: semFilter || undefined, page_size: 200 }),
  });

  const deleteMutation = useMutation({
    mutationFn: sectionsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sections-admin"] }),
  });

  const sections = data?.results ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sections</h1>
          <p className="text-slate-400 text-sm mt-1">{data?.count ?? 0} sections</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-white/10 text-slate-300 hover:bg-white/5" onClick={() => refetch()}>
            <RefreshCw size={13} />
          </Button>
          <Button size="sm" className="bg-white text-slate-900 hover:bg-white/90" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> New Section
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={deptFilter} onValueChange={(v) => { setDeptFilter(v); setSemFilter(""); }}>
          <SelectTrigger className="w-48 bg-white/5 border-white/10 text-white h-9 text-sm">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All departments</SelectItem>
            {depts?.results.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={semFilter} onValueChange={setSemFilter}>
          <SelectTrigger className="w-48 bg-white/5 border-white/10 text-white h-9 text-sm">
            <SelectValue placeholder="All semesters" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All semesters</SelectItem>
            {semesterList?.results.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><RefreshCw className="animate-spin text-slate-500" size={20} /></div>
        ) : sections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users2 className="w-10 h-10 text-slate-700 mb-3" />
            <p className="text-slate-400 text-sm">No sections found</p>
            <button className="mt-3 text-sm text-white underline underline-offset-4" onClick={() => setCreateOpen(true)}>
              Create first section
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/8">
                {["Section", "Semester", "Capacity", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sections.map((sec) => (
                <tr key={sec.id} className="border-b border-white/5 hover:bg-white/3 transition-colors group">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium text-sm">Section {sec.name}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-sm">{sec.semester_name || "—"}</td>
                  <td className="px-4 py-3 text-slate-400 text-sm">{sec.capacity} seats</td>
                  <td className="px-4 py-3">
                    <Badge variant={sec.status === "ACTIVE" ? "success" : "secondary"} className="text-xs">{sec.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditTarget(sec)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => deleteMutation.mutate(sec.id)}
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

      <SectionFormModal open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["sections-admin"] })} />
      {editTarget && (
        <SectionFormModal open={true} onClose={() => setEditTarget(undefined)} editTarget={editTarget}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["sections-admin"] })} />
      )}
    </div>
  );
}
