import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import { Providers, makeQueryClient } from './providers';
import { ApiRequestError } from '@/lib/api/client';

describe('Providers', () => {
  it('provides a QueryClient with 30s staleTime and no retry on 403', () => {
    let queryClientFromHook: ReturnType<typeof useQueryClient> | null = null;

    function TestChild() {
      queryClientFromHook = useQueryClient();
      return <div>test</div>;
    }

    render(
      <Providers>
        <TestChild />
      </Providers>
    );

    expect(queryClientFromHook).not.toBeNull();
    const defaultOptions = queryClientFromHook!.getDefaultOptions();
    expect(defaultOptions.queries?.staleTime).toBe(30_000);

    const retryFn = defaultOptions.queries?.retry as (count: number, error: Error) => boolean;
    expect(retryFn).toBeDefined();

    // Should not retry on 403 ApiRequestError
    const error403 = new ApiRequestError(403, 'FORBIDDEN', 'Forbidden');
    expect(retryFn(0, error403)).toBe(false);

    // Should retry on generic error at attempt 0
    const genericError = new Error('Network error');
    expect(retryFn(0, genericError)).toBe(true);

    // Should not retry on attempt 1+
    expect(retryFn(1, genericError)).toBe(false);

    // Should not retry on 401 ApiRequestError
    const error401 = new ApiRequestError(401, 'UNAUTHORIZED', 'Unauthorized');
    expect(retryFn(0, error401)).toBe(false);

    // Should not retry on 404 ApiRequestError
    const error404 = new ApiRequestError(404, 'NOT_FOUND', 'Not Found');
    expect(retryFn(0, error404)).toBe(false);
  });

  it('creates a new QueryClient on each Providers instance', () => {
    let client1: ReturnType<typeof useQueryClient> | null = null;
    let client2: ReturnType<typeof useQueryClient> | null = null;

    function TestChild({ setClient }: { setClient: (c: ReturnType<typeof useQueryClient>) => void }) {
      const client = useQueryClient();
      setClient(client);
      return <div>test</div>;
    }

    const { unmount: unmount1 } = render(
      <Providers>
        <TestChild setClient={(c) => (client1 = c)} />
      </Providers>
    );

    const { unmount: unmount2 } = render(
      <Providers>
        <TestChild setClient={(c) => (client2 = c)} />
      </Providers>
    );

    expect(client1).not.toBe(client2);

    unmount1();
    unmount2();
  });

  it('makeQueryClient creates QueryClient with correct defaults', () => {
    const client = makeQueryClient();
    const defaultOptions = client.getDefaultOptions();

    expect(defaultOptions.queries?.staleTime).toBe(30_000);
    expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(true);
  });
});
