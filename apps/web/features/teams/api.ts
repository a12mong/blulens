import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiRequestError, apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type TeamSuggestion = {
  teamId: string;
  name: string;
  matchedAlias?: string | null;
  distance?: number;
};

export type TeamRequest = components['schemas']['TeamRequest'];

export function useTeamSuggestions(
  q: string,
  options?: Omit<UseQueryOptions<TeamSuggestion[], ApiRequestError>, 'queryKey' | 'queryFn'>,
) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: ['teams', 'suggest', q],
    queryFn: async () => {
      const data = await apiFetch<TeamSuggestion[]>('/teams/suggest', {
        query: { q, limit: 8 },
      });
      return data ?? [];
    },
    enabled: trimmed.length >= 1,
    ...options,
  });
}

export function useRequestTeam(
  options?: Omit<UseMutationOptions<TeamRequest, ApiRequestError, { name: string }>, 'mutationFn'>,
) {
  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      return await apiFetch<TeamRequest>('/team-requests', {
        method: 'POST',
        body: { name },
      });
    },
    ...options,
  });
}
