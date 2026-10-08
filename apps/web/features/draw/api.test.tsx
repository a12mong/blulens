import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePreviewGroups } from './api';
import { apiFetch } from '@/lib/api/client';

vi.mock('@/lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/client')>();
  return { ...actual, apiFetch: vi.fn() };
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('usePreviewGroups', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockResolvedValue({ id: 'd1' });
  });

  it('sends the re-roll reason in the preview body', async () => {
    const { result } = renderHook(() => usePreviewGroups('evt-1'), { wrapper });
    result.current.mutate({ reason: 'ทีมชนกันมาก' });
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(apiFetch).toHaveBeenCalledWith('/events/evt-1/groups/preview', {
      method: 'POST',
      body: { reason: 'ทีมชนกันมาก' },
    });
  });

  it('sends an empty body for the first preview', async () => {
    const { result } = renderHook(() => usePreviewGroups('evt-1'), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(apiFetch).toHaveBeenCalledWith('/events/evt-1/groups/preview', {
      method: 'POST',
      body: {},
    });
  });
});
