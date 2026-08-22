import api from "@/services/api";
import type { Faculty, PaginatedResponse } from "@/types";

interface CreateFacultyPayload {
  email: string;
  password: string;
  employee_id: string;
  full_name: string;
  phone?: string;
  department?: string;
  designation?: string;
  is_hod?: boolean;
}

export const facultyApi = {
  list: async (params?: { department?: string; search?: string; page_size?: number }): Promise<PaginatedResponse<Faculty>> => {
    const res = await api.get<{ success: boolean; data: PaginatedResponse<Faculty> }>("/faculty/", { params });
    return res.data.data;
  },
  create: async (data: CreateFacultyPayload): Promise<Faculty> => {
    const res = await api.post<{ success: boolean; data: Faculty }>("/faculty/", data);
    return res.data.data;
  },
  update: async (id: string, data: Partial<Faculty>): Promise<Faculty> => {
    const res = await api.patch<{ success: boolean; data: Faculty }>(`/faculty/${id}/`, data);
    return res.data.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/faculty/${id}/`);
  },
};
