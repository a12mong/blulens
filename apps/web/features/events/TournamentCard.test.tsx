import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TournamentCard, type TournamentDetail } from './TournamentCard';
import { TournamentStatusBadge } from './TournamentStatusBadge';

describe('TournamentCard', () => {
  const mockDraftTournament: TournamentDetail = {
    id: 't-1',
    name: 'เชียงใหม่ โอเพ่น 2026',
    startsOn: '2026-11-12',
    entriesCloseAt: '2026-11-01T23:59:59Z',
    venue: 'สนามกีฬาสมโภช 700 ปี',
    status: 'draft',
    events: [
      {
        id: 'e-1',
        tournamentId: 't-1',
        discipline: 'MD',
        gradeMin: 'S-',
        gradeMax: 'S+',
        requiresFreshAssessment: false,
        minReviewers: 2,
      },
      {
        id: 'e-2',
        tournamentId: 't-1',
        discipline: 'XD',
        gradeMin: 'BG1',
        gradeMax: 'BG3',
        requiresFreshAssessment: false,
        minReviewers: 2,
      },
    ],
  };

  it('renders name, status text and one chip per event; publish button only for managers on drafts', () => {
    const onOpen = vi.fn();

    // With canManage = true and draft status: publish button should be present
    const { rerender } = render(
      <TournamentCard
        tournament={mockDraftTournament}
        canManage={true}
        onOpen={onOpen}
      />,
    );

    // Tournament name
    const name = screen.getByTestId('tournament-name');
    expect(name).toHaveTextContent('เชียงใหม่ โอเพ่น 2026');

    // Status badge
    const status = screen.getByTestId('tournament-status');
    expect(status).toHaveAttribute('data-status', 'draft');
    expect(status).toHaveTextContent('ร่าง');

    // 2 Event chips with en dash
    const chips = screen.getAllByTestId('tournament-event-chip');
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveTextContent('MD S-–S+');
    expect(chips[1]).toHaveTextContent('XD BG1–BG3');

    // Publish button present and callable
    const publishBtn = screen.getByTestId('tournament-publish');
    expect(publishBtn).toHaveTextContent('เปิดรับสมัคร');
    fireEvent.click(publishBtn);
    expect(onOpen).toHaveBeenCalledWith(mockDraftTournament);

    // Re-render with canManage = false -> publish button must be absent
    rerender(
      <TournamentCard
        tournament={mockDraftTournament}
        canManage={false}
        onOpen={onOpen}
      />,
    );
    expect(screen.queryByTestId('tournament-publish')).toBeNull();

    // Re-render with status = 'open' and canManage = true -> publish button must be absent
    rerender(
      <TournamentCard
        tournament={{ ...mockDraftTournament, status: 'open' }}
        canManage={true}
        onOpen={onOpen}
      />,
    );
    expect(screen.queryByTestId('tournament-publish')).toBeNull();
  });

  it('shows "ยังไม่มีอีเวนต์" when events array is empty or missing', () => {
    const tournamentNoEvents: TournamentDetail = {
      id: 't-2',
      name: 'ทัวร์นาเมนต์ว่าง',
      startsOn: '2026-12-01',
      entriesCloseAt: '2026-11-20T23:59:59Z',
      status: 'open',
      events: [],
    };

    const { rerender } = render(
      <TournamentCard tournament={tournamentNoEvents} />,
    );

    expect(screen.getByTestId('tournament-no-events')).toHaveTextContent(
      'ยังไม่มีอีเวนต์',
    );
    expect(screen.queryByTestId('tournament-event-chip')).toBeNull();

    // Undefined events
    rerender(
      <TournamentCard
        tournament={{ ...tournamentNoEvents, events: undefined }}
      />,
    );
    expect(screen.getByTestId('tournament-no-events')).toHaveTextContent(
      'ยังไม่มีอีเวนต์',
    );
  });

  it('renders open link with href /events/{id}', () => {
    render(<TournamentCard tournament={mockDraftTournament} />);

    const openLink = screen.getByTestId('tournament-open');
    expect(openLink).toHaveAttribute('href', '/events/t-1');
    expect(openLink).toHaveTextContent('เปิด');
  });

  it('omits venue when absent and displays venue when present', () => {
    const { rerender } = render(
      <TournamentCard tournament={mockDraftTournament} />,
    );
    expect(screen.getByTestId('tournament-venue')).toHaveTextContent(
      'สนามกีฬาสมโภช 700 ปี',
    );

    rerender(
      <TournamentCard
        tournament={{ ...mockDraftTournament, venue: undefined }}
      />,
    );
    expect(screen.queryByTestId('tournament-venue')).toBeNull();
  });

  it('renders close date with prefix "ปิดรับ "', () => {
    render(<TournamentCard tournament={mockDraftTournament} />);

    const closeDate = screen.getByTestId('tournament-close-date');
    expect(closeDate).toHaveTextContent(/^ปิดรับ /);
  });
});

describe('TournamentStatusBadge', () => {
  it('renders correct Thai labels and symbols for all status states', () => {
    const statuses = [
      { status: 'draft' as const, label: 'ร่าง', symbol: '✎' },
      { status: 'open' as const, label: 'เปิดรับสมัคร', symbol: '●' },
      { status: 'closed' as const, label: 'ปิดรับสมัคร', symbol: '✕' },
      { status: 'running' as const, label: 'กำลังแข่งขัน', symbol: '▶' },
      { status: 'finished' as const, label: 'จบแล้ว', symbol: '✓' },
    ];

    statuses.forEach(({ status, label, symbol }) => {
      const { unmount } = render(<TournamentStatusBadge status={status} />);
      const badge = screen.getByTestId('tournament-status');
      expect(badge).toHaveAttribute('data-status', status);
      expect(badge).toHaveTextContent(label);
      expect(badge).toHaveTextContent(symbol);
      unmount();
    });
  });
});
