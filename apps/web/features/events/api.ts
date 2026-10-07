import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Tournament = components['schemas']['Tournament'];
export type TournamentInput = components['schemas']['TournamentInput'];
export type TournamentPage = components['schemas']['TournamentPage'];
export type Event = components['schemas']['Event'];
export type EventInput = components['schemas']['EventInput'];
export type Entry = components['schemas']['Entry'];

export const tournamentsKey = ['tournaments'] as const;
export const tournamentKey = (tournamentId: string) => ['tournaments', tournamentId] as const;
export const eventsKey = (tournamentId: string) => ['tournaments', tournamentId, 'events'] as const;
export const eventKey = (eventId: string) => ['events', eventId] as const;
export const entriesKey = (eventId: string) => ['events', eventId, 'entries'] as const;

/**
 * Fetch all tournaments.
 */
export function useTournaments(
  options?: Omit<UseQueryOptions<TournamentPage>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: tournamentsKey,
    queryFn: async () => apiFetch<TournamentPage>('/tournaments'),
    ...options,
  });
}

/**
 * Create a new tournament.
 * Invalidates the tournaments list on success.
 */
export function useCreateTournament(
  options?: Omit<UseMutationOptions<Tournament, ApiRequestError, TournamentInput>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body) =>
      apiFetch<Tournament>('/tournaments', {
        method: 'POST',
        body,
      }),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: tournamentsKey });
      options?.onSuccess?.(...args);
    },
  });
}

/**
 * Fetch events for a tournament.
 */
export function useEvents(
  tournamentId: string,
  options?: Omit<UseQueryOptions<Event[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: eventsKey(tournamentId),
    queryFn: async () =>
      apiFetch<Event[]>(`/tournaments/${tournamentId}/events`),
    ...options,
  });
}

/**
 * Create a new event in a tournament.
 * Invalidates the events list for that tournament on success.
 */
export function useCreateEvent(
  tournamentId: string,
  options?: Omit<UseMutationOptions<Event, ApiRequestError, EventInput>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body) =>
      apiFetch<Event>(`/tournaments/${tournamentId}/events`, {
        method: 'POST',
        body,
      }),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: eventsKey(tournamentId) });
      options?.onSuccess?.(...args);
    },
  });
}

/**
 * Fetch entries for an event.
 * Refetches every 30 seconds.
 */
export function useEventEntries(
  eventId: string,
  options?: Omit<UseQueryOptions<Entry[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: entriesKey(eventId),
    queryFn: async () =>
      apiFetch<Entry[]>(`/events/${eventId}/entries`),
    refetchInterval: 30_000,
    ...options,
  });
}

/**
 * Create a new entry in an event.
 * Invalidates the entries list for that event on success.
 */
export function useCreateEntry(
  eventId: string,
  options?: Omit<UseMutationOptions<Entry, ApiRequestError, { playerIds: string[] }>, 'mutationFn'>
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
      queryClient.invalidateQueries({ queryKey: entriesKey(eventId) });
      options?.onSuccess?.(...args);
    },
  });
}

/**
 * Fetch a single tournament with its events.
 */
export function useTournament(
  tournamentId: string,
  options?: Omit<UseQueryOptions<Tournament>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: tournamentKey(tournamentId),
    queryFn: async () =>
      apiFetch<Tournament>(`/tournaments/${tournamentId}`),
    ...options,
  });
}

/**
 * Set the status of a tournament.
 * Invalidates tournaments list and tournament detail on success.
 */
export function useSetTournamentStatus(
  tournamentId: string,
  options?: Omit<UseMutationOptions<Tournament, ApiRequestError, { to: string }>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body) =>
      apiFetch<Tournament>(`/tournaments/${tournamentId}/status`, {
        method: 'POST',
        body,
      }),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: tournamentsKey });
      queryClient.invalidateQueries({ queryKey: tournamentKey(tournamentId) });
      options?.onSuccess?.(...args);
    },
  });
}

/**
 * Fetch a single event with tournament context.
 */
export function useEvent(
  eventId: string,
  options?: Omit<UseQueryOptions<Event>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: eventKey(eventId),
    queryFn: async () =>
      apiFetch<Event>(`/events/${eventId}`),
    ...options,
  });
}
