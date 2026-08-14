import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api";
import { useAuthStore } from "@/store/authStore";
import type { UserRole } from "@/types";

/** Redirect map after successful login — based on role */
const ROLE_REDIRECT: Record<UserRole, string> = {
  STUDENT: "/student/dashboard",
  FACULTY: "/faculty/dashboard",
  DEPARTMENT_ADMIN: "/admin/dashboard",
  SUPER_ADMIN: "/admin/dashboard",
};

export function useLogin() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setAuth(data.user, data.tokens.access, data.tokens.refresh);

      // Redirect PENDING students to waiting screen
      if (
        data.user.role === "STUDENT" &&
        data.user.student_info?.approval_status === "PENDING"
      ) {
        navigate("/pending-approval", { replace: true });
        return;
      }

      navigate(ROLE_REDIRECT[data.user.role] ?? "/", { replace: true });
    },
  });
}
