/**
 * FaceAttend — Faculty Timetable Page (Phase 5)
 * Read-only weekly schedule view for the logged-in faculty member.
 */
import { useQuery } from "@tanstack/react-query";
import { Calendar, RefreshCw } from "lucide-react";
import { timetableApi } from "@/features/timetable/api";
import { facultyApi } from "@/features/faculty/api";
import TimetableGrid from "@/components/timetable/TimetableGrid";
import { useAuthStore } from "@/store/authStore";

export default function FacultyTimetablePage() {
  const user = useAuthStore((s) => s.user);

  // Fetch faculty profile to get the Faculty UUID (different from user UUID)
  const { data: facultyList } = useQuery({
    queryKey: ["my-faculty-profile", user?.id],
    queryFn: () => facultyApi.list({ page_size: 5 }),
    enabled: !!user,
  });

  // Use first result that matches this user — in production find by user_id filter
  const myFaculty = facultyList?.results.find(
    (f) => f.email === user?.email
  );

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["faculty-timetable", myFaculty?.id],
    queryFn: () =>
      timetableApi.list({
        faculty: myFaculty!.id,
        page_size: 200,
      }),
    enabled: !!myFaculty,
  });

  const entries = data?.results ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Timetable</h1>
          <p className="text-slate-400 text-sm mt-1">
            {myFaculty?.full_name
              ? `${myFaculty.full_name} — ${entries.length} classes per week`
              : "Weekly teaching schedule"}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="animate-spin text-slate-500" size={20} />
        </div>
      ) : !myFaculty ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/3 border border-white/8 rounded-xl">
          <Calendar className="w-10 h-10 text-slate-700 mb-3" />
          <p className="text-slate-400 text-sm">Faculty profile not found</p>
          <p className="text-slate-600 text-xs mt-1">Contact your administrator to set up your faculty profile.</p>
        </div>
      ) : (
        <TimetableGrid entries={entries} showAllDays={true} />
      )}
    </div>
  );
}
