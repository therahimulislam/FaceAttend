/**
 * FaceAttend — Route Definitions
 * Route guards are enforced here. Backend enforces permissions too.
 */
import { createBrowserRouter, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import type { UserRole } from "@/types";

// Lazy imports (added as pages are built in later phases)
import NotFound from "@/pages/NotFound";

/** Guard: redirect to login if not authenticated */
function RequireAuth({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: UserRole[] }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

export const router = createBrowserRouter([
  // --- Public routes (added in Phase 2) ---
  {
    path: "/",
    element: <Navigate to="/login" replace />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);
