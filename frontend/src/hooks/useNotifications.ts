/**
 * FaceAttend — Phase 16: useNotifications hook
 *
 * Provides:
 *  - unreadCount: number  (polled every 30s)
 *  - notifications: NotificationItem[]
 *  - markRead(id): void
 *  - markAllRead(): void
 *  - refetch(): void
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi, type NotificationItem } from "@/features/notifications/api";
import { useAuthStore } from "@/store/authStore";

export function useNotifications() {
  const qc = useQueryClient();
  const isAuthed = !!useAuthStore((s) => s.user);

  const { data: countData } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: () => notificationsApi.unreadCount(),
    enabled: isAuthed,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const { data: listData, refetch } = useQuery({
    queryKey: ["notifications-list"],
    queryFn: () => notificationsApi.list(1),
    enabled: isAuthed,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
      qc.invalidateQueries({ queryKey: ["notifications-list"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
      qc.invalidateQueries({ queryKey: ["notifications-list"] });
    },
  });

  const unreadCount = countData?.data?.count ?? 0;
  const notifications: NotificationItem[] =
    listData?.data?.results ?? [];

  return {
    unreadCount,
    notifications,
    markRead: (id: string) => markReadMutation.mutate(id),
    markAllRead: () => markAllReadMutation.mutate(),
    refetch,
  };
}
