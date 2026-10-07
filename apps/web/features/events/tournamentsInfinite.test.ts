import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api/client';
import {
  tournamentsInfiniteKey,
  useTournamentsInfinite,
} from './tournamentsInfinite';

vi.mock('@/lib/api/client', () => ({
  apiFetch: vi.fn(),
  ApiRequestError: class extends Error {},
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useTournamentsInfinite', () => {
  it('has queryKey ["tournaments", "infinite"]', () => {
    expect(tournamentsInfiniteKey).toEqual(['tournaments', 'infinite']);
  });

  it('fetches page 1 with limit 20 and page 2 with cursor', async () => {
    const page1 = {
      items: [{ id: 't1', name: 'Tournament 1' }],
      nextCursor: 'cursor-1',
    };
    const page2 = {
      items: [{ id: 't2', name: 'Tournament 2' }],
      nextCursor: null,
    };

    vi.mocked(apiFetch)
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2);

    const { result } = renderHook(() => useTournamentsInfinite(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiFetch).toHaveBeenNthCalledWith(1, '/tournaments', {
      query: { limit: 20 },
    });
    expect(result.current.hasNextPage).toBe(true);

    // Fetch next page
    await result.current.fetchNextPage();

    await waitFor(() => {
      expect(result.current.data?.pages).toHaveLength(2);
    });

    expect(apiFetch).toHaveBeenNthCalledWith(2, '/tournaments', {
      query: { limit: 20, cursor: 'cursor-1' },
    });
    expect(result.current.hasNextPage).toBe(false);
  });
});
