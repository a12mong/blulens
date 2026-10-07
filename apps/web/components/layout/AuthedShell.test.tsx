import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthedShell } from './AuthedShell';
import * as authApi from '@/features/auth/api';

const replace = vi.fn();
const mutate = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/events',
}));
vi.mock('@/features/auth/api', () => ({ useMe: vi.fn(), useLogout: vi.fn() }));

describe('AuthedShell', () => {
  beforeEach(() => {
    replace.mockReset();
    mutate.mockReset();
    vi.mocked(authApi.useLogout).mockReturnValue({ mutate } as unknown as ReturnType<typeof authApi.useLogout>);
  });

  it('clears a stale session once: /auth/me resolved to null triggers logout', () => {
    vi.mocked(authApi.useMe).mockReturnValue({ data: null, isSuccess: true } as unknown as ReturnType<typeof authApi.useMe>);
    const { rerender } = render(<AuthedShell>x</AuthedShell>);
    rerender(<AuthedShell>x</AuthedShell>);
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a logged-in user or while loading', () => {
    vi.mocked(authApi.useMe).mockReturnValue({
      data: { displayName: 'A', roles: ['Admin'] },
      isSuccess: true,
    } as unknown as ReturnType<typeof authApi.useMe>);
    render(<AuthedShell>hello</AuthedShell>);
    expect(screen.getByText('hello')).toBeInTheDocument();
    vi.mocked(authApi.useMe).mockReturnValue({ data: undefined, isSuccess: false } as unknown as ReturnType<typeof authApi.useMe>);
    render(<AuthedShell>y</AuthedShell>);
    expect(mutate).not.toHaveBeenCalled();
  });
});
