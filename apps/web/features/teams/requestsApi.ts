'use client';

import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, apiFetch } from '@/lib/api/client';
import type { TeamRequest } from './api';

export type { TeamRequest };

export type ResolveTeamRequestPayload = {
  requestId: string;
  action: 'create_team' | 'alias_to_team' | 'reject';
  teamId?: string;
  reason?: string;
};

export const teamRequestsKey = ['team-requests'] as const;

export function useTeamRequests(
  options?: Omit<UseQueryOptions<TeamRequest[], ApiRequestError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: teamRequestsKey,
    queryFn: async () => {
      const data = await apiFetch<TeamRequest[]>('/team-requests');
      return data ?? [];
    },
    ...options,
  });
}

export function useResolveTeamRequest(
  options?: Omit<
    UseMutationOptions<TeamRequest, ApiRequestError, ResolveTeamRequestPayload>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ requestId, action, teamId, reason }: ResolveTeamRequestPayload) => {
      return apiFetch<TeamRequest>(`/team-requests/${requestId}/resolve`, {
        method: 'POST',
        body: {
          action,
          ...(teamId ? { teamId } : {}),
          ...(reason !== undefined ? { reason } : {}),
        },
      });
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: teamRequestsKey });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      options?.onSuccess?.(...args);
    },
  });
}
