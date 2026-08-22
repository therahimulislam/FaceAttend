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
  Users, Search, RefreshCw, Plus, Loader2, Eye, EyeOff, Briefcase,
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

// ── Create Faculty Schema ──────────────────────────────────────────────────────
const createSchema = z.object({
  email:       z.string().email("Enter a valid email address"),
  password:    z.string().min(8, "Password must be at least 8 characters"),
  employee_id: z.string().min(1, "Employee ID is required"),
  full_name:   z.string().min(2, "Full name is required"),
  phone:       z.string().optional(),
  department:  z.string().optional(),
  designation: z.string().optional(),
  is_hod:      z.boolean().default(false),
});
type CreateFormData = z.infer<typeof createSchema>;

// ── Create Faculty Modal ───────────────────────────────────────────────────────
function CreateFacultyModal({
  onClose, onSaved,
}: {
  onClose: () => void; onSaved: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError,  setServerError]  = useState("");

  const { data: depts } = useQuery({
    queryKey: ["departments", "all"],
    queryFn: () => departmentsApi.list({ status: "ACTIVE", page_size: 100 }),
  });

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } =
    useForm<CreateFormData>({
      resolver: zodResolver(createSchema),
      defaultValues: { is_hod: false },
    });

  const createMutation = useMutation({
    mutationFn: (data: CreateFormData) => facultyApi.create({
      ...data,
      department: data.department || undefined,
    }),
    onSuccess: () => {
      reset();
      onSaved();
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? "Failed to create faculty account.";
      setServerError(msg);
    },
  });

  return (
    <Dialog open onOpenChange={() => { reset(); setServerError(""); onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Faculty Account</DialogTitle>
          <DialogDescription className="text-slate-400">
            Set a temporary password. The faculty member can change it in <strong className="text-white">Settings → Change Password</strong> after logging in.
          </DialogDescription>
        </DialogHeader>

        {serverError && (
          <div className="bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2 text-red-300 text-sm">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit((d) => { setServerError(""); createMutation.mutate(d); })}
          className="space-y-4" noValidate>

          {/* Email + Password */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Email *</Label>
              <Input type="email" placeholder="faculty@college.edu"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-10"
                {...register("email")} />
              {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
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
              {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
            </div>
          </div>

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
              <Input placeholder="Associate Professor"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-10"
                {...register("designation")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Role</Label>
              <div className="flex items-center h-10 gap-2">
                <input type="checkbox" id="is_hod" className="w-4 h-4 accent-white" {...register("is_hod")} />
                <label htmlFor="is_hod" className="text-slate-400 text-sm">Head of Department (HOD)</label>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" size="sm"
              className="border-white/10 text-slate-300 hover:bg-white/5"
              onClick={() => { reset(); setServerError(""); onClose(); }}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="bg-white text-slate-900 hover:bg-white/90"
              disabled={isSubmitting || createMutation.isPending}>
              {(isSubmitting || createMutation.isPending) && <Loader2 className="animate-spin" size={14} />}
              Create Faculty Account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function FacultyPage() {
  const [search, setSearch]         = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["faculty-list", search],
    queryFn: () => facultyApi.list({ search: search || undefined, page_size: 50 }),
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
          <Button size="sm" className="bg-white text-slate-900 hover:bg-white/90" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> Add Faculty
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <Input
          placeholder="Search by name, ID or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
            <button className="mt-3 text-sm text-white underline underline-offset-4" onClick={() => setCreateOpen(true)}>
              Add first faculty member
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/8">
                {["Faculty Member", "Employee ID", "Department", "Designation", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {faculty.map((f) => (
                <FacultyRow key={f.id} faculty={f} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {createOpen && (
        <CreateFacultyModal
          onClose={() => setCreateOpen(false)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["faculty-list"] })}
        />
      )}
    </div>
  );
}

function FacultyRow({ faculty: f }: { faculty: Faculty }) {
  const isActive = f.user_status === "ACTIVE";
  return (
    <tr className="border-b border-white/5 hover:bg-white/3 transition-colors">
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
    </tr>
  );
}
