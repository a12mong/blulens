'use client';

import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

type Rubric = components['schemas']['Rubric'];

export type RubricItem = {
  key: string;
  nameTh: string;
  weight: number;
  anchorsTh?: Record<string, string>;
  hasReviews?: boolean;
};

export type RubricDetail = {
  id: string;
  name: string;
  methodVersion: string;
  createdAt: string;
  activatedAt: string | null;
  criteria: RubricItem[];
};

export { type Rubric };

export const rubricsKey = ['rubrics'] as const;

export function useRubrics(
  options?: Omit<UseQueryOptions<RubricDetail[], ApiRequestError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: rubricsKey,
    queryFn: async () => {
      const data = await apiFetch<RubricDetail[]>('/rubrics');
      return data ?? [];
    },
    ...options,
  });
}

export function useRubric(
  rubricId: string,
  options?: Omit<UseQueryOptions<RubricDetail, ApiRequestError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: ['rubrics', rubricId],
    queryFn: async () => {
      return apiFetch<RubricDetail>(`/rubrics/${rubricId}`);
    },
    ...options,
  });
}

export type CreateRubricPayload = {
  name: string;
};

export function useCreateRubric(
  options?: Omit<UseMutationOptions<RubricDetail, ApiRequestError, CreateRubricPayload>, 'mutationFn'>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ name }: CreateRubricPayload) => {
      return apiFetch<RubricDetail>('/rubrics', {
        method: 'POST',
        body: { name },
      });
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: rubricsKey });
      options?.onSuccess?.(...args);
    },
  });
}

export type UpdateRubricPayload = {
  criteria: RubricItem[];
};

export function useUpdateRubric(
  rubricId: string,
  options?: Omit<UseMutationOptions<RubricDetail, ApiRequestError, UpdateRubricPayload>, 'mutationFn'>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ criteria }: UpdateRubricPayload) => {
      return apiFetch<RubricDetail>(`/rubrics/${rubricId}`, {
        method: 'PATCH',
        body: { criteria },
      });
    },
    onSuccess: (...args) => {
      const [data] = args;
      queryClient.setQueryData(['rubrics', rubricId], data);
      queryClient.invalidateQueries({ queryKey: rubricsKey });
      options?.onSuccess?.(...args);
    },
  });
}

export function useDeleteRubric(
  options?: Omit<UseMutationOptions<void, ApiRequestError, string>, 'mutationFn'>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (rubricId: string) => {
      await apiFetch<void>(`/rubrics/${rubricId}`, { method: 'DELETE' });
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: rubricsKey });
      options?.onSuccess?.(...args);
    },
  });
}

export type CopyRubricPayload = {
  copyFrom: string;
  name: string;
};

export function useCopyRubric(
  options?: Omit<UseMutationOptions<RubricDetail, ApiRequestError, CopyRubricPayload>, 'mutationFn'>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ copyFrom, name }: CopyRubricPayload) => {
      return apiFetch<RubricDetail>('/rubrics', {
        method: 'POST',
        body: { copyFrom, name },
      });
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: rubricsKey });
      options?.onSuccess?.(...args);
    },
  });
}
