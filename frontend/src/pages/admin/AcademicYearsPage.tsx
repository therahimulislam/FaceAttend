import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, RefreshCw, Edit2, Trash2, Loader2, Calendar } from "lucide-react";
import { academicYearsApi, type AcademicYear } from "@/features/academics/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const schema = z.object({
  label: z.string().min(1, "Label is required"),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  is_current: z.boolean().default(false),
});
type FormData = z.infer<typeof schema>;

function AcademicYearFormModal({
  open, onClose, editTarget, onSaved,
}: {
  open: boolean; onClose: () => void; editTarget?: AcademicYear; onSaved: () => void;
}) {
  const isEdit = !!editTarget;

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: editTarget
        ? {
            label: editTarget.label,
            start_date: editTarget.start_date.slice(0, 10),
            end_date: editTarget.end_date.slice(0, 10),
            is_current: editTarget.is_current,
          }
        : { is_current: false },
    });

  const onSubmit = async (data: FormData) => {
    if (isEdit && editTarget) {
      await academicYearsApi.update(editTarget.id, data);
    } else {
      await academicYearsApi.create(data);
    }
    reset();
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={() => { reset(); onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Academic Year" : "Create Academic Year"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Label *</Label>
            <Input placeholder="e.g. 2024-25" className="bg-white/5 border-white/10 text-white h-10" {...register("label")} />
            {errors.label && <p className="text-red-400 text-xs">{errors.label.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Start Date *</Label>
              <Input type="date" className="bg-white/5 border-white/10 text-white h-10" {...register("start_date")} />
              {errors.start_date && <p className="text-red-400 text-xs">{errors.start_date.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">End Date *</Label>
              <Input type="date" className="bg-white/5 border-white/10 text-white h-10" {...register("end_date")} />
              {errors.end_date && <p className="text-red-400 text-xs">{errors.end_date.message}</p>}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/5">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_current" className="w-4 h-4 rounded border-white/10 bg-white/5" {...register("is_current")} />
              <label htmlFor="is_current" className="text-white text-sm">Mark this year as the currently active one</label>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : isEdit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AcademicYearsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AcademicYear | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<AcademicYear | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["academic-years", "all"],
    queryFn: () => academicYearsApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => academicYearsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
      setDeleteTarget(null);
    },
  });

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="text-emerald-400" /> Academic Years
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage global academic year definitions.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button variant="outline" className="h-10 px-3 bg-white/5 border-white/10" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={18} className={isFetching ? "animate-spin text-slate-400" : "text-slate-400"} />
          </Button>
          <Button className="h-10 flex-1 sm:flex-none" onClick={() => { setEditTarget(undefined); setModalOpen(true); }}>
            <Plus size={18} className="mr-2" /> New Year
          </Button>
        </div>
      </div>

      <div className="bg-[#1a1b23] border border-white/8 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-emerald-400" size={32} /></div>
        ) : !data?.results?.length ? (
          <div className="p-12 text-center">
            <Calendar className="mx-auto text-slate-600 mb-3" size={40} />
            <h3 className="text-white font-medium">No Academic Years found</h3>
            <p className="text-slate-500 text-sm mt-1 mb-4">Create your first academic year to get started.</p>
            <Button onClick={() => setModalOpen(true)}><Plus size={18} className="mr-2" /> Create Academic Year</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/8">
                  {["Label", "Start Date", "End Date", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.results.map((y) => (
                  <tr key={y.id} className="border-b border-white/5 hover:bg-white/3 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="text-white font-medium text-sm">{y.label}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-300 text-sm">
                        {new Date(y.start_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-300 text-sm">
                        {new Date(y.end_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {y.is_current ? (
                        <Badge variant="success">Current</Badge>
                      ) : (
                        <Badge variant="secondary">Past / Upcoming</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-white" onClick={() => { setEditTarget(y); setModalOpen(true); }}>
                          <Edit2 size={15} />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-red-400" onClick={() => setDeleteTarget(y)}>
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AcademicYearFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(undefined); }}
        editTarget={editTarget}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["academic-years"] })}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Academic Year?</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-slate-300 text-sm">
            Are you sure you want to delete <span className="text-white font-medium">{deleteTarget?.label}</span>?
            This will cascade and delete all associated semesters and sections. This action cannot be undone.
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
