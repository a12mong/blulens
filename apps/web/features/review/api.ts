import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

type ReviewAssignment = components['schemas']['ReviewAssignment'];
type ReviewAssignmentDetail = components['schemas']['ReviewAssignmentDetail'];
type ReviewInput = components['schemas']['ReviewInput'];

export function useMyAssignments(state?: 'open' | 'submitted' | 'expired') {
  return useQuery<ReviewAssignment[]>({
    queryKey: ['review', 'assignments', state ?? 'all'],
    queryFn: async () => {
      const query = state ? { state } : {};
      return apiFetch('/reviews/assignments/me', { query });
    },
  });
}

export function useAssignment(id: string) {
  return useQuery<ReviewAssignmentDetail>({
    queryKey: ['review', 'assignment', id],
    queryFn: async () => {
      return apiFetch(`/reviews/assignments/${id}`);
    },
    staleTime: 60_000,
  });
}

export function useSubmitReview(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReviewInput) => {
      return apiFetch<ReviewAssignment>(`/reviews/assignments/${id}`, {
        method: 'PUT',
        body: input,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review', 'assignment', id] });
      queryClient.invalidateQueries({ queryKey: ['review', 'assignments'] });
    },
  });
}
