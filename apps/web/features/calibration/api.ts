'use client';

import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

type CalibrationSet = components['schemas']['CalibrationSet'];

export type { CalibrationSet };

export type CreateCalibrationSetPayload = {
  name: string;
  period?: string;
};

export const calibrationSetsKey = ['calibration-sets'] as const;

export function useCalibrationSets(
  options?: Omit<UseQueryOptions<CalibrationSet[], ApiRequestError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: calibrationSetsKey,
    queryFn: async () => {
      const data = await apiFetch<CalibrationSet[]>('/calibration-sets');
      return data ?? [];
    },
    ...options,
  });
}

export function useCreateCalibrationSet(
  options?: Omit<
    UseMutationOptions<CalibrationSet, ApiRequestError, CreateCalibrationSetPayload>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ name, period }: CreateCalibrationSetPayload) => {
      return apiFetch<CalibrationSet>('/calibration-sets', {
        method: 'POST',
        body: {
          name,
          ...(period ? { period } : {}),
        },
      });
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: calibrationSetsKey });
      options?.onSuccess?.(...args);
    },
  });
}
