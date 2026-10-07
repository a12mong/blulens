// Stub file for bl-21-1 (Ryan) - will be replaced when bl-21-1 merges
// These hooks are implemented in bl-21-1

import { useMutation } from '@tanstack/react-query';
import type { components } from '@/lib/api/schema';

type Tournament = components['schemas']['Tournament'];
type Event = components['schemas']['Event'];

/**
 * Stub: Create tournament mutation
 * Actual implementation in bl-21-1
 */
export function useCreateTournament(options?: any) {
  return useMutation({
    mutationFn: async (data: any) => {
      throw new Error('useCreateTournament not implemented - bl-21-1 in progress');
    },
    ...options,
  });
}

/**
 * Stub: Create event mutation
 * Actual implementation in bl-21-1
 */
export function useCreateEvent(tournamentId: string, options?: any) {
  return useMutation({
    mutationFn: async (data: any) => {
      throw new Error('useCreateEvent not implemented - bl-21-1 in progress');
    },
    ...options,
  });
}

/**
 * Stub: Get event entries query
 * Actual implementation in bl-21-1
 */
export function useEventEntries(eventId: string, options?: any) {
  return {
    data: null,
    isLoading: false,
    error: null,
    ...options,
  };
}
