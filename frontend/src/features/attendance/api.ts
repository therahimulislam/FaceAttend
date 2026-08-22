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
  // Phase 8 — geofence info
  room_latitude: string | null;
  room_longitude: string | null;
  room_geofence_radius: number | null;
  room_has_gps: boolean;
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
  liveness_verified: boolean;  // Phase 11
  is_fully_verified: boolean;  // Phase 12: GPS + Face + Liveness all true
  marked_at: string;
  marked_by: string | null;
  marked_by_email: string | null;
  rejection_reason: string;
  created_at: string;
  // Phase 12 transparency fields (only on submit response)
  _verification_summary?: {
    section_match: boolean;
    gps_verified: boolean;
    face_verified: boolean;
    liveness_verified: boolean;
    is_fully_verified: boolean;
    timetable_warning: string | null;
  };
  _timetable_warning?: string;
  _face_warning?: string;
  _liveness_warning?: string;
  _geofence_warning?: string;
}

export interface CreateSessionPayload {
  timetable_entry?: string;
  section?: string;
  subject?: string;
  faculty?: string;
  room?: string;
  date?: string;
  duration_minutes?: number;
  notes?: string;
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

  /** Student self-mark attendance (Phase 7+). GPS optional, face optional, liveness optional. */
  submitAttendance: async (
    sessionId: string,
    gps?: { latitude: string; longitude: string },
    faceImage?: File,
    livenessChallengeId?: string,
  ): Promise<AttendanceRecord> => {
    // If any biometric field provided, send as multipart/form-data
    if (faceImage || livenessChallengeId) {
      const form = new FormData();
      if (gps) {
        form.append("latitude", gps.latitude);
        form.append("longitude", gps.longitude);
      }
      if (faceImage) {
        form.append("face_image", faceImage);
      }
      if (livenessChallengeId) {
        form.append("liveness_challenge_id", livenessChallengeId);
      }
      const res = await api.post<{ success: boolean; data: AttendanceRecord }>(
        `/attendance/sessions/${sessionId}/submit/`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return res.data.data;
    }
    // JSON submit (GPS only or no verification)
    const res = await api.post<{ success: boolean; data: AttendanceRecord }>(
      `/attendance/sessions/${sessionId}/submit/`,
      gps ?? {}
    );
    return res.data.data;
  },

  /** Student's own attendance records. */
  myList: async (params?: { page_size?: number }): Promise<PaginatedResponse<MyAttendanceRecord>> => {
    const res = await api.get<{ success: boolean; data: PaginatedResponse<MyAttendanceRecord> }>(
      "/attendance/my/", { params }
    );
    return res.data.data;
  },

  /** Per-subject attendance summary for the logged-in student. */
  mySummary: async (): Promise<SubjectSummary[]> => {
    const res = await api.get<{ success: boolean; data: SubjectSummary[] }>(
      "/attendance/my/summary/"
    );
    return res.data.data;
  },
};

// ---- Extended Types for Phase 7 ----

export interface MyAttendanceRecord {
  id: string;
  session_id: string;
  session_date: string;
  subject_code: string;
  subject_name: string;
  faculty_name: string;
  section_name: string;
  status: AttendanceStatus;
  verification_method: VerificationMethod;
  face_verified: boolean;
  gps_verified: boolean;
  marked_at: string;
  rejection_reason: string;
  created_at: string;
}

export interface SubjectSummary {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  percentage: number;
}
