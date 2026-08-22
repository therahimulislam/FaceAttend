/**
 * FaceAttend — Admin Timetable Management Page (Phase 5)
 *
 * Features:
 *  - Weekly grid view (TimetableGrid) + list table view toggle
 *  - Create / Edit entry modal with conflict error display
 *  - Filter by department → semester → section
 *  - Soft-delete with confirmation
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import {
  Plus, LayoutGrid, List, RefreshCw, Loader2,
  AlertCircle, Calendar,
} from "lucide-react";

import { timetableApi, type TimetableEntry, type DayOfWeek, DAY_ORDER, DAY_LABELS } from "@/features/timetable/api";
import { departmentsApi } from "@/features/departments/api";
import { semestersApi, sectionsApi, subjectsApi, roomsApi } from "@/features/academics/api";
import { facultyApi } from "@/features/faculty/api";
import TimetableGrid from "@/components/timetable/TimetableGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ---- Schema ----
const schema = z.object({
  section: z.string().min(1, "Section is required"),
  subject: z.string().min(1, "Subject is required"),
  faculty: z.string().min(1, "Faculty is required"),
  room: z.string().min(1, "Room is required"),
  day: z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT"]),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  notes: z.string().optional(),
  academic_year: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

// ---- Entry Form Modal ----
function EntryFormModal({
  open,
  onClose,
  editTarget,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editTarget?: TimetableEntry;
  onSaved: () => void;
}) {
  const isEdit = !!editTarget;
  const [conflicts, setConflicts] = useState<string[]>([]);

  // ── Dept / Sem local state drives cascading queries ──
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedSem,  setSelectedSem]  = useState("");

  const { data: depts } = useQuery({
    queryKey: ["departments", "all"],
    queryFn: () => departmentsApi.list({ status: "ACTIVE", page_size: 100 }),
  });

  const { data: semesters } = useQuery({
    queryKey: ["semesters-for-timetable", selectedDept],
    queryFn:  () => semestersApi.list({ department: selectedDept, status: "ACTIVE", page_size: 100 }),
    enabled:  !!selectedDept,
  });

  const { data: sections } = useQuery({
    queryKey: ["sections-for-timetable", selectedSem],
    queryFn:  () => sectionsApi.list({ semester: selectedSem, page_size: 100 }),
    enabled:  !!selectedSem,
  });

  const { data: subjects } = useQuery({
    queryKey: ["subjects-for-timetable", selectedDept],
    queryFn:  () => subjectsApi.list({ department: selectedDept, status: "ACTIVE", page_size: 100 }),
    enabled:  !!selectedDept,
  });

  // Rooms are always available, no dependency
  const { data: rooms } = useQuery({
    queryKey: ["rooms-for-timetable"],
    queryFn:  () => roomsApi.list({ status: "ACTIVE", page_size: 100 }),
  });

  const { data: faculty } = useQuery({
    queryKey: ["faculty-for-timetable", selectedDept],
    queryFn:  () => facultyApi.list({ department: selectedDept, page_size: 100 }),
    enabled:  !!selectedDept,
  });

  // Auto-resolve Dept and Sem IDs from names when editing
  useEffect(() => {
    if (isEdit && editTarget && depts && !selectedDept) {
      const match = depts.results.find(d => d.name === editTarget.department_name);
      if (match) setSelectedDept(match.id);
    }
  }, [isEdit, editTarget, depts, selectedDept]);

  useEffect(() => {
    if (isEdit && editTarget && semesters && !selectedSem) {
      const match = semesters.results.find(s => s.name === editTarget.semester_name);
      if (match) setSelectedSem(match.id);
    }
  }, [isEdit, editTarget, semesters, selectedSem]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: editTarget
      ? {
          section: editTarget.section,
          subject: editTarget.subject,
          faculty: editTarget.faculty,
          room:    editTarget.room,
          day:     editTarget.day,
          start_time: editTarget.start_time.slice(0, 5),
          end_time:   editTarget.end_time.slice(0, 5),
          notes:      editTarget.notes,
        }
      : { day: "MON", section: "", subject: "", faculty: "", room: "" },
  });

  const handleClose = () => {
    reset();
    setConflicts([]);
    setSelectedDept("");
    setSelectedSem("");
    onClose();
  };

  const onSubmit = async (data: FormData) => {
    setConflicts([]);
    try {
      if (isEdit && editTarget) {
        await timetableApi.update(editTarget.id, data);
      } else {
        await timetableApi.create({ ...data, day: data.day as DayOfWeek });
      }
      reset();
      onSaved();
      handleClose();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const responseConflicts = err.response.data?.errors?.conflicts;
        setConflicts(Array.isArray(responseConflicts) ? responseConflicts : ["A scheduling conflict was detected."]);
      } else if (axios.isAxiosError(err) && err.response?.status === 400) {
        setConflicts(["Please check all fields and try again."]);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Timetable Entry" : "Add Timetable Entry"}</DialogTitle>
        </DialogHeader>

        {/* Conflict errors */}
        {conflicts.length > 0 && (
          <div className="rounded-lg bg-red-950/40 border border-red-800/40 p-4 space-y-1">
            <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
              <AlertCircle size={14} /> Scheduling Conflicts
            </div>
            {conflicts.map((c, i) => (
              <p key={i} className="text-red-300 text-xs ml-5">{c}</p>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* ── Row 1: Department → Semester → Section cascade ── */}
          <div className="grid grid-cols-3 gap-3">
            {/* Department (local state, not in form) */}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Department *</Label>
              <Select
                value={selectedDept || undefined}
                onValueChange={(v) => {
                  setSelectedDept(v);
                  setSelectedSem("");
                }}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-10 text-sm">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  {(depts?.results || []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Semester (local state) */}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Semester *</Label>
              <Select
                value={selectedSem || undefined}
                onValueChange={(v) => setSelectedSem(v)}
                disabled={!selectedDept}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-10 text-sm disabled:opacity-50">
                  <SelectValue placeholder={selectedDept ? "Select…" : "Pick dept first"} />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  {(semesters?.results || []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Section (form field) */}
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
                      <SelectValue placeholder={selectedSem ? "Select…" : "Pick semester first"} />
                    </SelectTrigger>
                    <SelectContent className="z-[200]">
                      {(sections?.results || []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>Section {s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.section && <p className="text-red-400 text-xs">{errors.section.message}</p>}
            </div>
          </div>

          {/* ── Row 2: Subject + Faculty + Room ── */}
          <div className="grid grid-cols-3 gap-3">
            {/* Subject (form field) */}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Subject *</Label>
              <Controller
                name="subject"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                    disabled={!selectedDept}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white h-10 text-sm disabled:opacity-50">
                      <SelectValue placeholder={selectedDept ? "Select…" : "Pick dept first"} />
                    </SelectTrigger>
                    <SelectContent className="z-[200]">
                      {(subjects?.results || []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.subject && <p className="text-red-400 text-xs">{errors.subject.message}</p>}
            </div>

            {/* Faculty (form field) */}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Faculty *</Label>
              <Controller
                name="faculty"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                    disabled={!selectedDept}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white h-10 text-sm disabled:opacity-50">
                      <SelectValue placeholder={selectedDept ? "Select…" : "Pick dept first"} />
                    </SelectTrigger>
                    <SelectContent className="z-[200]">
                      {(faculty?.results || []).map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.faculty && <p className="text-red-400 text-xs">{errors.faculty.message}</p>}
            </div>

            {/* Room (form field — always enabled) */}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Room *</Label>
              <Controller
                name="room"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white h-10 text-sm">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent className="z-[200]">
                      {(rooms?.results || []).map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.room && <p className="text-red-400 text-xs">{errors.room.message}</p>}
            </div>
          </div>

          {/* ── Row 3: Day + Time ── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Day *</Label>
              <Controller
                name="day"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white h-10 text-sm">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent className="z-[200]">
                      {DAY_ORDER.map((d) => (
                        <SelectItem key={d} value={d}>{DAY_LABELS[d]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.day && <p className="text-red-400 text-xs">{errors.day.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Start Time *</Label>
              <Input type="time" className="bg-white/5 border-white/10 text-white h-10" {...register("start_time")} />
              {errors.start_time && <p className="text-red-400 text-xs">{errors.start_time.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">End Time *</Label>
              <Input type="time" className="bg-white/5 border-white/10 text-white h-10" {...register("end_time")} />
              {errors.end_time && <p className="text-red-400 text-xs">{errors.end_time.message}</p>}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Notes (optional)</Label>
            <Input
              placeholder="e.g. Lab session — bring laptop"
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-10"
              {...register("notes")}
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" size="sm"
              className="border-white/10 text-slate-300 hover:bg-white/5" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm"
              className="bg-white text-slate-900 hover:bg-white/90" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" size={14} />}
              {isEdit ? "Save Changes" : "Add Entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


// ---- Main Page ----
type ViewMode = "grid" | "list";

export default function AdminTimetablePage() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TimetableEntry | undefined>();
  const [deptFilter, setDeptFilter] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["timetable-admin", deptFilter],
    queryFn: () => timetableApi.list({ department: deptFilter || undefined, page_size: 200 }),
  });

  const { data: depts } = useQuery({
    queryKey: ["departments", "all"],
    queryFn: () => departmentsApi.list({ status: "ACTIVE", page_size: 100 }),
  });

  const softDelete = useMutation({
    mutationFn: timetableApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["timetable-admin"] }),
  });

  const entries = data?.results ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Timetable</h1>
          <p className="text-slate-400 text-sm mt-1">
            {data?.count ?? 0} entries · weekly schedule management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"
            className="border-white/10 text-slate-300 hover:bg-white/5" onClick={() => refetch()}>
            <RefreshCw size={13} />
          </Button>
          <Button size="sm" className="bg-white text-slate-900 hover:bg-white/90"
            onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> Add Entry
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Dept filter */}
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-52 bg-white/5 border-white/10 text-white h-9 text-sm">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All departments</SelectItem>
            {depts?.results.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View mode toggle */}
        <div className="ml-auto flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded transition-colors ${viewMode === "grid" ? "bg-white/15 text-white" : "text-slate-500 hover:text-white"}`}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded transition-colors ${viewMode === "list" ? "bg-white/15 text-white" : "text-slate-500 hover:text-white"}`}
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="animate-spin text-slate-500" size={20} />
        </div>
      ) : viewMode === "grid" ? (
        <TimetableGrid
          entries={entries}
          showAllDays={true}
          onEdit={setEditTarget}
          onDelete={(id) => softDelete.mutate(id)}
        />
      ) : (
        /* List view */
        <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Calendar className="w-10 h-10 text-slate-700 mb-3" />
              <p className="text-slate-400 text-sm">No timetable entries yet</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/8">
                  {["Day", "Time", "Subject", "Section", "Faculty", "Room", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-white/5 hover:bg-white/3 transition-colors group">
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">{entry.day_display}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300 text-sm font-mono">
                        {entry.start_time.slice(0, 5)}–{entry.end_time.slice(0, 5)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white text-sm font-medium">{entry.subject_code}</p>
                      <p className="text-slate-500 text-xs">{entry.subject_name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-300 text-sm">Sec {entry.section_name}</p>
                      <p className="text-slate-600 text-xs">{entry.semester_name}</p>
                    </td>
                    <td className="px-4 py-3"><p className="text-slate-300 text-sm">{entry.faculty_name}</p></td>
                    <td className="px-4 py-3"><p className="text-slate-300 text-sm">{entry.room_name}</p></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditTarget(entry)}
                          className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/15 transition-colors">
                          Edit
                        </button>
                        <button onClick={() => softDelete.mutate(entry.id)}
                          className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded bg-white/5 hover:bg-red-500/15 transition-colors">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modals */}
      <EntryFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["timetable-admin"] })}
      />
      {editTarget && (
        <EntryFormModal
          open={true}
          onClose={() => setEditTarget(undefined)}
          editTarget={editTarget}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["timetable-admin"] })}
        />
      )}
    </div>
  );
}
