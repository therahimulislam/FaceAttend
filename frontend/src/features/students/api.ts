import api from "@/services/api";
import type { Student, PaginatedResponse } from "@/types";

interface StudentFilters {
  approval_status?: string;
  department?: string;
  semester?: string;
  section?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export const studentsApi = {
  list: async (filters?: StudentFilters): Promise<PaginatedResponse<Student>> => {
    const res = await api.get<{ success: boolean; data: PaginatedResponse<Student> }>(
      "/students/",
      { params: filters }
    );
    return res.data.data;
  },

  retrieve: async (id: string): Promise<Student> => {
    const res = await api.get<{ success: boolean; data: Student }>(`/students/${id}/`);
    return res.data.data;
  },

  approve: async (id: string, data?: { department?: string; semester?: string; section?: string }): Promise<Student> => {
    const res = await api.post<{ success: boolean; data: Student }>(`/students/${id}/approve/`, data ?? {});
    return res.data.data;
  },

  reject: async (id: string, rejection_reason?: string): Promise<Student> => {
    const res = await api.post<{ success: boolean; data: Student }>(`/students/${id}/reject/`, { rejection_reason });
    return res.data.data;
  },

  suspend: async (id: string): Promise<Student> => {
    const res = await api.post<{ success: boolean; data: Student }>(`/students/${id}/suspend/`);
    return res.data.data;
  },

  me: async (): Promise<Student> => {
    const res = await api.get<{ success: boolean; data: Student }>("/students/me/");
    return res.data.data;
  },
};
