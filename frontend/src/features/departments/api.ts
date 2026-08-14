import api from "@/services/api";
import type { Department, PaginatedResponse } from "@/types";

export const departmentsApi = {
  list: async (params?: { status?: string; search?: string; page_size?: number }): Promise<PaginatedResponse<Department>> => {
    const res = await api.get<{ success: boolean; data: PaginatedResponse<Department> }>("/departments/", { params });
    return res.data.data;
  },
  retrieve: async (id: string): Promise<Department> => {
    const res = await api.get<{ success: boolean; data: Department }>(`/departments/${id}/`);
    return res.data.data;
  },
  create: async (data: Partial<Department>): Promise<Department> => {
    const res = await api.post<Department>("/departments/", data);
    return res.data;
  },
  update: async (id: string, data: Partial<Department>): Promise<Department> => {
    const res = await api.patch<Department>(`/departments/${id}/`, data);
    return res.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/departments/${id}/`);
  },
};
