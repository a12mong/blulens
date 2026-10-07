import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiFetch, ApiRequestError, setSessionExpiredHandler } from './client';

describe('apiFetch', () => {
  let fetchCalls: Array<{ url: string; init: RequestInit }> = [];
  let fetchResponseFactories: Array<() => Response> = [];

  beforeEach(() => {
    fetchCalls = [];
    fetchResponseFactories = [];

    // Stub global fetch
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        fetchCalls.push({ url, init: init || {} });

        if (fetchResponseFactories.length > 0) {
          const factory = fetchResponseFactories.shift()!;
          return factory();
        }

        throw new Error('No mock response configured');
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    // Reset session handler between tests
    setSessionExpiredHandler(() => {});
  });

  it('refreshes once and retries on 401', async () => {
    // Mock responses: 401 error, 204 refresh, success
    fetchResponseFactories = [
      () =>
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Unauthorized',
            },
          }),
          { status: 401, headers: { 'content-type': 'application/json' } }
        ),
      () => new Response(null, { status: 204 }),
      () =>
        new Response(
          JSON.stringify({
            success: true,
            data: { ok: 1 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        ),
    ];

    const result = await apiFetch('/test', { method: 'GET' });

    expect(result).toEqual({ ok: 1 });
    expect(fetchCalls).toHaveLength(3);
    expect(fetchCalls[0]?.url).toBe('/api/v1/test');
    expect(fetchCalls[1]?.url).toBe('/api/v1/auth/refresh');
    expect(fetchCalls[1]?.init.method).toBe('POST');
    expect(fetchCalls[2]?.url).toBe('/api/v1/test');
  });

  it('parses error envelope to ApiRequestError', async () => {
    fetchResponseFactories = [
      () =>
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: { fieldErrors: { name: 'Required' } },
            },
          }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        ),
    ];

    try {
      await apiFetch('/test');
      expect.fail('Should have thrown ApiRequestError');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiRequestError);
      const apiError = error as ApiRequestError;
      expect(apiError.status).toBe(400);
      expect(apiError.code).toBe('VALIDATION_ERROR');
      expect(apiError.message).toBe('Invalid input');
      expect(apiError.details).toEqual({ fieldErrors: { name: 'Required' } });
    }
  });

  it('returns undefined for 204 No Content', async () => {
    fetchResponseFactories = [() => new Response(null, { status: 204 })];

    const result = await apiFetch('/test');

    expect(result).toBeUndefined();
  });

  it('calls session expired handler when refresh fails', async () => {
    const handler = vi.fn();
    setSessionExpiredHandler(handler);

    fetchResponseFactories = [
      () =>
        new Response(
          JSON.stringify({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
          }),
          { status: 401, headers: { 'content-type': 'application/json' } }
        ),
      () => new Response(null, { status: 401 }),
    ];

    try {
      await apiFetch('/test');
      expect.fail('Should have thrown ApiRequestError');
    } catch (error) {
      expect(handler).toHaveBeenCalledTimes(1);
      const apiError = error as ApiRequestError;
      expect(apiError.code).toBe('UNAUTHORIZED');
    }
  });

  it('does not refresh on 401 for auth endpoints', async () => {
    fetchResponseFactories = [
      () =>
        new Response(
          JSON.stringify({
            success: false,
            error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
          }),
          { status: 401, headers: { 'content-type': 'application/json' } }
        ),
    ];

    await expect(apiFetch('/auth/login', { method: 'POST' })).rejects.toThrow(ApiRequestError);

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]?.url).toBe('/api/v1/auth/login');
  });

  it('shares refresh promise for concurrent 401s', async () => {
    // Setup responses for two concurrent requests
    fetchResponseFactories = [
      () =>
        new Response(
          JSON.stringify({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
          }),
          { status: 401, headers: { 'content-type': 'application/json' } }
        ),
      () =>
        new Response(
          JSON.stringify({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
          }),
          { status: 401, headers: { 'content-type': 'application/json' } }
        ),
      () => new Response(null, { status: 204 }),
      () =>
        new Response(
          JSON.stringify({
            success: true,
            data: { ok: 1 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        ),
      () =>
        new Response(
          JSON.stringify({
            success: true,
            data: { ok: 1 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        ),
    ];

    const promises = [apiFetch('/test1'), apiFetch('/test2')];
    const results = await Promise.all(promises);

    expect(results).toEqual([{ ok: 1 }, { ok: 1 }]);

    // Should have called refresh only once even with 2 concurrent 401s
    const refreshCalls = fetchCalls.filter((call) => call.url.includes('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
  });

  it('builds URL with query parameters', async () => {
    fetchResponseFactories = [
      () =>
        new Response(
          JSON.stringify({
            success: true,
            data: { items: [] },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        ),
    ];

    await apiFetch('/events', { query: { status: 'active', limit: 10, skip: undefined } });

    expect(fetchCalls[0]?.url).toMatch(/^\/api\/v1\/events\?/);
    expect(fetchCalls[0]?.url).toContain('status=active');
    expect(fetchCalls[0]?.url).toContain('limit=10');
    expect(fetchCalls[0]?.url).not.toContain('skip');
  });

  it('sends JSON body with correct headers', async () => {
    fetchResponseFactories = [
      () =>
        new Response(
          JSON.stringify({
            success: true,
            data: { id: '123' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        ),
    ];

    const body = { name: 'Test Event' };
    await apiFetch('/events', { method: 'POST', body });

    expect(fetchCalls[0]?.init.headers).toEqual({
      'Content-Type': 'application/json',
    });
    expect(fetchCalls[0]?.init.body).toBe(JSON.stringify(body));
  });

  it('uses credentials: same-origin', async () => {
    fetchResponseFactories = [
      () =>
        new Response(
          JSON.stringify({
            success: true,
            data: null,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        ),
    ];

    await apiFetch('/test');

    expect(fetchCalls[0]?.init.credentials).toBe('same-origin');
  });

  it('throws NETWORK_ERROR for non-JSON response', async () => {
    fetchResponseFactories = [
      () =>
        new Response('Not JSON', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        }),
    ];

    try {
      await apiFetch('/test');
      expect.fail('Should have thrown ApiRequestError');
    } catch (error) {
      const apiError = error as ApiRequestError;
      expect(apiError.code).toBe('NETWORK_ERROR');
      expect(apiError.status).toBe(0);
    }
  });

  it('throws NETWORK_ERROR for fetch failures', async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Network failure');
      })
    );

    await expect(apiFetch('/test')).rejects.toThrow(ApiRequestError);

    try {
      await apiFetch('/test');
    } catch (error) {
      const apiError = error as ApiRequestError;
      expect(apiError.code).toBe('NETWORK_ERROR');
    }
  });

  it('respects abort signal', async () => {
    fetchResponseFactories = [
      () =>
        new Response(
          JSON.stringify({
            success: true,
            data: { ok: 1 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        ),
    ];

    const controller = new AbortController();

    await apiFetch('/test', { signal: controller.signal });

    expect(fetchCalls[0]?.init.signal).toBe(controller.signal);
  });
});
