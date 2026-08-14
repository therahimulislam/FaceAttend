/**
 * FaceAttend — Auth API Calls
 */
import api from "@/services/api";
import type { User, AuthTokens } from "@/types";

interface LoginPayload {
  email: string;
  password: string;
}

interface RegisterPayload {
  email: string;
  password: string;
  confirm_password: string;
  full_name: string;
  student_id: string;
  phone?: string;
  department_name: string;
  semester_name: string;
  section_name: string;
}

interface AuthResponse {
  user: User & { student_info?: { approval_status: string; full_name: string } | null };
  tokens: AuthTokens;
}

export const authApi = {
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const res = await api.post<{ success: boolean; data: AuthResponse }>("/auth/login/", payload);
    return res.data.data;
  },

  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    const res = await api.post<{ success: boolean; data: AuthResponse }>("/auth/register/", payload);
    return res.data.data;
  },

  logout: async (refreshToken: string): Promise<void> => {
    await api.post("/auth/logout/", { refresh: refreshToken });
  },

  refresh: async (refreshToken: string): Promise<{ access: string; refresh: string }> => {
    const res = await api.post<{ success: boolean; data: { access: string; refresh: string } }>(
      "/auth/refresh/",
      { refresh: refreshToken }
    );
    return res.data.data;
  },

  me: async () => {
    const res = await api.get<{ success: boolean; data: User }>("/auth/me/");
    return res.data.data;
  },

  forgotPassword: async (email: string): Promise<void> => {
    await api.post("/auth/forgot-password/", { email });
  },

  resetPassword: async (payload: {
    uid: string;
    token: string;
    new_password: string;
    confirm_password: string;
  }): Promise<void> => {
    await api.post("/auth/reset-password/", payload);
  },
};
