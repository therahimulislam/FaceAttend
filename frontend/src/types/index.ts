/**
 * FaceAttend — Shared TypeScript Types
 * Mirrors the backend data models.
 */

// ---------------------------------------------------------------------------
// Users & Auth
// ---------------------------------------------------------------------------
export type UserRole = "STUDENT" | "FACULTY" | "DEPARTMENT_ADMIN" | "SUPER_ADMIN";
export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

// ---------------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------------
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

export interface Student {
  id: string;
  user_id: string;
  email: string;
  user_status: string;
  student_id: string;
  full_name: string;
  phone: string;
  department: string | null;
  department_display: string;
  semester: string | null;
  semester_display: string;
  section: string | null;
  section_display: string;
  department_name: string;
  semester_name: string;
  section_name: string;
  approval_status: ApprovalStatus;
  approved_at: string | null;
  rejection_reason: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Faculty
// ---------------------------------------------------------------------------
export interface Faculty {
  id: string;
  user_id: string;
  email: string;
  user_status: string;
  employee_id: string;
  full_name: string;
  phone: string;
  department: string | null;
  department_name: string | null;
  designation: string;
  is_hod: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Academic
// ---------------------------------------------------------------------------
export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  status: "ACTIVE" | "INACTIVE";
}

export interface Semester {
  id: string;
  name: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  status: "ACTIVE" | "INACTIVE" | "COMPLETED";
}

export interface Section {
  id: string;
  name: string;
  department: Department;
  semester: Semester;
  capacity: number;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  department: Department;
  semester: Semester;
  credits: number;
  status: "ACTIVE" | "INACTIVE";
}

export interface Room {
  id: string;
  name: string;
  building: string;
  floor: number;
  capacity: number;
  status: "ACTIVE" | "INACTIVE";
}

// ---------------------------------------------------------------------------
// Timetable
// ---------------------------------------------------------------------------
export type DayOfWeek = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export interface TimetableEntry {
  id: string;
  subject: Subject;
  faculty: Faculty;
  section: Section;
  room: Room;
  day_of_week: DayOfWeek;
  start_time: string; // "HH:MM:SS"
  end_time: string;
  status: "ACTIVE" | "INACTIVE";
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------
export type SessionStatus = "CREATED" | "ACTIVE" | "EXPIRED" | "CLOSED" | "CANCELLED";
export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "MANUALLY_CORRECTED";
export type VerificationStatus = "VERIFIED" | "FAILED" | "SUSPICIOUS";

export interface AttendanceSession {
  id: string;
  timetable_entry: TimetableEntry;
  faculty: Faculty;
  subject: Subject;
  section: Section;
  room: Room;
  started_at: string;
  expires_at: string;
  status: SessionStatus;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  session: AttendanceSession;
  student: Student;
  status: AttendanceStatus;
  verification_status: VerificationStatus;
  marked_at: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export type NotificationType =
  | "REGISTRATION_APPROVED"
  | "REGISTRATION_REJECTED"
  | "ATTENDANCE_SUCCESS"
  | "ATTENDANCE_FAILED"
  | "LOW_ATTENDANCE"
  | "UPCOMING_CLASS"
  | "SUSPICIOUS_ATTEMPT";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// API Responses
// ---------------------------------------------------------------------------
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
