/**
 * FaceAttend — Phase 14: Dashboard API
 */
import api from "@/services/api";

// ---------------------------------------------------------------------------
// Student Dashboard
// ---------------------------------------------------------------------------

export interface CurrentClass {
  timetable_entry_id: string;
  subject_code: string;
  subject_name: string;
  start_time: string;
  end_time: string;
  room_name: string | null;
  faculty_name: string;
  session_id: string | null;
  session_code: string | null;
  already_marked: boolean;
}

export interface UpcomingClass {
  timetable_entry_id: string;
  subject_code: string;
  subject_name: string;
  start_time: string;
  end_time: string | null;
  room_name: string | null;
}

export interface RecentRecord {
  subject_code: string;
  subject_name: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  session_date: string;
  face_verified: boolean;
  liveness_verified: boolean;
  is_fully_verified: boolean;
  marked_at: string;
}

export interface StudentDashboard {
  greeting: string;
  overall_percentage: number;
  total_classes: number;
  attended_classes: number;
  current_class: CurrentClass | null;
  upcoming_classes: UpcomingClass[];
  recent_records: RecentRecord[];
}

// ---------------------------------------------------------------------------
// Faculty Dashboard
// ---------------------------------------------------------------------------

export interface ScheduleSlot {
  timetable_entry_id: string;
  subject_code: string;
  subject_name: string;
  start_time: string;
  end_time: string;
  section_name: string;
  department_name: string;
  room_name: string | null;
  session_id: string | null;
  session_status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED" | null;
  present_count: number;
  total_students: number;
  attendance_percentage: number;
}

export interface FacultyDashboard {
  greeting: string;
  today_schedule: ScheduleSlot[];
  active_session: ScheduleSlot | null;
  this_week_sessions: number;
  this_week_avg_attendance: number;
}

// ---------------------------------------------------------------------------
// Admin Dashboard
// ---------------------------------------------------------------------------

export interface PendingStudent {
  id: string;
  full_name: string;
  student_id: string;
  department_name: string;
  created_at: string;
}

export interface AdminDashboard {
  total_students: number;
  pending_approvals: number;
  total_faculty: number;
  total_departments: number;
  active_sessions_now: number;
  today_attendance_count: number;
  pending_face_enrollments: number;
  recent_pending_students: PendingStudent[];
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

const BASE = "/attendance/dashboard";

export const dashboardApi = {
  student: (): Promise<{ data: StudentDashboard }> =>
    api.get(`${BASE}/student/`).then((r) => r.data),

  faculty: (): Promise<{ data: FacultyDashboard }> =>
    api.get(`${BASE}/faculty/`).then((r) => r.data),

  admin: (): Promise<{ data: AdminDashboard }> =>
    api.get(`${BASE}/admin/`).then((r) => r.data),
};
