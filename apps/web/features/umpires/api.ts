import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

type EventUmpire = components['schemas']['EventUmpire'];
type Match = components['schemas']['Match'];
type UserPickerItem = components['schemas']['UserPickerItem'];

const umpireKey = (eventId: string) => ['events', eventId, 'umpires'];
const matchesKey = (eventId: string) => ['events', eventId, 'matches'];
const umpireUsersKey = () => ['users', 'umpire'];

export function useEventUmpires(eventId: string) {
  return useQuery<EventUmpire[]>({
    queryKey: umpireKey(eventId),
    queryFn: async () => {
      return apiFetch<EventUmpire[]>(`/events/${eventId}/umpires`);
    },
  });
}

export function useSaveEventUmpires(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (umpires: EventUmpire[]) => {
      return apiFetch<EventUmpire[]>(`/events/${eventId}/umpires`, {
        method: 'PUT',
        body: umpires.map((u) => ({ userId: u.userId, courts: u.courts ?? [] })),
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
      return apiFetch<Match[]>(`/events/${eventId}/matches`);
    },
  });
}

export function useUmpireUsers() {
  return useQuery<UserPickerItem[]>({
    queryKey: umpireUsersKey(),
    queryFn: async () => {
      const result = await apiFetch<{ items: UserPickerItem[] }>('/users', { query: { role: 'Umpire' } });
      return result.items;
    },
  });
}

export function useAssignMatch(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { matchId: string; court?: string | null; umpireId?: string | null }) => {
      return apiFetch<Match>(`/matches/${payload.matchId}/assignment`, {
        method: 'PATCH',
        body: { court: payload.court, umpireId: payload.umpireId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: matchesKey(eventId) });
      queryClient.invalidateQueries({ queryKey: umpireKey(eventId) });
    },
  });
}
