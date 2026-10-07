import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSubmitReview } from './api';
import * as apiClient from '@/lib/api/client';

vi.mock('@/lib/api/client');

describe('useSubmitReview', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('calls PUT with scores and comment, then invalidates both query keys', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const mockApiFetch = vi.mocked(apiClient.apiFetch);
    mockApiFetch.mockResolvedValueOnce({
      id: 'test-id',
      state: 'submitted',
      assessmentId: 'hidden',
      dueAt: '2026-10-07T20:00:00Z',
      submittedAt: '2026-10-07T19:00:00Z',
    });

    const { result } = renderHook(() => useSubmitReview('test-id'), { wrapper });

    result.current.mutate({
      scores: [
        { criterion: 'footwork', gradeKey: 'S' },
        { criterion: 'smash', gradeKey: null },
      ],
      comment: 'Test comment',
    });

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/reviews/assignments/test-id', {
        method: 'PUT',
        body: {
          scores: [
            { criterion: 'footwork', gradeKey: 'S' },
            { criterion: 'smash', gradeKey: null },
          ],
          comment: 'Test comment',
        },
      });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['review', 'assignment', 'test-id'],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['review', 'assignments'],
      });
    });
  });
});
