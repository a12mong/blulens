import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useEntries,
  useCommitteeQueue,
  useCreateEntry,
  useForwardEntry,
  useApproveEntry,
  useRejectEntry,
  useUpdateEntry,
  entriesKey,
  queueKey,
} from './api';
import { apiFetch } from '@/lib/api/client';

vi.mock('@/lib/api/client');

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('Entry Workflow Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useForwardEntry posts to /entries/{id}/forward and invalidates the entries lists', async () => {
    const queryClient = createQueryClient();
    const mockEntry = { id: 'E1', status: 'pending_committee' } as unknown;

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(apiFetch).mockResolvedValueOnce(mockEntry);

    const { result } = renderHook(() => useForwardEntry(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ entryId: 'E1' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/entries/E1/forward', {
      method: 'POST',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['entries'] });
  });

  it('useCommitteeQueue calls /entries with query {status:pending_committee, eventId}', async () => {
    const queryClient = createQueryClient();
    const mockEntries = [{ id: 'E1', status: 'pending_committee' }] as unknown;

    vi.mocked(apiFetch).mockResolvedValueOnce(mockEntries);

    const { result } = renderHook(() => useCommitteeQueue('EV1'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/entries', {
      query: { status: 'pending_committee', eventId: 'EV1' },
    });
  });

  it('useRejectEntry sends {reason} in body', async () => {
    const queryClient = createQueryClient();
    const mockEntry = { id: 'E1', status: 'rejected' } as unknown;

    vi.mocked(apiFetch).mockResolvedValueOnce(mockEntry);

    const { result } = renderHook(() => useRejectEntry(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ entryId: 'E1', reason: 'Out of band' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/entries/E1/reject', {
      method: 'POST',
      body: { reason: 'Out of band' },
    });
  });

  it('useApproveEntry omits body.reason when not given', async () => {
    const queryClient = createQueryClient();
    const mockEntry = { id: 'E1', status: 'approved' } as unknown;

    vi.mocked(apiFetch).mockResolvedValueOnce(mockEntry);

    const { result } = renderHook(() => useApproveEntry(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ entryId: 'E1' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/entries/E1/approve', {
      method: 'POST',
      body: undefined,
    });
  });

  it('useApproveEntry includes reason when given', async () => {
    const queryClient = createQueryClient();
    const mockEntry = { id: 'E1', status: 'approved' } as unknown;

    vi.mocked(apiFetch).mockResolvedValueOnce(mockEntry);

    const { result } = renderHook(() => useApproveEntry(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ entryId: 'E1', reason: 'Acceptable' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/entries/E1/approve', {
      method: 'POST',
      body: { reason: 'Acceptable' },
    });
  });

  it('caller onSuccess is called after invalidation', async () => {
    const queryClient = createQueryClient();
    const mockEntry = { id: 'E1', status: 'pending_committee' } as unknown;
    const onSuccessMock = vi.fn();

    vi.mocked(apiFetch).mockResolvedValueOnce(mockEntry);

    const { result } = renderHook(() => useForwardEntry({ onSuccess: onSuccessMock }), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ entryId: 'E1' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(onSuccessMock).toHaveBeenCalled();
  });

  it('useEntries calls /events/{id}/entries with optional status', async () => {
    const queryClient = createQueryClient();
    const mockEntries = [{ id: 'E1' }] as unknown;

    vi.mocked(apiFetch).mockResolvedValueOnce(mockEntries);

    const { result } = renderHook(() => useEntries('EV1', 'draft'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/events/EV1/entries', {
      query: { status: 'draft' },
    });
  });

  it('useCreateEntry posts to /events/{id}/entries', async () => {
    const queryClient = createQueryClient();
    const mockEntry = { id: 'E1', status: 'draft' } as unknown;

    vi.mocked(apiFetch).mockResolvedValueOnce(mockEntry);

    const { result } = renderHook(() => useCreateEntry('EV1'), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ players: [{ userId: 'P1' }, { userId: 'P2' }] } as any);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/events/EV1/entries', {
      method: 'POST',
      body: { players: [{ userId: 'P1' }, { userId: 'P2' }] },
    });
  });

  it('useUpdateEntry patches /entries/{id}', async () => {
    const queryClient = createQueryClient();
    const mockEntry = { id: 'E1', status: 'draft' } as unknown;

    vi.mocked(apiFetch).mockResolvedValueOnce(mockEntry);

    const { result } = renderHook(() => useUpdateEntry(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({
      entryId: 'E1',
      body: { players: [{ userId: 'P1' }, { userId: 'P3' }] } as any,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/entries/E1', {
      method: 'PATCH',
      body: { players: [{ userId: 'P1' }, { userId: 'P3' }] },
    });
  });
});
