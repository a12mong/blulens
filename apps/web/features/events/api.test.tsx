import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useTournaments,
  useCreateTournament,
  useEvents,
  useCreateEvent,
  useEventEntries,
  useCreateEntry,
  tournamentsKey,
  eventsKey,
  entriesKey,
} from './api';
import { apiFetch } from '@/lib/api/client';

vi.mock('@/lib/api/client');

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('Events API hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useCreateTournament posts the body and invalidates the tournaments list', async () => {
    const queryClient = createQueryClient();
    const mockTournament = { id: 'T1', status: 'draft' } as unknown;

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.mocked(apiFetch).mockResolvedValueOnce(mockTournament);

    const { result } = renderHook(() => useCreateTournament(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({
      name: 'Cup',
      startsOn: '2026-11-01',
      entriesCloseAt: '2026-10-25T00:00:00Z',
    } as any);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/tournaments', {
      method: 'POST',
      body: {
        name: 'Cup',
        startsOn: '2026-11-01',
        entriesCloseAt: '2026-10-25T00:00:00Z',
      },
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tournamentsKey });
  });

  it('useCreateEntry invalidates entriesKey and passes through the Entry with warnings', async () => {
    const queryClient = createQueryClient();
    const mockEntry = { id: 'E1', warnings: ['MULTI_TEAM'] } as unknown;

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.mocked(apiFetch).mockResolvedValueOnce(mockEntry);

    const onSuccessMock = vi.fn();

    const { result } = renderHook(() => useCreateEntry('EV1', { onSuccess: onSuccessMock }), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ playerIds: ['P1'] });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockEntry);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: entriesKey('EV1') });

    // Check onSuccess was called with correct arguments
    const calls = onSuccessMock.mock.calls;
    expect(calls.length).toBe(1);
    expect(calls[0]![0]).toEqual(mockEntry);
    expect(calls[0]![1]).toEqual({ playerIds: ['P1'] });
  });

  it('useEventEntries calls /events/E1/entries and refetches every 30s', async () => {
    const queryClient = createQueryClient();
    const mockEntries = [{ id: 'EN1' }, { id: 'EN2' }] as unknown;

    vi.mocked(apiFetch).mockResolvedValueOnce(mockEntries);

    const { result } = renderHook(() => useEventEntries('E1'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/events/E1/entries');
    expect(result.current.data).toEqual(mockEntries);
  });

  it('useTournaments fetches and returns the tournament page', async () => {
    const queryClient = createQueryClient();
    const mockPage = {
      items: [{ id: 'T1', status: 'draft' }],
      nextCursor: null,
    } as unknown;

    vi.mocked(apiFetch).mockResolvedValueOnce(mockPage);

    const { result } = renderHook(() => useTournaments(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/tournaments');
    expect(result.current.data).toEqual(mockPage);
  });

  it('useEvents fetches events for a tournament', async () => {
    const queryClient = createQueryClient();
    const mockEvents = [
      { id: 'EV1', tournamentId: 'T1' },
      { id: 'EV2', tournamentId: 'T1' },
    ] as unknown;

    vi.mocked(apiFetch).mockResolvedValueOnce(mockEvents);

    const { result } = renderHook(() => useEvents('T1'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/tournaments/T1/events');
    expect(result.current.data).toEqual(mockEvents);
  });

  it('useCreateEvent invalidates eventsKey for the tournament', async () => {
    const queryClient = createQueryClient();
    const mockEvent = { id: 'EV1', tournamentId: 'T1' } as unknown;

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.mocked(apiFetch).mockResolvedValueOnce(mockEvent);

    const { result } = renderHook(() => useCreateEvent('T1'), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ discipline: 'MS' } as any);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/tournaments/T1/events', {
      method: 'POST',
      body: { discipline: 'MS' },
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: eventsKey('T1') });
  });

  it('caller onSuccess is called after invalidation', async () => {
    const queryClient = createQueryClient();
    const mockTournament = { id: 'T1', status: 'draft' } as unknown;

    const onSuccessMock = vi.fn();

    vi.mocked(apiFetch).mockResolvedValueOnce(mockTournament);

    const { result } = renderHook(() => useCreateTournament({ onSuccess: onSuccessMock }), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({
      name: 'Cup',
      startsOn: '2026-11-01',
      entriesCloseAt: '2026-10-25T00:00:00Z',
    } as any);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Check onSuccess was called
    const calls = onSuccessMock.mock.calls;
    expect(calls.length).toBe(1);
    expect(calls[0]![0]).toEqual(mockTournament);
  });
});
