'use client';

import type { UseMutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, type ApiRequestError } from '@/lib/api/client';
import type { Draw, PublishDrawPayload } from './api';
export { usePublishDraw, type Draw, type PublishDrawPayload } from './api';

export type PreviewKnockoutPayload = {
  seed?: string;
  reason?: string;
};

export function usePreviewKnockout(
  eventId: string,
  options?: Omit<
    UseMutationOptions<Draw, ApiRequestError, PreviewKnockoutPayload | void>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (payload) =>
      apiFetch<Draw>(`/events/${eventId}/knockout/preview`, {
        method: 'POST',
        body: {
          ...(payload?.seed ? { seed: payload.seed } : {}),
          ...(payload?.reason ? { reason: payload.reason } : {}),
        },
      }),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        queryKey: ['events', eventId, 'knockout', 'preview'],
      });
      queryClient.invalidateQueries({
        queryKey: ['events', eventId, 'bracket'],
      });
      options?.onSuccess?.(...args);
    },
  });
}
