import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminEntries } from './AdminEntries';
import type { components } from '@/lib/api/schema';

type Entry = components['schemas']['Entry'];
type EventDetail = components['schemas']['EventDetail'];

vi.mock('./api');
vi.mock('@/features/events/api');

import { useEntries, useForwardEntry } from './api';
import { useEvent } from '@/features/events/api';

const mockGrade = {
  score: 7.4,
  margin: 0.6,
  lower: 'S' as const,
  upper: 'S+' as const,
  center: 'S' as const,
  tier: 'Standard' as const,
  kind: 'exact' as const,
  label: 'S',
};

const createMockEntry = (overrides?: Partial<Entry>): Entry => ({
  id: '1',
  eventId: 'event-1',
  status: 'draft' as const,
  createdBy: 'user-1',
  name: 'Test Entry',
  players: [
    {
      userId: 'player-1',
      displayName: 'Player One',
      teamIds: ['team-1'],
      teamId: 'team-1',
      teamCount: 1,
      gradeConsent: true,
      grade: mockGrade,
    },
  ],
  forwardedAt: null,
  decidedBy: null,
  decidedAt: null,
  decisionReason: null,
  seedScore: null,
  gradeVisibility: 'hidden' as const,
  warnings: [],
  ...overrides,
});

const createMockEvent = (overrides?: Partial<EventDetail>): EventDetail => ({
  id: 'event-1',
  tournamentId: 'tournament-1',
  tournamentName: 'Test Tournament',
  tournamentStatus: 'open' as const,
  discipline: 'MD' as const,
  gradeMin: 'S-' as const,
  gradeMax: 'S+' as const,
  maxEntries: 64,
  requiresFreshAssessment: false,
  minReviewers: 2,
  entryCount: 1,
  ...overrides,
});

describe('AdminEntries', () => {
  it('shows the new-entry link only when the tournament is open and forwards a draft', async () => {
    const mockForward = vi.fn();
    const entry = createMockEntry({ id: 'entry-1', status: 'draft' as const });

    vi.mocked(useEvent).mockReturnValue({
      data: createMockEvent({ tournamentStatus: 'open' as const }),
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    vi.mocked(useEntries).mockReturnValue({
      data: [entry],
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    vi.mocked(useForwardEntry).mockReturnValue({
      mutate: mockForward,
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
      data: null,
      status: 'idle',
      reset: vi.fn(),
    } as any);

    const { rerender } = render(<AdminEntries eventId="event-1" />);

    // When tournament is open: show new-entry link
    expect(screen.getByTestId('entry-new')).toBeInTheDocument();
    expect(screen.queryByTestId('entries-closed-notice')).not.toBeInTheDocument();

    // Click forward button on draft
    const forwardButton = screen.getByTestId('entry-forward');
    await userEvent.click(forwardButton);

    expect(mockForward).toHaveBeenCalledWith({ entryId: 'entry-1' }, expect.any(Object));

    // Now test with tournament closed
    vi.mocked(useEvent).mockReturnValue({
      data: createMockEvent({ tournamentStatus: 'draft' as const }),
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    rerender(<AdminEntries eventId="event-1" />);

    // When tournament is closed: hide new-entry link, show notice
    expect(screen.queryByTestId('entry-new')).not.toBeInTheDocument();
    const closedNotice = screen.getByTestId('entries-closed-notice');
    expect(closedNotice).toHaveTextContent('ต้องเปิดรับสมัครทัวร์นาเมนต์ก่อน');
  });

  it('displays forward error when forward fails', async () => {
    const mockForward = vi.fn((_, callbacks) => {
      callbacks.onError({ message: 'ไม่สามารถส่งได้' });
    });

    const entry = createMockEntry({ id: 'entry-1', status: 'draft' as const });

    vi.mocked(useEvent).mockReturnValue({
      data: createMockEvent({ tournamentStatus: 'open' as const }),
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    vi.mocked(useEntries).mockReturnValue({
      data: [entry],
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    vi.mocked(useForwardEntry).mockReturnValue({
      mutate: mockForward,
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
      data: null,
      status: 'idle',
      reset: vi.fn(),
    } as any);

    render(<AdminEntries eventId="event-1" />);

    const forwardButton = screen.getByTestId('entry-forward');
    await userEvent.click(forwardButton);

    const errorElement = screen.getByTestId('entries-action-error');
    expect(errorElement).toHaveTextContent('ไม่สามารถส่งได้');
    expect(errorElement).toHaveAttribute('role', 'alert');
  });

  it('passes mode admin to EntryTable', () => {
    vi.mocked(useEvent).mockReturnValue({
      data: createMockEvent(),
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    vi.mocked(useEntries).mockReturnValue({
      data: [createMockEntry()],
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    vi.mocked(useForwardEntry).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
      data: null,
      status: 'idle',
      reset: vi.fn(),
    } as any);

    render(<AdminEntries eventId="event-1" />);

    const table = screen.getByTestId('entry-table');
    expect(table).toBeInTheDocument();
  });

  it('displays event header with tournament name and discipline range', () => {
    const event = createMockEvent({
      tournamentName: 'Open Championships',
      discipline: 'XD' as const,
      gradeMin: 'N' as const,
      gradeMax: 'P+' as const,
    });

    vi.mocked(useEvent).mockReturnValue({
      data: event,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    vi.mocked(useEntries).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    vi.mocked(useForwardEntry).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
      data: null,
      status: 'idle',
      reset: vi.fn(),
    } as any);

    render(<AdminEntries eventId="event-1" />);

    expect(screen.getByText('Open Championships')).toBeInTheDocument();
    expect(screen.getByText(/XD N–P\+/)).toBeInTheDocument();
  });
});
