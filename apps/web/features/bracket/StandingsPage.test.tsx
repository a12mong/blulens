import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StandingsPage } from './StandingsPage';
import { useStandings } from './api';
import type { GroupStanding } from './bracketFixture';

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return {
    ...actual,
    useStandings: vi.fn(),
  };
});

describe('StandingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows one table per group and the provisional badge until every row is confirmed (proving test)', () => {
    const twoGroupsWithOneProvisional: GroupStanding[] = [
      {
        groupId: 'g-1',
        entryId: 'e1',
        entry: { entryId: 'e1', displayName: 'กิตติ / สมชาย' },
        rank: 1,
        played: 2,
        won: 2,
        drawn: 0,
        lost: 0,
        points: 4,
        pointsFor: 60,
        pointsAgainst: 40,
        diff: 20,
        qualification: 'qualified',
        confirmed: true,
      },
      {
        groupId: 'g-1',
        entryId: 'e2',
        entry: { entryId: 'e2', displayName: 'วิชัย / มานพ' },
        rank: 2,
        played: 2,
        won: 0,
        drawn: 0,
        lost: 2,
        points: 0,
        pointsFor: 40,
        pointsAgainst: 60,
        diff: -20,
        qualification: 'out',
        confirmed: false, // one row unconfirmed!
      },
      {
        groupId: 'g-2',
        entryId: 'e3',
        entry: { entryId: 'e3', displayName: 'ประสิทธิ์ / ธนกร' },
        rank: 1,
        played: 2,
        won: 2,
        drawn: 0,
        lost: 0,
        points: 4,
        pointsFor: 60,
        pointsAgainst: 42,
        diff: 18,
        qualification: 'qualified',
        confirmed: true,
      },
    ];

    vi.mocked(useStandings).mockReturnValue({
      data: twoGroupsWithOneProvisional,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    const { rerender } = render(<StandingsPage eventId="evt-101" />);

    // 2 tables rendered
    const tables = screen.getAllByTestId('group-standings');
    expect(tables).toHaveLength(2);

    // Lock badge shows 'ยังไม่ครบ'
    const lockBadge = screen.getByTestId('standings-lock');
    expect(lockBadge).toHaveTextContent('ยังไม่ครบ');
    expect(lockBadge).toHaveTextContent('ยังไม่ครบ: มีผลที่รอยืนยัน');

    // Now all rows confirmed
    const allConfirmedData = twoGroupsWithOneProvisional.map((row) => ({
      ...row,
      confirmed: true,
    }));

    vi.mocked(useStandings).mockReturnValue({
      data: allConfirmedData,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    rerender(<StandingsPage eventId="evt-101" />);

    // Lock badge updates to 'ล็อกแล้ว'
    expect(screen.getByTestId('standings-lock')).toHaveTextContent('ล็อกแล้ว');
  });

  it('renders link to knockout bracket with correct href', () => {
    vi.mocked(useStandings).mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<StandingsPage eventId="evt-abc" />);

    const link = screen.getByTestId('standings-bracket-link');
    expect(link).toHaveTextContent('ดูสายน็อคเอาท์');
    expect(link).toHaveAttribute('href', '/events/evt-abc/bracket');
  });

  it('empty state shows message when no groups exist', () => {
    vi.mocked(useStandings).mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<StandingsPage eventId="evt-101" />);

    expect(screen.getByTestId('standings-empty')).toHaveTextContent('ยังไม่มีการจับกลุ่ม');
    expect(screen.queryByTestId('group-standings')).toBeNull();
  });

  it('error state shows alert with retry button calling refetch', () => {
    const mockRefetch = vi.fn();
    vi.mocked(useStandings).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('Network failure'),
      refetch: mockRefetch,
    } as any);

    render(<StandingsPage eventId="evt-101" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: 'ลองใหม่' });
    fireEvent.click(retryBtn);
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('loading state renders status loading indicator', () => {
    vi.mocked(useStandings).mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<StandingsPage eventId="evt-101" />);

    expect(screen.getByTestId('standings-loading')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('กำลังโหลด…');
  });
});
