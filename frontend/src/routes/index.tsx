/**
 * FaceAttend — Route Definitions
 */
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import type { UserRole } from "@/types";

// Layouts
import AuthLayout from "@/layouts/AuthLayout";

// Public pages
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import PendingApprovalPage from "@/pages/PendingApprovalPage";
import UnauthorizedPage from "@/pages/UnauthorizedPage";
import NotFound from "@/pages/NotFound";

/** Redirect authenticated users away from auth pages */
function GuestOnly() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Outlet />;
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
  // Authenticated routes
  // ---------------------------------------------------------------------------
  {
    element: <RequireAuth />,
    children: [
      { path: "/pending-approval", element: <PendingApprovalPage /> },

      // Student dashboard (Phase 7)
      // { path: "/student/*", element: <StudentLayout />, ... }

      // Faculty dashboard (Phase 6)
      // { path: "/faculty/*", element: <FacultyLayout />, ... }

      // Admin dashboard (Phase 11+)
      // { path: "/admin/*", element: <AdminLayout />, ... }
    ],
  },

  // ---------------------------------------------------------------------------
  // Catch-all / utility
  // ---------------------------------------------------------------------------
  { path: "/unauthorized", element: <UnauthorizedPage /> },
  { path: "/", element: <Navigate to="/login" replace /> },
  { path: "*", element: <NotFound /> },
]);
