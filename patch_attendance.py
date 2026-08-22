import re

with open("frontend/src/pages/faculty/AttendancePage.tsx", "r") as f:
    content = f.read()

# 1. Add imports
import_str = """
import { facultyApi } from "@/features/faculty/api";
import { useAuthStore } from "@/store/authStore";
"""
content = re.sub(r'import { timetableApi } from "@/features/timetable/api";', 'import { timetableApi } from "@/features/timetable/api";' + import_str, content)

# 2. Add CreateSessionModal
modal_str = """
// ── Create Session Modal ─────────────────────────────────────────────────────
function CreateSessionModal({
  isOpen,
  onClose,
  onCreate,
  isLoading
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (timetable_entry_id: string) => void;
  isLoading: boolean;
}) {
  const user = useAuthStore((s: any) => s.user);
  const { data: facultyList } = useQuery({
    queryKey: ["my-faculty-profile", user?.id],
    queryFn: () => facultyApi.list({ page_size: 5 }),
    enabled: !!user,
  });
  const myFaculty = facultyList?.results.find((f: any) => f.email === user?.email);

  const { data: ttData, isLoading: isLoadingTt } = useQuery({
    queryKey: ["faculty-timetable", myFaculty?.id],
    queryFn: () => timetableApi.list({ faculty: myFaculty!.id, page_size: 100 }),
    enabled: !!myFaculty,
  });

  const [selectedEntry, setSelectedEntry] = useState<string>("");

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-slate-900 border-white/10 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Create New Session</DialogTitle>
          <div className="text-slate-400 text-sm">
            Select a class from your timetable to start an attendance session.
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isLoadingTt ? (
            <div className="text-sm text-slate-400 flex items-center gap-2">
              <Loader2 className="animate-spin" size={14} /> Loading your timetable...
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-slate-300">Select Class</Label>
              <Select value={selectedEntry} onValueChange={setSelectedEntry}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Choose from timetable" />
                </SelectTrigger>
                <SelectContent className="z-[200] max-h-60 overflow-y-auto">
                  {ttData?.results?.map((tt: any) => (
                    <SelectItem key={tt.id} value={tt.id}>
                      {tt.subject_name} ({tt.section_name}) — {tt.day_display} {tt.start_time}
                    </SelectItem>
                  ))}
                  {(!ttData?.results || ttData.results.length === 0) && (
                    <SelectItem value="none" disabled>No timetable entries found</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="text-slate-300 border-white/10 hover:bg-white/5">Cancel</Button>
          <Button 
            className="bg-emerald-600 hover:bg-emerald-500 text-white" 
            disabled={!selectedEntry || selectedEntry === "none" || isLoading}
            onClick={() => onCreate(selectedEntry)}
          >
            {isLoading && <Loader2 className="animate-spin mr-2" size={14} />}
            Create Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
"""

content = re.sub(r'(// ---- Main Page ----)', modal_str + r'\n\1', content)

# 3. Add createMutation
mutation_str = """
  const createMutation = useMutation({
    mutationFn: (timetable_entry: string) => attendanceApi.createSession({ 
      timetable_entry,
      section: "",
      subject: "",
      faculty: "",
      date: new Date().toISOString().split('T')[0],
    }),
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      setActiveSession(newSession);
      setCreateOpen(false);
    }
  });
"""

content = re.sub(r'(const endMutation = useMutation\({)', mutation_str + r'\n  \1', content)

# 4. Add the modal render
render_str = """
      {createOpen && (
        <CreateSessionModal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreate={(tt_id) => createMutation.mutate(tt_id)}
          isLoading={createMutation.isPending}
        />
      )}
"""
content = re.sub(r'(</div>\n\s*)\)(\s*:\s*\(\s*<div)', render_str + r'\n\1)\2', content) # wait this regex is brittle

with open("frontend/src/pages/faculty/AttendancePage.tsx", "w") as f:
    f.write(content)

