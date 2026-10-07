'use client';

import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryOptions,
} from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { TournamentPage } from './api';

export const tournamentsInfiniteKey = ['tournaments', 'infinite'] as const;

export function useTournamentsInfinite(
  options?: Omit<
    UseInfiniteQueryOptions<
      TournamentPage,
      Error,
      InfiniteData<TournamentPage>,
      typeof tournamentsInfiniteKey,
      string | undefined
    >,
    'queryKey' | 'queryFn' | 'getNextPageParam' | 'initialPageParam'
  >,
) {
  return useInfiniteQuery({
    queryKey: tournamentsInfiniteKey,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const query: Record<string, string | number | undefined> = { limit: 20 };
      if (pageParam) {
        query.cursor = pageParam;
      }
      return apiFetch<TournamentPage>('/tournaments', {
        query: query as any,
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    ...options,
  });
}
