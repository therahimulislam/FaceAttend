/**
 * FaceAttend — Attendance Session API (Phase 6)
 */
import api from "@/services/api";
import type { PaginatedResponse } from "@/types";

export type SessionStatus = "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
export type VerificationMethod = "FACE_GPS" | "FACE" | "GPS" | "MANUAL" | "EXEMPT";

export interface AttendanceSession {
  id: string;
  timetable_entry: string | null;
  section: string;
  section_name: string;
  semester_name: string;
  department_name: string;
  subject: string;
  subject_code: string;
  subject_name: string;
  faculty: string;
  faculty_name: string;
  room: string | null;
  room_name: string | null;
  date: string;
  session_code: string | null;
  status: SessionStatus;
  is_open: boolean;
  valid_from: string | null;
  valid_until: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number;
  attendance_count: number;
  total_students: number;
  notes: string;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  session: string;
  student: string;
  student_name: string;
  student_id: string;
  status: AttendanceStatus;
  verification_method: VerificationMethod;
  face_verified: boolean;
  gps_verified: boolean;
  marked_at: string;
  marked_by: string | null;
  marked_by_email: string | null;
  rejection_reason: string;
  created_at: string;
}

export interface CreateSessionPayload {
  section: string;
  subject: string;
  faculty: string;
  room?: string;
  date: string;
  duration_minutes?: number;
  notes?: string;
  timetable_entry?: string;
}

export const attendanceApi = {
  // Sessions
  listSessions: async (params?: {
    date?: string; faculty?: string; section?: string;
    department?: string; status?: string; page_size?: number;
  }): Promise<PaginatedResponse<AttendanceSession>> => {
    const res = await api.get<{ success: boolean; data: PaginatedResponse<AttendanceSession> }>(
      "/attendance/sessions/", { params }
    );
    return res.data.data;
  },

  createSession: async (data: CreateSessionPayload): Promise<AttendanceSession> => {
    const res = await api.post<{ success: boolean; data: AttendanceSession }>(
      "/attendance/sessions/", data
    );
    return res.data.data;
  },

  getSession: async (id: string): Promise<AttendanceSession> => {
    const res = await api.get<{ success: boolean; data: AttendanceSession }>(
      `/attendance/sessions/${id}/`
    );
    return res.data.data;
  },

  startSession: async (id: string, duration_minutes?: number): Promise<AttendanceSession> => {
    const res = await api.post<{ success: boolean; data: AttendanceSession }>(
      `/attendance/sessions/${id}/start/`,
      duration_minutes ? { duration_minutes } : {}
    );
    return res.data.data;
  },

  endSession: async (id: string): Promise<AttendanceSession> => {
    const res = await api.post<{ success: boolean; data: AttendanceSession }>(
      `/attendance/sessions/${id}/end/`
    );
    return res.data.data;
  },

  cancelSession: async (id: string): Promise<AttendanceSession> => {
    const res = await api.post<{ success: boolean; data: AttendanceSession }>(
      `/attendance/sessions/${id}/cancel/`
    );
    return res.data.data;
  },

  manualMark: async (
    sessionId: string,
    student: string,
    markStatus: AttendanceStatus,
    rejection_reason?: string
  ): Promise<AttendanceRecord> => {
    const res = await api.post<{ success: boolean; data: AttendanceRecord }>(
      `/attendance/sessions/${sessionId}/mark/`,
      { student, status: markStatus, rejection_reason }
    );
    return res.data.data;
  },

  getRecords: async (sessionId: string): Promise<PaginatedResponse<AttendanceRecord>> => {
    const res = await api.get<{ success: boolean; data: PaginatedResponse<AttendanceRecord> }>(
      `/attendance/sessions/${sessionId}/records/`
    );
    return res.data.data;
  },

  today: async (): Promise<PaginatedResponse<AttendanceSession>> => {
    const res = await api.get<{ success: boolean; data: PaginatedResponse<AttendanceSession> }>(
      "/attendance/sessions/today/"
    );
    return res.data.data;
  },

  lookupByCode: async (code: string): Promise<AttendanceSession> => {
    const res = await api.get<{ success: boolean; data: AttendanceSession }>(
      "/attendance/sessions/by-code/", { params: { code } }
    );
    return res.data.data;
  },
};
