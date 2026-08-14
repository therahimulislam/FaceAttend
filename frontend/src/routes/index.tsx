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

// Student pages
import StudentDashboard from "@/pages/student/StudentDashboard";

/** Redirect authenticated users away from auth pages */
function GuestOnly() {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Outlet />;

  // Redirect to appropriate dashboard
  if (user?.role === "STUDENT") return <Navigate to="/student/dashboard" replace />;
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
          { path: "/student/dashboard", element: <StudentDashboard /> },
          // Phase 7+: attendance marking, face enrollment, etc.
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
