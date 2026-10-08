'use client';

import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

export type AssessmentAction = 'confirm' | 'approve' | 'return' | 'override';

export type AssessmentActionPayload = {
  action: AssessmentAction;
  body?: unknown;
};

export function useAssessmentAction(
  id: string,
  options?: Omit<
    UseMutationOptions<AssessmentDetail, Error, AssessmentActionPayload>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ action, body }: AssessmentActionPayload) => {
      return apiFetch<AssessmentDetail>(`/assessments/${id}/${action}`, {
        method: 'POST',
        body: body as any,
      });
    },
    onSuccess: (...args) => {
      queryClient.setQueryData(assessmentDetailKey(id), args[0]);
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      (options?.onSuccess as any)?.(...args);
    },
  });
}

