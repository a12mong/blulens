'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Notification = components['schemas']['Notification'];
export type NotificationPage = components['schemas']['NotificationPage'];

export const NOTIFICATIONS_POLL_MS = 60_000;

export const notificationsEnabled = () => process.env.NEXT_PUBLIC_NOTIFICATIONS !== '0';

export const unreadCountKey = ['notifications', 'unread-count'] as const;
export const notificationsKey = ['notifications', 'list'] as const;

/** Bell: limit=1 just to read unreadCount; every 60 s and on window focus. */
export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: unreadCountKey,
    queryFn: async () => {
      const page = await apiFetch<NotificationPage>('/me/notifications', { query: { limit: '1' } });
      return page?.unreadCount ?? 0;
    },
    enabled,
    refetchInterval: NOTIFICATIONS_POLL_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export function useNotifications() {
  return useInfiniteQuery({
    queryKey: notificationsKey,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const query: Record<string, string> = { limit: '20' };
      if (pageParam) query.cursor = pageParam;
      return apiFetch<NotificationPage>('/me/notifications', { query });
    },
    getNextPageParam: (last) => last?.nextCursor ?? undefined,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch<void>(`/me/notifications/${id}/read`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      apiFetch<{ updated: number }>('/me/notifications/read-all', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
