import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSaveEventUmpires } from './api';
import { apiFetch } from '@/lib/api/client';

vi.mock('@/lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/client')>();
  return { ...actual, apiFetch: vi.fn() };
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useSaveEventUmpires', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockResolvedValue([]);
  });

  it('PUTs only { userId, courts } per umpire as a plain object body', async () => {
    const { result } = renderHook(() => useSaveEventUmpires('evt-1'), { wrapper });
    result.current.mutate([{ userId: 'u1', displayName: 'สมศักดิ์' }, { userId: 'u2', courts: ['1'] }]);
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(apiFetch).toHaveBeenCalledWith('/events/evt-1/umpires', {
      method: 'PUT',
      body: [
        { userId: 'u1', courts: [] },
        { userId: 'u2', courts: ['1'] },
      ],
    });
  });
});
