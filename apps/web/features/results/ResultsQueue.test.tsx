import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ResultsQueue } from './ResultsQueue';
import { ApiRequestError } from '@/lib/api/client';
import type { Match } from './api';

const mockUseReportedMatches = vi.fn();
const mockUseMatchDecision = vi.fn();

vi.mock('./api', () => ({
  useReportedMatches: (eventId: string, options?: unknown) =>
    mockUseReportedMatches(eventId, options),
  useMatchDecision: (eventId: string, options?: unknown) =>
    mockUseMatchDecision(eventId, options),
}));

const match1: Match = {
  id: 'm1',
  stage: 'group',
  round: 1,
  court: '1',
  status: 'reported',
  aEntry: {
    entryId: 'e1',
    displayName: 'Somchai / Somsak',
    teamNames: ['Club A'],
  },
  bEntry: {
    entryId: 'e2',
    displayName: 'Wichai / Wiroj',
    teamNames: ['Club B'],
  },
  games: [
    { a: 15, b: 11 },
    { a: 15, b: 9 },
  ],
};

const match2: Match = {
  id: 'm2',
  stage: 'knockout',
  round: 2,
  court: '2',
  status: 'reported',
  aEntry: {
    entryId: 'e3',
    displayName: 'Anan / Arthit',
  },
  bEntry: {
    entryId: 'e4',
    displayName: 'Boonchu / Banjerd',
  },
  games: [
    { a: 21, b: 19 },
    { a: 18, b: 21 },
    { a: 21, b: 17 },
  ],
};

const walkoverMatch: Match = {
  id: 'm3',
  stage: 'group',
  round: 1,
  status: 'reported',
  result: 'walkover_a',
  aEntry: {
    entryId: 'e5',
    displayName: 'Player One',
  },
  bEntry: {
    entryId: 'e6',
    displayName: 'Player Two',
  },
  games: [
    { a: 0, b: 0 },
  ],
};

describe('ResultsQueue', () => {
  let mutateMock: ReturnType<typeof vi.fn>;
  let resetMock: ReturnType<typeof vi.fn>;
  let refetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mutateMock = vi.fn();
    resetMock = vi.fn();
    refetchMock = vi.fn();

    mockUseMatchDecision.mockReturnValue({
      mutate: mutateMock,
      isPending: false,
      error: null,
      reset: resetMock,
    });
  });

  it('approves a reported match and sends another back with a reason', async () => {
    mockUseReportedMatches.mockReturnValue({
      data: [match1, match2],
      isLoading: false,
      isError: false,
      refetch: refetchMock,
    });

    render(<ResultsQueue eventId="ev1" />);

    // Two reported rows
    const rows = screen.getAllByTestId('result-row');
    expect(rows).toHaveLength(2);

    // Verify side names and scores
    expect(screen.getByText('Somchai / Somsak')).toBeInTheDocument();
    expect(screen.getByText('Wichai / Wiroj')).toBeInTheDocument();
    expect(screen.getByText('15–11, 15–9')).toBeInTheDocument();

    expect(screen.getByText('Anan / Arthit')).toBeInTheDocument();
    expect(screen.getByText('Boonchu / Banjerd')).toBeInTheDocument();
    expect(screen.getByText('21–19, 18–21, 21–17')).toBeInTheDocument();

    // Row 1: Click approve -> confirm dialog appears
    const approveBtns = screen.getAllByTestId('result-approve');
    fireEvent.click(approveBtns[0]!);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('ยืนยันผลแมตช์นี้?')).toBeInTheDocument();

    // Click confirm submit in dialog
    const confirmSubmitBtn = screen.getByTestId('confirm-submit');
    fireEvent.click(confirmSubmitBtn);

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith(
      { matchId: 'm1', action: 'approve' },
      expect.any(Object),
    );

    // Simulate mutation success for approve
    const approveSuccessCb = mutateMock.mock.calls[0]![1]?.onSuccess;
    act(() => {
      approveSuccessCb?.();
    });

    // Row 2: Click reject -> ReasonDialog opens
    const rejectBtns = screen.getAllByTestId('result-reject');
    fireEvent.click(rejectBtns[1]!);

    const rejectDialog = screen.getByRole('dialog');
    expect(rejectDialog).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'ส่งกลับให้กรรมการ' }),
    ).toBeInTheDocument();

    const reasonInput = screen.getByTestId('reason-input');
    const reasonSubmitBtn = screen.getByTestId('reason-submit');

    // 4 chars keeps submit disabled
    fireEvent.change(reasonInput, { target: { value: 'abcd' } });
    expect(reasonSubmitBtn).toBeDisabled();

    // 5 chars enables submit
    fireEvent.change(reasonInput, { target: { value: 'abcde' } });
    expect(reasonSubmitBtn).not.toBeDisabled();

    fireEvent.click(reasonSubmitBtn);

    expect(mutateMock).toHaveBeenCalledTimes(2);
    expect(mutateMock).toHaveBeenCalledWith(
      { matchId: 'm2', action: 'reject', reason: 'abcde' },
      expect.any(Object),
    );
  });

  it('renders empty state when no reported matches exist', () => {
    mockUseReportedMatches.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: refetchMock,
    });

    render(<ResultsQueue eventId="ev1" />);

    expect(screen.getByText('ไม่มีผลที่รอยืนยัน')).toBeInTheDocument();
  });

  it('renders skeleton while loading', () => {
    mockUseReportedMatches.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: refetchMock,
    });

    render(<ResultsQueue eventId="ev1" />);

    expect(screen.getByTestId('results-loading')).toBeInTheDocument();
  });

  it('renders error state with retry button', () => {
    const error = new ApiRequestError(409, 'MATCH_NOT_REPORTED', 'Match is not reported');
    mockUseReportedMatches.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error,
      refetch: refetchMock,
    });

    render(<ResultsQueue eventId="ev1" />);

    const errorAlert = screen.getByTestId('results-error');
    expect(errorAlert).toBeInTheDocument();
    expect(screen.getByText('แมตช์นี้ไม่ได้อยู่ในสถานะรอยืนยัน')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: 'ลองใหม่' });
    fireEvent.click(retryBtn);
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });

  it('walkover row shows the walkover text and no scores', () => {
    mockUseReportedMatches.mockReturnValue({
      data: [walkoverMatch],
      isLoading: false,
      isError: false,
      refetch: refetchMock,
    });

    render(<ResultsQueue eventId="ev1" />);

    expect(screen.getByText('ชนะโดยไม่ลงแข่ง')).toBeInTheDocument();
    expect(screen.queryByText(/0–0/)).not.toBeInTheDocument();
  });

  it('displays mutation error in approve dialog', () => {
    mockUseReportedMatches.mockReturnValue({
      data: [match1],
      isLoading: false,
      isError: false,
      refetch: refetchMock,
    });

    mockUseMatchDecision.mockReturnValue({
      mutate: mutateMock,
      isPending: false,
      error: new ApiRequestError(409, 'STAGE_CONFIRMED', 'Stage already confirmed'),
      reset: resetMock,
    });

    render(<ResultsQueue eventId="ev1" />);

    fireEvent.click(screen.getByTestId('result-approve'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('รอบนี้ยืนยันแล้ว แก้ไขไม่ได้')).toBeInTheDocument();
  });
});
