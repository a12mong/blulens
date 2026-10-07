'use client';

import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Entry = components['schemas']['Entry'];
export type EntryInput = components['schemas']['EntryInput'];

export const entriesKey = (eventId: string, status?: string) =>
  ['entries', eventId, status ?? 'all'] as const;
export const queueKey = (eventId?: string) => ['entries', 'queue', eventId ?? 'all'] as const;

/**
 * Fetch entries for an event, optionally filtered by status.
 * Refetches every 30 seconds.
 */
export function useEntries(
  eventId: string,
  status?: string,
  options?: Omit<UseQueryOptions<Entry[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: entriesKey(eventId, status),
    queryFn: async () => {
      const query: Record<string, string | undefined> = {};
      if (status) query.status = status;
      return apiFetch<Entry[]>(`/events/${eventId}/entries`, { query: query as any });
    },
    refetchInterval: 30_000,
    ...options,
  });
}

/**
 * Fetch the committee queue (pending_committee entries).
 * Optionally filtered by event.
 * Refetches every 30 seconds.
 */
export function useCommitteeQueue(
  eventId?: string,
  options?: Omit<UseQueryOptions<Entry[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queueKey(eventId),
    queryFn: async () => {
      const query: Record<string, string | undefined> = { status: 'pending_committee' };
      if (eventId) query.eventId = eventId;
      return apiFetch<Entry[]>('/entries', { query: query as any });
    },
    refetchInterval: 30_000,
    ...options,
  });
}

/**
 * Create a new entry (starts in draft status).
 */
export function useCreateEntry(
  eventId: string,
  options?: Omit<UseMutationOptions<Entry, ApiRequestError, EntryInput>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body) =>
      apiFetch<Entry>(`/events/${eventId}/entries`, {
        method: 'POST',
        body,
      }),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      options?.onSuccess?.(...args);
    },
  });
}

/**
 * Forward an entry from draft to pending_committee.
 */
export function useForwardEntry(
  options?: Omit<UseMutationOptions<Entry, ApiRequestError, { entryId: string }>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entryId }) =>
      apiFetch<Entry>(`/entries/${entryId}/forward`, {
        method: 'POST',
      }),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      options?.onSuccess?.(...args);
    },
  });
}

/**
 * Approve an entry (Committee action).
 * Optional reason required if status needs to be out-of-band.
 */
export function useApproveEntry(
  options?: Omit<UseMutationOptions<Entry, ApiRequestError, { entryId: string; reason?: string }>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entryId, reason }) => {
      const body: Record<string, string | undefined> = {};
      if (reason) body.reason = reason;
      return apiFetch<Entry>(`/entries/${entryId}/approve`, {
        method: 'POST',
        body: Object.keys(body).length > 0 ? body : undefined,
      });
    },
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      options?.onSuccess?.(...args);
    },
  });
}

/**
 * Reject an entry (Committee action).
 */
export function useRejectEntry(
  options?: Omit<UseMutationOptions<Entry, ApiRequestError, { entryId: string; reason: string }>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entryId, reason }) =>
      apiFetch<Entry>(`/entries/${entryId}/reject`, {
        method: 'POST',
        body: { reason },
      }),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      options?.onSuccess?.(...args);
    },
  });
}

/**
 * Update an entry (draft or rejected only).
 */
export function useUpdateEntry(
  options?: Omit<UseMutationOptions<Entry, ApiRequestError, { entryId: string; body: EntryInput }>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entryId, body }) =>
      apiFetch<Entry>(`/entries/${entryId}`, {
        method: 'PATCH',
        body,
      }),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      options?.onSuccess?.(...args);
    },
  });
}
