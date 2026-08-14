/**
 * FaceAttend — Academics API (Subjects, Rooms, Semesters, Sections, Academic Years)
 */
import api from "@/services/api";
import type { PaginatedResponse } from "@/types";

// ---- Types ----
export interface Subject {
  id: string;
  code: string;
  name: string;
  department: string;
  department_name: string;
  department_code: string;
  credits: number;
  hours_per_week: number;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  name: string;
  building: string;
  floor: number;
  capacity: number;
  latitude: string | null;
  longitude: string | null;
  geofence_radius: number;
  has_gps: boolean;
  status: "ACTIVE" | "INACTIVE" | "UNDER_MAINTENANCE";
  created_at: string;
  updated_at: string;
}

export interface AcademicYear {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
}

export interface Semester {
  id: string;
  name: string;
  number: number | null;
  department: string;
  department_name: string;
  academic_year: string;
  academic_year_label: string;
  start_date: string | null;
  end_date: string | null;
  status: "UPCOMING" | "ACTIVE" | "COMPLETED";
  is_current: boolean;
  sections: Section[];
  created_at: string;
}

export interface Section {
  id: string;
  name: string;
  capacity: number;
  status: "ACTIVE" | "INACTIVE";
  semester: string;
}

// ---- Subjects ----
export const subjectsApi = {
  list: async (params?: { department?: string; status?: string; search?: string; page_size?: number }): Promise<PaginatedResponse<Subject>> => {
    const res = await api.get<{ success: boolean; data: PaginatedResponse<Subject> }>("/academics/subjects/", { params });
    return res.data.data;
  },
  create: async (data: Partial<Subject>): Promise<Subject> => {
    const res = await api.post<Subject>("/academics/subjects/", data);
    return res.data;
  },
  update: async (id: string, data: Partial<Subject>): Promise<Subject> => {
    const res = await api.patch<Subject>(`/academics/subjects/${id}/`, data);
    return res.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/academics/subjects/${id}/`);
  },
};

// ---- Rooms ----
export const roomsApi = {
  list: async (params?: { status?: string; building?: string; search?: string; page_size?: number }): Promise<PaginatedResponse<Room>> => {
    const res = await api.get<{ success: boolean; data: PaginatedResponse<Room> }>("/academics/rooms/", { params });
    return res.data.data;
  },
  create: async (data: Partial<Room>): Promise<Room> => {
    const res = await api.post<Room>("/academics/rooms/", data);
    return res.data;
  },
  update: async (id: string, data: Partial<Room>): Promise<Room> => {
    const res = await api.patch<Room>(`/academics/rooms/${id}/`, data);
    return res.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/academics/rooms/${id}/`);
  },
};

// ---- Semesters & Sections ----
export const semestersApi = {
  list: async (params?: { department?: string; status?: string; is_current?: boolean; page_size?: number }): Promise<PaginatedResponse<Semester>> => {
    const res = await api.get<{ success: boolean; data: PaginatedResponse<Semester> }>("/academics/semesters/", { params });
    return res.data.data;
  },
  create: async (data: Partial<Semester>): Promise<Semester> => {
    const res = await api.post<Semester>("/academics/semesters/", data);
    return res.data;
  },
  update: async (id: string, data: Partial<Semester>): Promise<Semester> => {
    const res = await api.patch<Semester>(`/academics/semesters/${id}/`, data);
    return res.data;
  },
};

export const sectionsApi = {
  list: async (params?: { semester?: string; page_size?: number }): Promise<PaginatedResponse<Section>> => {
    const res = await api.get<{ success: boolean; data: PaginatedResponse<Section> }>("/academics/sections/", { params });
    return res.data.data;
  },
  create: async (data: Partial<Section>): Promise<Section> => {
    const res = await api.post<Section>("/academics/sections/", data);
    return res.data;
  },
};

export const academicYearsApi = {
  list: async (): Promise<PaginatedResponse<AcademicYear>> => {
    const res = await api.get<{ success: boolean; data: PaginatedResponse<AcademicYear> }>("/academics/years/");
    return res.data.data;
  },
  create: async (data: Partial<AcademicYear>): Promise<AcademicYear> => {
    const res = await api.post<AcademicYear>("/academics/years/", data);
    return res.data;
  },
};
