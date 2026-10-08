import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '@/lib/api/client';
import { useUmpireMatches, type Match } from './api';
import { UmpireMatches } from './UmpireMatches';

vi.mock('./api', () => ({
  useUmpireMatches: vi.fn(),
}));

describe('UmpireMatches', () => {
  const mockRefetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockMatches: Match[] = [
    {
      id: 'm-court2',
      stage: 'knockout',
      round: 1,
      court: '2',
      status: 'scheduled',
      aEntry: {
        entryId: 'e-1',
        displayName: 'ผู้เล่น A1 / A2',
        teamNames: ['สโมสร ก'],
      },
      bEntry: {
        entryId: 'e-2',
        displayName: 'ผู้เล่น B1 / B2',
        teamNames: ['สโมสร ข'],
      },
    },
    {
      id: 'm-court1',
      stage: 'group',
      round: 2,
      court: '1',
      status: 'scheduled',
      aEntry: {
        entryId: 'e-3',
        displayName: 'ผู้เล่น C1 / C2',
        teamNames: ['สโมสร ค'],
      },
      bEntry: {
        entryId: 'e-4',
        displayName: 'ผู้เล่น D1 / D2',
        teamNames: ['สโมสร ง'],
      },
    },
    {
      id: 'm-confirmed',
      stage: 'knockout',
      round: 2,
      court: '1',
      status: 'confirmed',
      aEntry: {
        entryId: 'e-5',
        displayName: 'ผู้เล่น E1 / E2',
        teamNames: ['สโมสร จ'],
      },
      bEntry: {
        entryId: 'e-6',
        displayName: 'ผู้เล่น F1 / F2',
        teamNames: ['สโมสร ฉ'],
      },
    },
  ];

  it('lists todo matches by default, counts the tabs and links to the result page (proving test)', () => {
    (useUmpireMatches as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockMatches,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<UmpireMatches />);

    // Verify tab counts
    expect(screen.getByTestId('umpire-tab-todo')).toHaveTextContent('รอกรอก (2)');
    expect(screen.getByTestId('umpire-tab-reported')).toHaveTextContent('รายงานแล้ว (0)');
    expect(screen.getByTestId('umpire-tab-confirmed')).toHaveTextContent('ยืนยันแล้ว (1)');
    expect(screen.getByTestId('umpire-tab-all')).toHaveTextContent('ทั้งหมด (3)');

    // Default tab shows 2 cards ordered court 1 then court 2
    const cards = screen.getAllByTestId('umpire-match');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('สนาม 1 · กลุ่ม รอบ 2');
    expect(cards[1]).toHaveTextContent('สนาม 2 · น็อคเอาท์ รอบ 1');

    // First card action link
    const actions = screen.getAllByTestId('umpire-match-action');
    expect(actions[0]).toHaveAttribute('href', '/umpire/matches/m-court1');
    expect(actions[0]).toHaveTextContent('กรอกผล');
    expect(actions[1]).toHaveAttribute('href', '/umpire/matches/m-court2');
    expect(actions[1]).toHaveTextContent('กรอกผล');

    // Click confirmed tab -> 1 card with 'ดู'
    fireEvent.click(screen.getByTestId('umpire-tab-confirmed'));

    const confirmedCards = screen.getAllByTestId('umpire-match');
    expect(confirmedCards).toHaveLength(1);
    expect(confirmedCards[0]).toHaveTextContent('สนาม 1 · น็อคเอาท์ รอบ 2');
    const confirmedAction = screen.getByTestId('umpire-match-action');
    expect(confirmedAction).toHaveAttribute('href', '/umpire/matches/m-confirmed');
    expect(confirmedAction).toHaveTextContent('ดู');
  });

  it('shows reported tab with "แก้ผล" action link', () => {
    const reportedMatches: Match[] = [
      {
        id: 'm-reported',
        stage: 'group',
        round: 1,
        court: '3',
        status: 'reported',
        aEntry: { entryId: 'e-1', displayName: 'คู่ ก' },
        bEntry: { entryId: 'e-2', displayName: 'คู่ ข' },
      },
    ];

    (useUmpireMatches as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: reportedMatches,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<UmpireMatches />);

    fireEvent.click(screen.getByTestId('umpire-tab-reported'));

    const cards = screen.getAllByTestId('umpire-match');
    expect(cards).toHaveLength(1);
    const action = screen.getByTestId('umpire-match-action');
    expect(action).toHaveAttribute('href', '/umpire/matches/m-reported');
    expect(action).toHaveTextContent('แก้ผล');
  });

  it('displays empty text when category has no matches', () => {
    (useUmpireMatches as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockMatches,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<UmpireMatches />);

    // Click reported tab (has 0 matches)
    fireEvent.click(screen.getByTestId('umpire-tab-reported'));

    expect(screen.getByTestId('umpire-empty')).toHaveTextContent('ไม่มีแมตช์ในหมวดนี้');
  });

  it('renders skeleton loading state', () => {
    (useUmpireMatches as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<UmpireMatches />);

    expect(screen.getByTestId('umpire-skeleton')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders error state with retry button', () => {
    (useUmpireMatches as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new ApiRequestError(403, 'FORBIDDEN', 'Forbidden'),
      refetch: mockRefetch,
    });

    render(<UmpireMatches />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('data-testid', 'umpire-error');
    expect(alert).toHaveTextContent('คุณไม่มีสิทธิ์ทำรายการนี้');

    const retryBtn = screen.getByTestId('umpire-retry');
    expect(retryBtn).toHaveTextContent('ลองใหม่');
    fireEvent.click(retryBtn);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('renders UMPIRE_TEAM_CONFLICT flag chip', () => {
    const conflictMatches: Match[] = [
      {
        id: 'm-conflict',
        stage: 'knockout',
        round: 1,
        court: '1',
        status: 'scheduled',
        flags: ['UMPIRE_TEAM_CONFLICT'],
        aEntry: { entryId: 'e-1', displayName: 'คู่สังกัดเดียวกัน' },
        bEntry: { entryId: 'e-2', displayName: 'คู่ฝ่ายตรงข้าม' },
      },
    ];

    (useUmpireMatches as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: conflictMatches,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<UmpireMatches />);

    const chip = screen.getByTestId('umpire-team-conflict');
    expect(chip).toHaveTextContent('ผู้ตัดสินสังกัดเดียวกับผู้เล่น');
  });

  it('handles bye and void matches without action links in all tab', () => {
    const mixedMatches: Match[] = [
      {
        id: 'm-bye',
        stage: 'knockout',
        round: 1,
        court: '1',
        status: 'bye',
        aEntry: { entryId: 'e-1', displayName: 'บาย A' },
      },
      {
        id: 'm-void',
        stage: 'knockout',
        round: 1,
        court: '2',
        status: 'void',
        aEntry: { entryId: 'e-2', displayName: 'ยกเลิก A' },
      },
    ];

    (useUmpireMatches as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mixedMatches,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<UmpireMatches />);

    fireEvent.click(screen.getByTestId('umpire-tab-all'));

    const cards = screen.getAllByTestId('umpire-match');
    expect(cards).toHaveLength(2);
    expect(screen.getByText('BYE')).toBeInTheDocument();
    expect(screen.getByText('ยกเลิก')).toBeInTheDocument();
    expect(screen.queryByTestId('umpire-match-action')).not.toBeInTheDocument();
  });
});
