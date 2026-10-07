import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiRequestError, apiFetch } from '@/lib/api/client';
import { useLogin, useLogout, useMe, meKey, type Me } from './api';

vi.mock('@/lib/api/client');

const mockMe: Me = {
  id: 'user-123',
  displayName: 'Test User',
  roles: ['Member'],
  teamIds: [],
  email: 'test@example.com',
  permissions: ['assessments:read'],
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('auth hooks', () => {
  it('login stores the user under ["auth","me"] query key', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.mocked(apiFetch).mockResolvedValueOnce(mockMe);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useLogin(), { wrapper });

    result.current.mutate({ identifier: 'a', password: 'b' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const storedData = queryClient.getQueryData(meKey);
    expect(storedData).toEqual(mockMe);
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: { identifier: 'a', password: 'b' },
    });
  });

  it('useMe with apiFetch rejecting 401 returns null and does not throw error', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    // Create an error that matches ApiRequestError structure
    const error = Object.create(ApiRequestError.prototype);
    error.name = 'ApiRequestError';
    error.status = 401;
    error.code = 'UNAUTHORIZED';
    error.message = 'Not authenticated';
    error.details = undefined;

    vi.mocked(apiFetch).mockRejectedValueOnce(error);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useMe(), { wrapper });

    // Wait for the query to settle (either success or error)
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should be successful with null data
    expect(result.current.status).toBe('success');
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('useMe fetches from /auth/me endpoint', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockMe);

    const { result } = renderHook(() => useMe(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockMe);
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/auth/me');
  });

  it('useLogout clears all query data on success', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Pre-populate with some data
    queryClient.setQueryData(meKey, mockMe);
    expect(queryClient.getQueryData(meKey)).toEqual(mockMe);

    vi.mocked(apiFetch).mockResolvedValueOnce(undefined);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useLogout(), { wrapper });

    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/auth/logout', {
      method: 'POST',
    });
    expect(queryClient.getQueryData(meKey)).toBeUndefined();
  });

  it('useLogin on error propagates the ApiRequestError', async () => {
    const error = new ApiRequestError(400, 'INVALID_CREDENTIALS', 'Invalid username or password');
    vi.mocked(apiFetch).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

    result.current.mutate({ identifier: 'bad', password: 'wrong' });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error);
  });

  it('useLogin with caller onSuccess: cache is set AND caller callback is called', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const callerOnSuccess = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce(mockMe);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useLogin({ onSuccess: callerOnSuccess }), { wrapper });

    result.current.mutate({ identifier: 'test', password: 'pass' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify cache was set by the hook
    const cachedData = queryClient.getQueryData(meKey);
    expect(cachedData).toEqual(mockMe);

    // Verify caller's onSuccess was also called
    expect(callerOnSuccess).toHaveBeenCalledOnce();
    expect(callerOnSuccess.mock.calls[0].slice(0, 2)).toEqual([mockMe, { identifier: 'test', password: 'pass' }]);
  });
});
