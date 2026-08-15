/**
 * FaceAttend — Face Enrollment API Client (Phase 9)
 */
import api from "@/services/api";

export type EnrollmentStatus = "PENDING" | "ACTIVE" | "FAILED" | "REVOKED";

export interface MyEnrollment {
  id: string;
  status: EnrollmentStatus;
  is_active: boolean;
  error_message: string;
  created_at: string;
  updated_at: string;
}

export interface AdminEnrollment {
  id: string;
  student: string;
  student_name: string;
  student_id_str: string;
  status: EnrollmentStatus;
  is_active: boolean;
  error_message: string;
  created_at: string;
  updated_at: string;
}

export const faceApi = {
  /**
   * Student: upload a face photo and enroll.
   * Returns the enrollment record.
   */
  enroll: async (imageFile: File): Promise<MyEnrollment> => {
    const form = new FormData();
    form.append("image", imageFile);
    const res = await api.post<{ success: boolean; data: MyEnrollment }>(
      "/face/enroll/",
      form,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return res.data.data;
  },

  /** Student: view own enrollment status (null if not enrolled). */
  myEnrollment: async (): Promise<MyEnrollment | null> => {
    const res = await api.get<{ success: boolean; data: MyEnrollment | null }>(
      "/face/my-enrollment/"
    );
    return res.data.data || null;
  },

  /** Student: delete own enrollment. */
  deleteEnrollment: async (): Promise<void> => {
    await api.delete("/face/my-enrollment/");
  },

  /** Admin/Faculty: list all enrollments. */
  listEnrollments: async (statusFilter?: string): Promise<AdminEnrollment[]> => {
    const params = statusFilter ? { status: statusFilter } : undefined;
    const res = await api.get<{ success: boolean; data: AdminEnrollment[] }>(
      "/face/enrollments/", { params }
    );
    return res.data.data;
  },

  /** Admin: revoke an enrollment. */
  revokeEnrollment: async (id: string): Promise<AdminEnrollment> => {
    const res = await api.post<{ success: boolean; data: AdminEnrollment }>(
      `/face/enrollments/${id}/revoke/`
    );
    return res.data.data;
  },
};
