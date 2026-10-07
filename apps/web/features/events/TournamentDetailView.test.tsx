import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TournamentDetailView } from './TournamentDetailView';

let roles: string[] = ['Admin'];
vi.mock('next/link', () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/features/auth/api', () => ({ useMe: () => ({ data: { roles } }) }));
vi.mock('./api', () => ({
  useTournament: () => ({ isPending: false, isError: false, data: { id: 'T1', name: 'Cup', status: 'open' } }),
  useEvents: () => ({ data: [{ id: 'E1', discipline: 'XD', gradeMin: 'S-', gradeMax: 'S+' }] }),
}));

describe('TournamentDetailView', () => {
  it('shows role based links per event', () => {
    roles = ['Admin'];
    const { unmount } = render(<TournamentDetailView tournamentId="T1" />);
    expect(screen.getByTestId('tournament-name')).toHaveTextContent('Cup');
    expect(screen.getByTestId('event-entries-admin')).toHaveAttribute('href', '/admin/events/E1/entries');
    expect(screen.queryByTestId('event-entries-committee')).toBeNull();
    unmount();
    roles = ['Admin', 'Committee'];
    render(<TournamentDetailView tournamentId="T1" />);
    expect(screen.getByTestId('event-entries-committee')).toHaveAttribute('href', '/committee/events/E1/entries');
  });
});
