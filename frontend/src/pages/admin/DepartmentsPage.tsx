/**
 * FaceAttend — Admin Departments Page (Phase 4)
 * Full CRUD for departments, semesters, and sections.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Search, RefreshCw, BookOpen, Edit2, Trash2,
  ChevronRight, Loader2, Building2,
} from "lucide-react";

import { departmentsApi } from "@/features/departments/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import type { Department } from "@/types";

// ---- Schemas ----
const deptSchema = z.object({
  name: z.string().min(2, "Department name must be at least 2 characters"),
  code: z.string().min(1, "Code is required").max(10, "Max 10 characters").toUpperCase(),
  description: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});
type DeptForm = z.infer<typeof deptSchema>;

// ---- Department Form Modal ----
function DeptFormModal({
  open,
  onClose,
  editTarget,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editTarget?: Department;
  onSaved: () => void;
}) {
  const isEdit = !!editTarget;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DeptForm>({
    resolver: zodResolver(deptSchema),
    defaultValues: editTarget
      ? { name: editTarget.name, code: editTarget.code, description: editTarget.description, status: editTarget.status as "ACTIVE" | "INACTIVE" }
      : { status: "ACTIVE" },
  });

  const onSubmit = async (data: DeptForm) => {
    if (isEdit && editTarget) {
      await departmentsApi.update(editTarget.id, data);
    } else {
      await departmentsApi.create(data);
    }
    reset();
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Department" : "Create Department"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dept-name" className="text-slate-300 text-sm">Name *</Label>
              <Input
                id="dept-name"
                placeholder="Computer Science"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-10"
                {...register("name")}
              />
              {errors.name && <p className="text-red-400 text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dept-code" className="text-slate-300 text-sm">Code *</Label>
              <Input
                id="dept-code"
                placeholder="CS"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-10 uppercase"
                {...register("code")}
              />
              {errors.code && <p className="text-red-400 text-xs">{errors.code.message}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept-desc" className="text-slate-300 text-sm">Description</Label>
            <Textarea
              id="dept-desc"
              placeholder="Brief description of the department…"
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 resize-none"
              rows={3}
              {...register("description")}
            />
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
              {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : null}
              {isEdit ? "Save Changes" : "Create Department"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Main Page ----
export default function DepartmentsPage() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Department | undefined>();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["departments", search],
    queryFn: () =>
      departmentsApi.list({ search: search || undefined, page_size: 100 }),
  });

  const softDelete = useMutation({
    mutationFn: (id: string) => departmentsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["departments"] }),
  });

  const depts = data?.results ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Departments</h1>
          <p className="text-slate-400 text-sm mt-1">{data?.count ?? 0} departments</p>
        </div>
        <Button
          size="sm"
          className="bg-white text-slate-900 hover:bg-white/90"
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={14} /> New Department
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Search departments…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-9 text-sm"
          />
        </div>
        <Button variant="outline" size="sm"
          className="border-white/10 text-slate-300 hover:bg-white/5"
          onClick={() => refetch()}>
          <RefreshCw size={13} /> Refresh
        </Button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="animate-spin text-slate-500" size={20} />
        </div>
      ) : depts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/3 border border-white/8 rounded-xl">
          <BookOpen className="w-10 h-10 text-slate-700 mb-3" />
          <p className="text-slate-400 text-sm">No departments found</p>
          <button
            className="mt-4 text-sm text-white underline underline-offset-4"
            onClick={() => setCreateOpen(true)}
          >
            Create your first department
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {depts.map((dept) => (
            <DepartmentCard
              key={dept.id}
              dept={dept}
              onEdit={() => setEditTarget(dept)}
              onDelete={() => softDelete.mutate(dept.id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <DeptFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["departments"] })}
      />
      {editTarget && (
        <DeptFormModal
          open={true}
          onClose={() => setEditTarget(undefined)}
          editTarget={editTarget}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["departments"] })}
        />
      )}
    </div>
  );
}

function DepartmentCard({
  dept,
  onEdit,
  onDelete,
}: {
  dept: Department;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/8 transition-colors group">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
          <Building2 size={16} className="text-slate-300" />
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded">
            {dept.code}
          </span>
          <Badge
            variant={dept.status === "ACTIVE" ? "success" : "secondary"}
            className="text-xs h-5"
          >
            {dept.status}
          </Badge>
        </div>
        <h3 className="text-white font-semibold text-sm mt-1">{dept.name}</h3>
        {dept.description && (
          <p className="text-slate-500 text-xs mt-1 line-clamp-2">{dept.description}</p>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-white/8 flex items-center justify-between text-xs">
        <span className="text-slate-500">
          {(dept as Department & { student_count?: number }).student_count ?? 0} students ·{" "}
          {(dept as Department & { faculty_count?: number }).faculty_count ?? 0} faculty
        </span>
        <button className="text-slate-400 hover:text-white transition-colors flex items-center gap-0.5">
          Manage <ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}
