'use client';

import type { UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

type AssessmentStatus = components['schemas']['AssessmentStatus'];
type AssessmentPage = components['schemas']['AssessmentPage'];

export const assessmentsKey = (status?: AssessmentStatus) =>
  ['assessments', status ?? 'all'] as const;

export function useAssessments(
  status?: AssessmentStatus,
  options?: Omit<UseQueryOptions<AssessmentPage>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: assessmentsKey(status),
    queryFn: async () => {
      const query: Record<string, string | undefined> = { limit: '50' };
      if (status) query.status = status;
      return apiFetch<AssessmentPage>('/assessments', { query: query as any });
    },
    ...options,
  });
}

export type AssessmentDetail = components['schemas']['AssessmentDetail'];

export const assessmentDetailKey = (id: string) =>
  ['assessments', 'detail', id] as const;

export function useAssessmentDetail(
  id: string,
  options?: Omit<UseQueryOptions<AssessmentDetail>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: assessmentDetailKey(id),
    queryFn: async () => {
      return apiFetch<AssessmentDetail>(`/assessments/${id}`);
    },
    ...options,
  });
}

type RaterStats = components['schemas']['RaterStats'];

export const raterStatsKey = (window?: string) =>
  ['rater-stats', window ?? '90d'] as const;

export function useRaterStats(
  window?: '30d' | '90d' | '365d' | 'all',
  options?: Omit<UseQueryOptions<RaterStats>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: raterStatsKey(window),
    queryFn: async () => {
      const query: Record<string, string | undefined> = {};
      if (window) query.window = window;
      return apiFetch<RaterStats>('/rater-stats', { query: query as any });
    },
    ...options,
  });
}
