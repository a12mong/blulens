'use client';

import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, type ApiRequestError } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Match = components['schemas']['Match'];
export type GroupStanding = components['schemas']['GroupStanding'];

export type MatchDecisionPayload = {
  matchId: string;
  action: 'approve' | 'reject';
  reason?: string;
};

export const reportedMatchesKey = (eventId: string) =>
  ['events', eventId, 'matches', 'reported'] as const;

export function useReportedMatches(
  eventId: string,
  options?: Omit<UseQueryOptions<Match[], ApiRequestError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: reportedMatchesKey(eventId),
    queryFn: async () =>
      apiFetch<Match[]>(`/events/${eventId}/matches`, {
        query: { status: 'reported' },
      }),
    ...options,
  });
}

export function useMatchDecision(
  eventId: string,
  options?: Omit<
    UseMutationOptions<Match, ApiRequestError, MatchDecisionPayload>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ matchId, action, reason }: MatchDecisionPayload) => {
      if (action === 'approve') {
        return apiFetch<Match>(`/matches/${matchId}/result/approve`, {
          method: 'POST',
        });
      }
      return apiFetch<Match>(`/matches/${matchId}/result/reject`, {
        method: 'POST',
        body: { reason: reason ?? '' },
      });
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'matches'] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'bracket'] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'standings'] });
      options?.onSuccess?.(...args);
    },
  });
}

export function useConfirmGroups(
  eventId: string,
  options?: Omit<
    UseMutationOptions<GroupStanding[], ApiRequestError, void>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async () => {
      return apiFetch<GroupStanding[]>(`/events/${eventId}/groups/confirm`, {
        method: 'POST',
      });
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'matches'] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'standings'] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'bracket'] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'groups'] });
      options?.onSuccess?.(...args);
    },
  });
}
