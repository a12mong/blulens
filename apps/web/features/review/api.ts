import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

type ReviewAssignment = components['schemas']['ReviewAssignment'];

export function useMyAssignments(state?: 'open' | 'submitted' | 'expired') {
  return useQuery<ReviewAssignment[]>({
    queryKey: ['review', 'assignments', state ?? 'all'],
    queryFn: async () => {
      const query = state ? { state } : {};
      return apiFetch('/reviews/assignments/me', { query });
    },
  });
}
