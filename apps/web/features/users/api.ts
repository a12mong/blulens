import type { UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { ApiRequestError, apiFetch } from '@/lib/api/client';

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
