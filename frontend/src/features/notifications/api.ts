/**
 * FaceAttend — Phase 16: Notifications API
 */
import api from "@/services/api";

export type NotificationCategory =
  | "REGISTRATION_APPROVED"
  | "REGISTRATION_REJECTED"
  | "ATTENDANCE_SUCCESS"
  | "ATTENDANCE_FAILED"
  | "LOW_ATTENDANCE"
  | "UPCOMING_CLASS"
  | "SUSPICIOUS_ATTEMPT";

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PaginatedNotifications {
  count: number;
  next: string | null;
  previous: string | null;
  results: NotificationItem[];
}

const BASE = "/notifications";

export const notificationsApi = {
  list: (page = 1): Promise<{ data: PaginatedNotifications }> =>
    api.get(`${BASE}/?page=${page}`).then((r) => r.data),

  unreadCount: (): Promise<{ data: { count: number } }> =>
    api.get(`${BASE}/unread_count/`).then((r) => r.data),

  markRead: (id: string): Promise<{ data: NotificationItem }> =>
    api.post(`${BASE}/${id}/mark_read/`).then((r) => r.data),

  markAllRead: (): Promise<{ data: { marked_read: number } }> =>
    api.post(`${BASE}/mark_all_read/`).then((r) => r.data),
};
