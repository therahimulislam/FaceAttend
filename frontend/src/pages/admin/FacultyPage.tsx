/**
 * FaceAttend — Admin Faculty Management Page
 * Full list + Create faculty account (superadmin sets email & password).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Users, Search, RefreshCw, Plus, Loader2, Briefcase, Edit2, Trash2, Eye, EyeOff
} from "lucide-react";
import { facultyApi } from "@/features/faculty/api";
import { departmentsApi } from "@/features/departments/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Faculty } from "@/types";

// ── Schemas ──────────────────────────────────────────────────────
const baseSchema = z.object({
  employee_id: z.string().min(1, "Employee ID is required"),
  full_name:   z.string().min(2, "Full name is required"),
  phone:       z.string().optional(),
  department:  z.string().optional(),
  designation: z.string().optional(),
  is_hod:      z.boolean().default(false),
});
const createSchema = baseSchema.extend({
  email:       z.string().email("Enter a valid email address"),
  password:    z.string().min(8, "Password must be at least 8 characters"),
});
const updateSchema = baseSchema.extend({
  user_status: z.string().optional(),
});

type CreateFormData = z.infer<typeof createSchema>;
type UpdateFormData = z.infer<typeof updateSchema>;

// ── Faculty Form Modal (Create/Edit) ───────────────────────────────────────────────────────
function FacultyFormModal({
  onClose, onSaved, editTarget,
}: {
  onClose: () => void; onSaved: () => void; editTarget?: Faculty;
}) {
  const isEdit = !!editTarget;
  const [showPassword, setShowPassword] = useState(false);
  const [serverError,  setServerError]  = useState("");

  const { data: depts } = useQuery({
    queryKey: ["departments", "all"],
    queryFn: () => departmentsApi.list({ status: "ACTIVE", page_size: 100 }),
  });

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } =
    useForm<CreateFormData | UpdateFormData>({
      resolver: zodResolver(isEdit ? updateSchema : createSchema),
      defaultValues: isEdit ? {
        employee_id: editTarget.employee_id,
        full_name: editTarget.full_name,
        phone: editTarget.phone || "",
        department: editTarget.department || undefined,
        designation: editTarget.designation || "",
        is_hod: editTarget.is_hod,
        user_status: editTarget.user_status,
      } : { is_hod: false },
    });

  const submitMutation = useMutation({
    mutationFn: (data: any) => {
      const payload = { ...data, department: data.department || undefined };
      if (isEdit) {
        return facultyApi.update(editTarget.id, payload);
      } else {
        return facultyApi.create(payload);
      }
    },
    onSuccess: () => {
      reset();
      onSaved();
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? (isEdit ? "Failed to update faculty account." : "Failed to create faculty account.");
      setServerError(msg);
    },
  });

  return (
    <Dialog open onOpenChange={() => { reset(); setServerError(""); onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Faculty Member" : "Create Faculty Account"}</DialogTitle>
          {!isEdit && (
            <DialogDescription className="text-slate-400">
              Set a temporary password. The faculty member can change it in <strong className="text-white">Settings → Change Password</strong> after logging in.
            </DialogDescription>
          )}
        </DialogHeader>

        {serverError && (
          <div className="bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2 text-red-300 text-sm">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit((d) => { setServerError(""); submitMutation.mutate(d); })}
          className="space-y-4" noValidate>

          {/* Email + Password (Only for Create) */}
          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Email *</Label>
                <Input type="email" placeholder="faculty@college.edu"
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-10"
                  {...register("email")} />
                {(errors as any).email && <p className="text-red-400 text-xs">{(errors as any).email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Temporary Password *</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 8 characters"
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-10 pr-10"
                    {...register("password")}
                  />
                  <button type="button" tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    onClick={() => setShowPassword((p) => !p)}>
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {(errors as any).password && <p className="text-red-400 text-xs">{(errors as any).password.message}</p>}
              </div>
            </div>
          )}

          {/* Full Name + Employee ID */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Full Name *</Label>
              <Input placeholder="Dr. Jane Smith"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-10"
                {...register("full_name")} />
              {errors.full_name && <p className="text-red-400 text-xs">{errors.full_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Employee ID *</Label>
              <Input placeholder="EMP-001"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-10"
                {...register("employee_id")} />
              {errors.employee_id && <p className="text-red-400 text-xs">{errors.employee_id.message}</p>}
            </div>
          </div>

          {/* Department + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Department</Label>
              <Controller name="department" control={control} render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white h-10 text-sm">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent className="z-[200]">
                    {depts?.results.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Phone</Label>
              <Input placeholder="+91 98765 43210"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-10"
                {...register("phone")} />
            </div>
          </div>

          {/* Designation + HOD */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Designation</Label>
              <Input placeholder="e.g. Assistant Professor"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-10"
                {...register("designation")} />
            </div>
            {isEdit && (
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Status</Label>
                <Controller name="user_status" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent className="z-[200]">
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                      <SelectItem value="SUSPENDED">Suspended</SelectItem>
                      <SelectItem value="TRANSFERRED">Transferred</SelectItem>
                      <SelectItem value="RESIGNED">Resigned</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Role</Label>
            <div className="flex items-center h-10 gap-2">
              <input type="checkbox" id="is_hod" className="w-4 h-4 accent-white" {...register("is_hod")} />
              <label htmlFor="is_hod" className="text-slate-400 text-sm">Head of Department (HOD)</label>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitMutation.isPending}>Cancel</Button>
            <Button type="submit" disabled={submitMutation.isPending}>
              {submitMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : (isEdit ? "Update" : "Create Account")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ────────────────────────────────────────────────────────
export default function FacultyPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Faculty | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Faculty | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["faculty-list", searchTerm],
    queryFn: () => facultyApi.list({ search: searchTerm, page_size: 50 }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => facultyApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faculty-list"] });
      setDeleteTarget(null);
    },
  });

  const faculty = data?.results ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Faculty</h1>
          <p className="text-slate-400 text-sm mt-1">{data?.count ?? 0} faculty members</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-white/10 text-slate-300 hover:bg-white/5" onClick={() => refetch()}>
            <RefreshCw size={14} />
          </Button>
          <Button className="h-10 flex-1 sm:flex-none" onClick={() => { setEditTarget(undefined); setModalOpen(true); }}>
            <Plus size={18} className="mr-2" /> Add Faculty
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <Input
          placeholder="Search by name, ID or email…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-9 text-sm"
        />
      </div>

      <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><RefreshCw className="animate-spin text-slate-500" size={20} /></div>
        ) : faculty.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users className="w-10 h-10 text-slate-700 mb-3" />
            <p className="text-slate-400 text-sm">No faculty found</p>
            <button className="mt-3 text-sm text-white underline underline-offset-4" onClick={() => setModalOpen(true)}>
              Add first faculty member
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
                <tr className="border-b border-white/8">
                  {["Name", "ID / Role", "Department", "Contact", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
            </thead>
            <tbody>
              {faculty.map((f) => (
                <FacultyRow 
                    key={f.id} 
                    faculty={f} 
                    onEdit={() => { setEditTarget(f); setModalOpen(true); }}
                    onDelete={() => setDeleteTarget(f)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <FacultyFormModal
          onClose={() => { setModalOpen(false); setEditTarget(undefined); }}
          editTarget={editTarget}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["faculty-list"] })}
        />
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Faculty Member?</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-slate-300 text-sm">
            Are you sure you want to delete <span className="text-white font-medium">{deleteTarget?.full_name}</span>?
            Their account will be marked as INACTIVE and they will lose access.
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

function FacultyRow({ faculty: f, onEdit, onDelete }: { faculty: Faculty, onEdit: () => void, onDelete: () => void }) {
  const isActive = f.user_status === "ACTIVE";
  return (
    <tr className="border-b border-white/5 hover:bg-white/3 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
            <Briefcase size={13} className="text-slate-400" />
          </div>
          <div>
            <p className="text-white font-medium text-sm">{f.full_name}</p>
            <p className="text-slate-500 text-xs">{f.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="font-mono text-slate-300 text-sm">{f.employee_id}</span>
      </td>
      <td className="px-4 py-3">
        <p className="text-slate-300 text-sm">{f.department_name || "—"}</p>
        {f.is_hod && <span className="text-xs text-amber-400">HOD</span>}
      </td>
      <td className="px-4 py-3">
        <p className="text-slate-400 text-sm">{f.designation || "—"}</p>
      </td>
      <td className="px-4 py-3">
        <Badge variant={isActive ? "success" : "secondary"} className="text-xs">
          {isActive ? "Active" : f.user_status}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-white" onClick={onEdit}>
            <Edit2 size={15} />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-red-400" onClick={onDelete}>
            <Trash2 size={15} />
          </Button>
        </div>
      </td>
    </tr>
  );
}
