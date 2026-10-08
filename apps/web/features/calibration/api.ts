'use client';

import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

type CalibrationSet = components['schemas']['CalibrationSet'];
type CalibrationSetDetail = components['schemas']['CalibrationSetDetail'];
type Clip = components['schemas']['Clip'];

export type { CalibrationSet, CalibrationSetDetail, Clip };

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

export function useCalibrationSet(
  setId: string,
  options?: Omit<UseQueryOptions<CalibrationSetDetail, ApiRequestError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: ['calibration-sets', setId],
    queryFn: async () => {
      return apiFetch<CalibrationSetDetail>(`/calibration-sets/${setId}`);
    },
    ...options,
  });
}

export type RequestCalibrationClipPayload = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  referenceKey: string;
};

export type RequestCalibrationClipResponse = {
  clipId: string;
  uploadUrl: string;
  expiresAt: string;
};

export function useRequestCalibrationClip(
  setId: string,
  options?: Omit<
    UseMutationOptions<RequestCalibrationClipResponse, ApiRequestError, RequestCalibrationClipPayload>,
    'mutationFn'
  >,
) {
  return useMutation({
    ...options,
    mutationFn: async (payload: RequestCalibrationClipPayload) => {
      return apiFetch<RequestCalibrationClipResponse>(
        `/calibration-sets/${setId}/clips/upload-url`,
        {
          method: 'POST',
          body: payload,
        },
      );
    },
  });
}

export type CompleteCalibrationClipPayload = {
  clipId: string;
  durationSec: number;
};

export function useCompleteCalibrationClip(
  setId: string,
  options?: Omit<
    UseMutationOptions<CalibrationSetDetail, ApiRequestError, CompleteCalibrationClipPayload>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ clipId, durationSec }: CompleteCalibrationClipPayload) => {
      return apiFetch<CalibrationSetDetail>(
        `/calibration-sets/${setId}/clips/${clipId}/complete`,
        {
          method: 'POST',
          body: { durationSec },
        },
      );
    },
    onSuccess: (...args) => {
      const [data] = args;
      queryClient.setQueryData(['calibration-sets', setId], data);
      queryClient.invalidateQueries({ queryKey: calibrationSetsKey });
      options?.onSuccess?.(...args);
    },
  });
}

export type UpdateCalibrationClipPayload = {
  clipId: string;
  referenceKey: string;
};

export function useUpdateCalibrationClip(
  setId: string,
  options?: Omit<
    UseMutationOptions<CalibrationSetDetail, ApiRequestError, UpdateCalibrationClipPayload>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ clipId, referenceKey }: UpdateCalibrationClipPayload) => {
      return apiFetch<CalibrationSetDetail>(
        `/calibration-sets/${setId}/clips/${clipId}`,
        {
          method: 'PATCH',
          body: { referenceKey },
        },
      );
    },
    onSuccess: (...args) => {
      const [data] = args;
      queryClient.setQueryData(['calibration-sets', setId], data);
      queryClient.invalidateQueries({ queryKey: calibrationSetsKey });
      options?.onSuccess?.(...args);
    },
  });
}

export type DeleteCalibrationClipPayload = {
  clipId: string;
};

export function useDeleteCalibrationClip(
  setId: string,
  options?: Omit<
    UseMutationOptions<CalibrationSetDetail, ApiRequestError, DeleteCalibrationClipPayload>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ clipId }: DeleteCalibrationClipPayload) => {
      await apiFetch<void>(
        `/calibration-sets/${setId}/clips/${clipId}`,
        {
          method: 'DELETE',
        },
      );
      return queryClient.getQueryData<CalibrationSetDetail>(['calibration-sets', setId])!;
    },
    onSuccess: (...args) => {
      const [data] = args;
      queryClient.setQueryData(['calibration-sets', setId], data);
      queryClient.invalidateQueries({ queryKey: calibrationSetsKey });
      options?.onSuccess?.(...args);
    },
  });
}
