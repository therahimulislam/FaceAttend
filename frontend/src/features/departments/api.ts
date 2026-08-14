import api from "@/services/api";
import type { Department, PaginatedResponse } from "@/types";

export const departmentsApi = {
  list: async (params?: { status?: string }): Promise<PaginatedResponse<Department>> => {
    const res = await api.get<{ success: boolean; data: PaginatedResponse<Department> }>("/departments/", { params });
    return res.data.data;
  },
  create: async (data: Partial<Department>): Promise<Department> => {
    const res = await api.post<{ success: boolean; data: Department }>("/departments/", data);
    return res.data.data;
  },
};
