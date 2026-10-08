import type { UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { ApiRequestError, apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type UserSummary = {
  id: string;
  displayName: string;
  roles?: string[];
  teamId?: string | null;
};

export type UsersResponse = {
  items: UserSummary[];
  nextCursor?: string | null;
};

export type UserPickerItem = components['schemas']['UserPickerItem'];

export type ReviewersResponse = {
  items: UserPickerItem[];
  nextCursor?: string | null;
};

export function usePlayerSearch(
  q: string,
  options?: Omit<UseQueryOptions<UserSummary[], ApiRequestError>, 'queryKey' | 'queryFn'>,
) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: ['users', 'players', q],
    queryFn: async () => {
      const res = await apiFetch<UsersResponse>('/users', {
        query: { role: 'Member', q, limit: 8 },
      });
      return res?.items ?? [];
    },
    enabled: trimmed.length >= 1,
    ...options,
  });
}

export function useReviewerSearch(
  q: string,
  options?: Omit<UseQueryOptions<UserPickerItem[], ApiRequestError>, 'queryKey' | 'queryFn'>,
) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: ['users', 'reviewers', q],
    queryFn: async () => {
      const res = await apiFetch<ReviewersResponse>('/users', {
        query: { role: 'Reviewer', q, limit: 8 },
      });
      return res?.items ?? [];
    },
    enabled: trimmed.length >= 1,
    ...options,
  });
}

