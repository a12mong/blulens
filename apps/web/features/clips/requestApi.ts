'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

type Assessment = components['schemas']['Assessment'];

export function useCreateAssessment() {
  return useMutation({
    mutationFn: async (input: { note?: string }) =>
      apiFetch<Assessment>('/assessments', {
        method: 'POST',
        body: input.note ? { note: input.note } : {},
      }),
  });
}

export function useSubmitAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (assessmentId: string) =>
      apiFetch<Assessment>(`/assessments/${assessmentId}/submit`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
    },
  });
}
