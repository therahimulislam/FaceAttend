/**
 * FaceAttend — TimetableGrid
 * Responsive weekly schedule grid. Displays entries grouped by day.
 * Columns = days (Mon–Sat), rows ordered by start_time.
 *
 * Used by:
 *   - Admin TimetablePage (full management view)
 *   - Faculty weekly schedule
 *   - Student weekly schedule
 */
import { Clock, MapPin, User } from "lucide-react";
import {
  type TimetableEntry,
  type DayOfWeek,
  DAY_ORDER,
  DAY_SHORT,
  groupByDay,
  formatTime,
} from "@/features/timetable/api";

// Colour palette cycling through entries in the same time slot
const SLOT_COLORS = [
  "bg-blue-950/60 border-blue-700/40 hover:bg-blue-950/80",
  "bg-violet-950/60 border-violet-700/40 hover:bg-violet-950/80",
  "bg-emerald-950/60 border-emerald-700/40 hover:bg-emerald-950/80",
  "bg-amber-950/60 border-amber-700/40 hover:bg-amber-950/80",
  "bg-rose-950/60 border-rose-700/40 hover:bg-rose-950/80",
  "bg-cyan-950/60 border-cyan-700/40 hover:bg-cyan-950/80",
];

function slotColor(index: number) {
  return SLOT_COLORS[index % SLOT_COLORS.length];
}

function EntryCard({
  entry,
  colorIndex,
  onEdit,
  onDelete,
}: {
  entry: TimetableEntry;
  colorIndex: number;
  onEdit?: (entry: TimetableEntry) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div
      className={`rounded-lg border p-3 transition-colors group relative ${slotColor(colorIndex)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-white font-semibold text-xs truncate">{entry.subject_code}</p>
          <p className="text-slate-300 text-xs mt-0.5 truncate leading-tight">{entry.subject_name}</p>
        </div>
        {(onEdit || onDelete) && (
          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <button
                onClick={() => onEdit(entry)}
                className="text-slate-400 hover:text-white text-[10px] px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(entry.id)}
                className="text-slate-400 hover:text-red-400 text-[10px] px-1.5 py-0.5 rounded bg-white/10 hover:bg-red-500/20 transition-colors"
              >
                Del
              </button>
            )}
          </div>
        )}
      </div>
      <div className="mt-2 space-y-1">
        <div className="flex items-center gap-1 text-slate-400 text-[11px]">
          <Clock size={10} className="flex-shrink-0" />
          <span>{formatTime(entry.start_time)} – {formatTime(entry.end_time)}</span>
        </div>
        <div className="flex items-center gap-1 text-slate-400 text-[11px]">
          <MapPin size={10} className="flex-shrink-0" />
          <span className="truncate">{entry.room_name}</span>
        </div>
        <div className="flex items-center gap-1 text-slate-400 text-[11px]">
          <User size={10} className="flex-shrink-0" />
          <span className="truncate">{entry.faculty_name}</span>
        </div>
      </div>
      {entry.section_name && (
        <div className="mt-2 pt-2 border-t border-white/10">
          <span className="text-slate-500 text-[10px]">Sec {entry.section_name}</span>
        </div>
      )}
    </div>
  );
}

interface TimetableGridProps {
  entries: TimetableEntry[];
  activeDays?: DayOfWeek[];
  onEdit?: (entry: TimetableEntry) => void;
  onDelete?: (id: string) => void;
  showAllDays?: boolean;
}

export function TimetableGrid({
  entries,
  activeDays,
  onEdit,
  onDelete,
  showAllDays = false,
}: TimetableGridProps) {
  const grouped = groupByDay(entries);

  // Determine which days to show
  const daysToShow: DayOfWeek[] = showAllDays
    ? DAY_ORDER
    : activeDays
    ? activeDays
    : (DAY_ORDER.filter((d) => grouped[d].length > 0) as DayOfWeek[]);

  if (daysToShow.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white/3 border border-white/8 rounded-xl">
        <Clock className="w-10 h-10 text-slate-700 mb-3" />
        <p className="text-slate-400 text-sm">No timetable entries</p>
        <p className="text-slate-600 text-xs mt-1">Add entries to see the weekly schedule.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-px bg-white/5 rounded-xl border border-white/8 overflow-hidden"
        style={{ gridTemplateColumns: `repeat(${daysToShow.length}, minmax(160px, 1fr))` }}
      >
        {/* Day Headers */}
        {daysToShow.map((day) => (
          <div
            key={day}
            className="bg-slate-900/80 px-3 py-2.5 text-center"
          >
            <span className="text-white font-semibold text-sm">{DAY_SHORT[day]}</span>
            <p className="text-slate-500 text-xs">{grouped[day].length} class{grouped[day].length !== 1 ? "es" : ""}</p>
          </div>
        ))}

        {/* Entry cells per day */}
        {daysToShow.map((day) => (
          <div key={day} className="bg-slate-950/40 p-3 min-h-[200px] space-y-2">
            {grouped[day].length === 0 ? (
              <div className="flex items-center justify-center h-16 text-slate-700 text-xs">
                Free
              </div>
            ) : (
              grouped[day]
                .sort((a, b) => a.start_time.localeCompare(b.start_time))
                .map((entry, idx) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    colorIndex={idx}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default TimetableGrid;
