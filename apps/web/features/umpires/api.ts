import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

type EventUmpire = components['schemas']['EventUmpire'];
type Match = components['schemas']['Match'];

const umpireKey = (eventId: string) => ['events', eventId, 'umpires'];
const matchesKey = (eventId: string) => ['events', eventId, 'matches'];

export function useEventUmpires(eventId: string) {
  return useQuery<EventUmpire[]>({
    queryKey: umpireKey(eventId),
    queryFn: async () => {
      // Mock implementation - backend route not yet implemented
      // GET /events/{eventId}/umpires returns EventUmpire[]
      return [
        {
          userId: 'umpire-1',
          displayName: 'สมศักดิ์ เมืองเชียง',
          courts: ['A', 'B'],
        },
        {
          userId: 'umpire-2',
          displayName: 'จำเนียร เลียมลิสา',
          courts: [],
        },
      ];
    },
  });
}

export function useSaveEventUmpires(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (umpires: EventUmpire[]) => {
      // PUT /events/{eventId}/umpires replaces the full list
      return apiFetch(`/events/${eventId}/umpires`, {
        method: 'PUT',
        body: JSON.stringify(umpires),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: umpireKey(eventId) });
    },
  });
}

export function useEventMatches(eventId: string) {
  return useQuery<Match[]>({
    queryKey: matchesKey(eventId),
    queryFn: async () => {
      // GET /events/{eventId}/matches returns Match[] with court and umpireId
      return [];
    },
  });
}

export function useAssignMatch(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { matchId: string; court?: string | null; umpireId?: string | null }) => {
      // PATCH /matches/{matchId}/assignment
      return apiFetch(`/matches/${payload.matchId}/assignment`, {
        method: 'PATCH',
        body: JSON.stringify({ court: payload.court, umpireId: payload.umpireId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: matchesKey(eventId) });
      queryClient.invalidateQueries({ queryKey: umpireKey(eventId) });
    },
  });
}
