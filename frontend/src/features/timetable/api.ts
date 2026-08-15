/**
 * FaceAttend — Timetable API (Phase 5)
 */
import api from "@/services/api";
import type { PaginatedResponse } from "@/types";

export type DayOfWeek = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";

export const DAY_LABELS: Record<DayOfWeek, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
};

export const DAY_SHORT: Record<DayOfWeek, string> = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
};

export const DAY_ORDER: DayOfWeek[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];

export interface TimetableEntry {
  id: string;
  academic_year: string | null;
  section: string;
  section_name: string;
  semester_name: string;
  department_name: string;
  subject: string;
  subject_code: string;
  subject_name: string;
  faculty: string;
  faculty_id: string;
  faculty_name: string;
  room: string;
  room_name: string;
  day: DayOfWeek;
  day_display: string;
  start_time: string;   // "HH:MM:SS"
  end_time: string;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface CreateEntryPayload {
  section: string;
  subject: string;
  faculty: string;
  room: string;
  day: DayOfWeek;
  start_time: string;
  end_time: string;
  notes?: string;
  academic_year?: string;
}

export interface TimetableFilters {
  section?: string;
  faculty?: string;
  room?: string;
  day?: string;
  department?: string;
  semester?: string;
  is_active?: string;
  search?: string;
  page_size?: number;
}

export const timetableApi = {
  list: async (filters?: TimetableFilters): Promise<PaginatedResponse<TimetableEntry>> => {
    const res = await api.get<{ success: boolean; data: PaginatedResponse<TimetableEntry> }>(
      "/timetable/",
      { params: filters }
    );
    return res.data.data;
  },

  create: async (data: CreateEntryPayload): Promise<TimetableEntry> => {
    const res = await api.post<{ success: boolean; data: TimetableEntry; errors?: Record<string, unknown> }>(
      "/timetable/",
      data
    );
    return res.data.data;
  },

  update: async (id: string, data: Partial<CreateEntryPayload>): Promise<TimetableEntry> => {
    const res = await api.patch<{ success: boolean; data: TimetableEntry }>(
      `/timetable/${id}/`,
      data
    );
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/timetable/${id}/`);
  },

  days: async (): Promise<string[]> => {
    const res = await api.get<{ success: boolean; data: string[] }>("/timetable/days/");
    return res.data.data;
  },
};

/** Group entries by day, sorted by start_time within each day. */
export function groupByDay(entries: TimetableEntry[]): Record<DayOfWeek, TimetableEntry[]> {
  const result = {} as Record<DayOfWeek, TimetableEntry[]>;
  for (const day of DAY_ORDER) result[day] = [];
  for (const entry of entries) {
    if (result[entry.day]) result[entry.day].push(entry);
  }
  return result;
}

/** Format "HH:MM:SS" → "09:00 AM" */
export function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}
