import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '@/lib/api/client';
import { TournamentDetailView } from './TournamentDetailView';

let mockRoles: string[] = ['Admin'];
let mockTournamentState: {
  isPending: boolean;
  isError: boolean;
  error?: Error | ApiRequestError | null;
  data?: any;
} = {
  isPending: false,
  isError: false,
  data: { id: 'T1', name: 'Cup', status: 'open' },
};
let mockEventsState: {
  isPending?: boolean;
  data?: any[];
} = {
  data: [
    {
      id: 'E1',
      discipline: 'XD',
      gradeMin: 'S-',
      gradeMax: 'S+',
      entryCount: 3,
      maxEntries: 16,
    },
  ],
};

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...r
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...r}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/auth/api', () => ({
  useMe: () => ({ data: { roles: mockRoles } }),
}));

vi.mock('./api', () => ({
  useTournament: () => mockTournamentState,
  useEvents: () => mockEventsState,
}));

describe('TournamentDetailView', () => {
  beforeEach(() => {
    mockRoles = ['Admin', 'Committee'];
    mockTournamentState = {
      isPending: false,
      isError: false,
      error: null,
      data: { id: 'T1', name: 'Cup', status: 'open' },
    };
    mockEventsState = {
      data: [
        {
          id: 'E1',
          discipline: 'XD',
          gradeMin: 'S-',
          gradeMax: 'S+',
          entryCount: 3,
          maxEntries: 16,
        },
      ],
    };
  });

  it('shows the entry count and role-based action buttons per event', () => {
    const { rerender } = render(<TournamentDetailView tournamentId="T1" />);

    expect(screen.getByTestId('tournament-name')).toHaveTextContent('Cup');

    // Entry count with maxEntries
    const countEl = screen.getByTestId('event-entry-count');
    expect(countEl).toHaveTextContent('ผู้สมัคร 3 คู่ / สูงสุด 16');

    // Both buttons present
    const adminLink = screen.getByTestId('event-entries-admin');
    expect(adminLink).toHaveAttribute('href', '/admin/events/E1/entries');
    expect(adminLink).toHaveTextContent('จัดการคู่ผู้สมัคร');

    const committeeLink = screen.getByTestId('event-entries-committee');
    expect(committeeLink).toHaveAttribute('href', '/committee/events/E1/entries');
    expect(committeeLink).toHaveTextContent('คิวอนุมัติ');

    // With roles ['Committee'] only committee link
    mockRoles = ['Committee'];
    rerender(<TournamentDetailView tournamentId="T1" />);
    expect(screen.queryByTestId('event-entries-admin')).toBeNull();
    expect(screen.getByTestId('event-entries-committee')).toBeInTheDocument();

    // Tournament status draft -> tournament-not-open is visible
    mockTournamentState = {
      ...mockTournamentState,
      data: { id: 'T1', name: 'Cup', status: 'draft' },
    };
    rerender(<TournamentDetailView tournamentId="T1" />);
    const notOpenEl = screen.getByTestId('tournament-not-open');
    expect(notOpenEl).toBeInTheDocument();
    expect(notOpenEl).toHaveTextContent('ยังไม่เปิดรับสมัคร');
  });

  it('shows skeleton while pending', () => {
    mockTournamentState = {
      isPending: true,
      isError: false,
      data: undefined,
    };

    render(<TournamentDetailView tournamentId="T1" />);

    const skeleton = screen.getByTestId('tournament-skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('role', 'status');
    expect(skeleton).toHaveAttribute('aria-label', 'กำลังโหลด');
  });

  it('shows Thai error message on tournament query error', () => {
    mockTournamentState = {
      isPending: false,
      isError: true,
      error: new Error('Network error'),
      data: undefined,
    };

    render(<TournamentDetailView tournamentId="T1" />);

    const errorEl = screen.getByTestId('tournament-detail-error');
    expect(errorEl).toBeInTheDocument();
    expect(errorEl).toHaveAttribute('role', 'alert');
    expect(errorEl).toHaveTextContent('ไม่พบทัวร์นาเมนต์');
  });

  it('shows event-empty when no events exist', () => {
    mockEventsState = { data: [] };

    render(<TournamentDetailView tournamentId="T1" />);

    const emptyEl = screen.getByTestId('event-empty');
    expect(emptyEl).toBeInTheDocument();
    expect(emptyEl).toHaveTextContent('ยังไม่มีอีเวนต์');
  });

  it('shows entry count without maxEntries when maxEntries is not provided', () => {
    mockEventsState = {
      data: [
        {
          id: 'E2',
          discipline: 'MD',
          gradeMin: 'B-',
          gradeMax: 'B+',
          entryCount: 8,
        },
      ],
    };

    render(<TournamentDetailView tournamentId="T1" />);

    const countEl = screen.getByTestId('event-entry-count');
    expect(countEl).toHaveTextContent('ผู้สมัคร 8 คู่');
    expect(countEl.textContent).not.toContain('สูงสุด');
  });

  it('does not render entry count when entryCount is undefined', () => {
    mockEventsState = {
      data: [
        {
          id: 'E3',
          discipline: 'WS',
          gradeMin: 'N',
          gradeMax: 'N',
        },
      ],
    };

    render(<TournamentDetailView tournamentId="T1" />);

    expect(screen.queryByTestId('event-entry-count')).toBeNull();
  });
});
