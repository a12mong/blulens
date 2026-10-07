import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Bracket = components['schemas']['Bracket'];
export type GroupStanding = components['schemas']['GroupStanding'];

export const BRACKET_REFETCH_INTERVAL = 30_000;

export function useBracket(eventId: string) {
  return useQuery<Bracket>({
    queryKey: ['events', eventId, 'bracket'],
    queryFn: async () => apiFetch(`/events/${eventId}/bracket`),
    enabled: Boolean(eventId),
    refetchInterval: BRACKET_REFETCH_INTERVAL,
    retry: false,
  });
}

export function useStandings(eventId: string) {
  return useQuery<GroupStanding[]>({
    queryKey: ['events', eventId, 'standings'],
    queryFn: async () => apiFetch(`/events/${eventId}/standings`),
    enabled: Boolean(eventId),
    refetchInterval: BRACKET_REFETCH_INTERVAL,
    retry: false,
  });
}
