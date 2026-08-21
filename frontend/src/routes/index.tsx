/**
 * FaceAttend — Route Definitions
 */
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import type { UserRole } from "@/types";

// Layouts
import AuthLayout from "@/layouts/AuthLayout";
import AppLayout from "@/layouts/AppLayout";

// Public pages
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import PendingApprovalPage from "@/pages/PendingApprovalPage";
import UnauthorizedPage from "@/pages/UnauthorizedPage";
import NotFound from "@/pages/NotFound";

// Admin pages
import AdminDashboard from "@/pages/admin/AdminDashboard";
import StudentsPage from "@/pages/admin/StudentsPage";
import FacultyPage from "@/pages/admin/FacultyPage";
import DepartmentsPage from "@/pages/admin/DepartmentsPage";
import SubjectsPage from "@/pages/admin/SubjectsPage";
import RoomsPage from "@/pages/admin/RoomsPage";
import AdminTimetablePage from "@/pages/admin/TimetablePage";
import ReportsPage from "@/pages/admin/ReportsPage";  // Phase 15
import NotificationsPage from "@/pages/NotificationsPage";  // Phase 16
import AuditLogsPage from "@/pages/admin/AuditLogsPage";  // Phase 17
import AdminAIInsightsPage from "@/pages/admin/AdminAIInsightsPage";  // Phase 18

// Faculty pages
import FacultyDashboard from "@/pages/faculty/FacultyDashboard";  // Phase 14
import FacultyTimetablePage from "@/pages/faculty/TimetablePage";
import FacultyAttendancePage from "@/pages/faculty/AttendancePage";

// Student pages
import StudentDashboard from "@/pages/student/StudentDashboard";
import StudentAttendancePage from "@/pages/student/AttendancePage";
import FaceEnrollmentPage from "@/pages/student/FaceEnrollmentPage";
import StudentAIInsightsPage from "@/pages/student/StudentAIInsightsPage";  // Phase 18

/** Redirect authenticated users away from auth pages */
function GuestOnly() {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Outlet />;

  // Redirect to appropriate dashboard
  if (user?.role === "STUDENT") return <Navigate to="/student/dashboard" replace />;
  if (user?.role === "FACULTY") return <Navigate to="/faculty/dashboard" replace />;
  return <Navigate to="/admin/dashboard" replace />;
}

/** Require authentication + optional role check */
function RequireAuth({ allowedRoles }: { allowedRoles?: UserRole[] }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  return <Outlet />;
}

export const router = createBrowserRouter([
  // ---------------------------------------------------------------------------
  // Guest-only routes (auth pages)
  // ---------------------------------------------------------------------------
  {
    element: <GuestOnly />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: "/login", element: <LoginPage /> },
          { path: "/register", element: <RegisterPage /> },
          { path: "/forgot-password", element: <ForgotPasswordPage /> },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Pending approval (authenticated student, any approval status)
  // ---------------------------------------------------------------------------
  {
    element: <RequireAuth allowedRoles={["STUDENT"]} />,
    children: [
      { path: "/pending-approval", element: <PendingApprovalPage /> },
    ],
  },

  // ---------------------------------------------------------------------------
  // Admin routes (DEPARTMENT_ADMIN + SUPER_ADMIN)
  // ---------------------------------------------------------------------------
  {
    element: <RequireAuth allowedRoles={["DEPARTMENT_ADMIN", "SUPER_ADMIN"]} />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/admin/dashboard",   element: <AdminDashboard /> },
          { path: "/admin/students",    element: <StudentsPage /> },
          { path: "/admin/faculty",     element: <FacultyPage /> },
          { path: "/admin/departments", element: <DepartmentsPage /> },
          { path: "/admin/subjects",    element: <SubjectsPage /> },
          { path: "/admin/rooms",       element: <RoomsPage /> },
          { path: "/admin/timetable",   element: <AdminTimetablePage /> },
          { path: "/admin/reports",         element: <ReportsPage /> },  // Phase 15
          { path: "/admin/notifications",    element: <NotificationsPage /> },  // Phase 16
          { path: "/admin/audit-logs",       element: <AuditLogsPage /> },  // Phase 17
          { path: "/admin/ai-insights",       element: <AdminAIInsightsPage /> },  // Phase 18
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Faculty routes
  // ---------------------------------------------------------------------------
  {
    element: <RequireAuth allowedRoles={["FACULTY"]} />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/faculty/dashboard",  element: <FacultyDashboard /> },  // Phase 14
          { path: "/faculty/timetable",  element: <FacultyTimetablePage /> },
          { path: "/faculty/attendance", element: <FacultyAttendancePage /> },
          { path: "/faculty/reports",        element: <ReportsPage /> },  // Phase 15
          { path: "/faculty/notifications",   element: <NotificationsPage /> },  // Phase 16
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Student routes
  // ---------------------------------------------------------------------------
  {
    element: <RequireAuth allowedRoles={["STUDENT"]} />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/student/dashboard",   element: <StudentDashboard /> },
          { path: "/student/attendance",   element: <StudentAttendancePage /> },
          { path: "/student/face-enroll",  element: <FaceEnrollmentPage /> },
          { path: "/student/reports",        element: <ReportsPage /> },  // Phase 15
          { path: "/student/notifications",   element: <NotificationsPage /> },  // Phase 16
          { path: "/student/ai-insights",      element: <StudentAIInsightsPage /> },  // Phase 18
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Catch-all / utility
  // ---------------------------------------------------------------------------
  { path: "/unauthorized", element: <UnauthorizedPage /> },
  { path: "/", element: <Navigate to="/login" replace /> },
  { path: "*", element: <NotFound /> },
]);
