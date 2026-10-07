import { render, screen } from '@testing-library/react';
import { RoleGuard } from './RoleGuard';

const replace = vi.fn();
let meState: { data: unknown; isPending: boolean } = { data: undefined, isPending: true };

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }), usePathname: () => '/committee' }));
vi.mock('@/features/auth/api', () => ({ useMe: () => meState }));

describe('RoleGuard', () => {
  beforeEach(() => replace.mockClear());

  it('redirects a guest to /login with next', () => {
    meState = { data: null, isPending: false };
    render(<RoleGuard area="committee">secret</RoleGuard>);
    expect(replace).toHaveBeenCalledWith('/login?next=%2Fcommittee');
    expect(screen.queryByText('secret')).toBeNull();
  });
  it('shows 403 for the wrong role', () => {
    meState = { data: { roles: ['Member'] }, isPending: false };
    render(<RoleGuard area="committee">secret</RoleGuard>);
    expect(screen.getByRole('alert')).toHaveTextContent('403');
    expect(replace).not.toHaveBeenCalled();
  });
  it('renders children for an allowed role', () => {
    meState = { data: { roles: ['Committee'] }, isPending: false };
    render(<RoleGuard area="committee">secret</RoleGuard>);
    expect(screen.getByText('secret')).toBeInTheDocument();
  });
});
