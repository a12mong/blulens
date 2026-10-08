'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Rubric = components['schemas']['Rubric'];
export type RubricCriterion = Rubric['criteria'][number];

export const rubricsKey = ['rubrics'] as const;

export function useRubrics() {
  return useQuery({
    queryKey: rubricsKey,
    queryFn: async () => (await apiFetch<Rubric[]>('/rubrics')) ?? [],
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: rubricsKey });
    queryClient.invalidateQueries({ queryKey: ['rubric'] });
  };
}

export function useCreateRubricDraft() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async () => apiFetch<Rubric>('/rubrics', { method: 'POST', body: {} }),
    onSuccess: invalidate,
  });
}

export function useDeleteRubric() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch<void>(`/rubrics/${id}`, { method: 'DELETE' });
    },
    onSuccess: invalidate,
  });
}

export function useActivateRubric() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { id: string; reason: string }) =>
      apiFetch<Rubric>(`/rubrics/${input.id}/activate`, {
        method: 'POST',
        body: { reason: input.reason },
      }),
    onSuccess: invalidate,
  });
}

export function useSaveRubric() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { id: string; criteria: RubricCriterion[] }) =>
      apiFetch<Rubric>(`/rubrics/${input.id}`, {
        method: 'PUT',
        body: { criteria: input.criteria },
      }),
    onSuccess: invalidate,
  });
}
