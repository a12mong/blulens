'use client';

import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, type ApiRequestError } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Draw = components['schemas']['Draw'];
export type Group = components['schemas']['Group'];

export type PreviewGroupsPayload = {
  seed?: string;
  reason?: string;
};

export type PublishDrawPayload = {
  drawId: string;
  eventId: string;
  acknowledgeConflicts?: boolean;
  reason?: string;
};

export const groupsKey = (eventId: string, draw: 'preview' | 'published' = 'published') =>
  ['events', eventId, 'groups', draw] as const;

export function useGroups(
  eventId: string,
  draw: 'preview' | 'published' = 'published',
  options?: Omit<UseQueryOptions<Group[], ApiRequestError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: groupsKey(eventId, draw),
    queryFn: async () =>
      apiFetch<Group[]>(`/events/${eventId}/groups`, {
        query: { draw },
      }),
    ...options,
  });
}

export function usePreviewGroups(
  eventId: string,
  options?: Omit<UseMutationOptions<Draw, ApiRequestError, PreviewGroupsPayload | void>, 'mutationFn'>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (payload) =>
      apiFetch<Draw>(`/events/${eventId}/groups/preview`, {
        method: 'POST',
        body: payload?.seed ? { seed: payload.seed } : {},
      }),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'groups', 'preview'] });
      options?.onSuccess?.(...args);
    },
  });
}

export function usePublishDraw(
  options?: Omit<UseMutationOptions<Draw, ApiRequestError, PublishDrawPayload>, 'mutationFn'>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ drawId, acknowledgeConflicts, reason }: PublishDrawPayload) =>
      apiFetch<Draw>(`/draws/${drawId}/publish`, {
        method: 'POST',
        body: { acknowledgeConflicts, reason },
      }),
    onSuccess: (data, variables, ...rest) => {
      const eventId = variables.eventId;
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'matches'] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'standings'] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'bracket'] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'groups'] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'groups', 'preview'] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'groups', 'published'] });
      options?.onSuccess?.(data, variables, ...rest);
    },
  });
}
