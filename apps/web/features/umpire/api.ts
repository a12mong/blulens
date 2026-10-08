'use client';

import type { UseMutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Match = components['schemas']['Match'];

export type ReportResultPayload = {
  outcome: 'played' | 'walkover_a' | 'walkover_b';
  games?: Array<{ a: number; b: number }>;
  reason?: string;
};

export function useReportResult(
  matchId: string,
  options?: Omit<
    UseMutationOptions<Match, Error, ReportResultPayload>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (payload: ReportResultPayload) => {
      return apiFetch<Match>(`/matches/${matchId}/result`, {
        method: 'PUT',
        body: payload as any,
      });
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ['umpire', 'matches'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      (options?.onSuccess as any)?.(...args);
    },
  });
}
