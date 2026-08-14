import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api";
import { useAuthStore } from "@/store/authStore";
import { queryClient } from "@/lib/queryClient";

export function useLogout() {
  const navigate = useNavigate();
  const { refreshToken, clearAuth } = useAuthStore();

  return useMutation({
    mutationFn: () => authApi.logout(refreshToken ?? ""),
    onSettled: () => {
      // Always clear local state even if request fails
      clearAuth();
      queryClient.clear();
      navigate("/login", { replace: true });
    },
  });
}
