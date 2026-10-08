import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BracketPage } from './BracketPage';
import { BRACKET_REFETCH_INTERVAL, useBracket, useStandings } from './api';

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return {
    ...actual,
    useBracket: vi.fn(),
    useStandings: vi.fn(),
  };
});

describe('BracketPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useBracket).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
      dataUpdatedAt: 0,
    } as any);
    vi.mocked(useStandings).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
      dataUpdatedAt: 0,
    } as any);
  });

  it('fixture mode shows the groups tab by default and switches to the knockout bracket', () => {
    render(<BracketPage eventId="evt-1" fixture={true} />);

    // By default, groups tab is active and shows 2 group-standings tables
    const groupTables = screen.getAllByTestId('group-standings');
    expect(groupTables).toHaveLength(2);
    expect(screen.queryByTestId('bracket-tree')).toBeNull();

    // Verify last-updated text format
    expect(screen.getByTestId('bracket-last-updated')).toHaveTextContent(
      /อัปเดต \d{2}:\d{2} \(รีเฟรชอัตโนมัติ 30 วิ\)/,
    );

    // Click 'สายน็อคเอาท์' tab
    const knockoutTab = screen.getByRole('tab', { name: 'สายน็อคเอาท์' });
    fireEvent.click(knockoutTab);

    // Now bracket-tree is present, groups tables are unmounted
    expect(screen.getByTestId('bracket-tree')).toBeInTheDocument();
    expect(screen.queryByTestId('group-standings')).toBeNull();

    // Switch back to 'รอบกลุ่ม'
    const groupsTab = screen.getByRole('tab', { name: 'รอบกลุ่ม' });
    fireEvent.click(groupsTab);
    expect(screen.getAllByTestId('group-standings')).toHaveLength(2);
  });

  it('shows bracket-unpublished and back link on 404', () => {
    vi.mocked(useBracket).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: { status: 404, message: 'Not found' },
    } as any);
    vi.mocked(useStandings).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: { status: 404, message: 'Not found' },
    } as any);

    render(<BracketPage eventId="evt-1" fixture={false} />);

    const unpublished = screen.getByTestId('bracket-unpublished');
    expect(unpublished).toBeInTheDocument();
    expect(unpublished).toHaveTextContent('สายแข่งยังไม่ประกาศ');

    const backLink = screen.getByRole('link', { name: /กลับไปหน้ารายการ/ });
    expect(backLink).toHaveAttribute('href', '/events');
  });

  it('falls back to the standings when the bracket 404s but groups exist', () => {
    vi.mocked(useBracket).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: { status: 404, message: 'Not found' },
    } as any);
    vi.mocked(useStandings).mockReturnValue({
      data: [
        {
          groupId: 'g1',
          entryId: 'e1',
          entry: { id: 'e1', players: [] },
          rank: 1,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          points: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          diff: 0,
          confirmed: false,
        },
      ],
      isPending: false,
      isError: false,
      error: null,
      dataUpdatedAt: 0,
    } as any);

    render(<BracketPage eventId="evt-1" fixture={false} />);

    expect(screen.queryByTestId('bracket-unpublished')).toBeNull();
    expect(screen.getAllByTestId('group-standings')).toHaveLength(1);
  });

  it('shows loading status while fetching', () => {
    vi.mocked(useBracket).mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
    } as any);
    vi.mocked(useStandings).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
    } as any);

    render(<BracketPage eventId="evt-1" fixture={false} />);

    expect(screen.getByRole('status')).toHaveTextContent('กำลังโหลด…');
  });

  it('displays role=alert for other errors via thaiError', () => {
    vi.mocked(useBracket).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new TypeError('Failed to fetch'),
    } as any);
    vi.mocked(useStandings).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
    } as any);

    render(<BracketPage eventId="evt-1" fixture={false} />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
  });

  it('defaults to knockout tab when standings is empty', () => {
    vi.mocked(useBracket).mockReturnValue({
      data: {
        rounds: [
          {
            round: 1,
            matches: [
              {
                matchNo: 1,
                status: 'scheduled',
                topEntry: { displayName: 'A' },
                bottomEntry: { displayName: 'B' },
              },
            ],
          },
        ],
      },
      isPending: false,
      isError: false,
      error: null,
    } as any);
    vi.mocked(useStandings).mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      error: null,
    } as any);

    render(<BracketPage eventId="evt-1" fixture={false} />);

    // Default tab should be knockout since standings is empty
    expect(screen.getByTestId('bracket-tree')).toBeInTheDocument();
  });

  it('opens on the knockout tab when a bracket is published even if standings exist', () => {
    vi.mocked(useBracket).mockReturnValue({
      data: {
        eventId: 'evt-1',
        provisional: false,
        size: 2,
        rounds: [
          {
            round: 1,
            nameTh: 'ชิงชนะเลิศ',
            matches: [
              { matchNo: 1, round: 1, status: 'scheduled', topEntry: { entryId: 'a', displayName: 'A' }, bottomEntry: { entryId: 'b', displayName: 'B' } },
            ],
          },
        ],
      },
      isPending: false,
      isError: false,
      error: null,
    } as any);
    vi.mocked(useStandings).mockReturnValue({
      data: [{ group: 'A', rank: 1, entry: { entryId: 'a', displayName: 'A' }, played: 1, won: 1, lost: 0, points: 2, confirmed: true }],
      isPending: false,
      isError: false,
      error: null,
    } as any);

    render(<BracketPage eventId="evt-1" fixture={false} />);

    expect(screen.getByTestId('bracket-tree')).toBeInTheDocument();
    expect(screen.queryByTestId('group-standings')).toBeNull();
  });

  it('exports BRACKET_REFETCH_INTERVAL as 30000', () => {
    expect(BRACKET_REFETCH_INTERVAL).toBe(30_000);
  });
});
