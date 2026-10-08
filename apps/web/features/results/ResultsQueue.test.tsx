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

  it('shows when it was reported and restates the match in both dialogs', () => {
    const matchWithMeta: Match = {
      id: 'm-detail',
      stage: 'group',
      round: 1,
      court: '1',
      status: 'reported',
      reportedAt: '2026-10-08T10:30:00.000Z',
      reportedBy: 'usr-raw-id-999',
      // @ts-expect-error reportedByName optional extension
      reportedByName: 'สมปอง ผู้ตัดสิน',
      result: 'a_win',
      flags: ['UMPIRE_TEAM_CONFLICT', 'CORRECTED'],
      aEntry: {
        entryId: 'e1',
        displayName: 'คู่เอก / สมชาย',
      },
      bEntry: {
        entryId: 'e2',
        displayName: 'คู่วิชัย / ชัยวัฒน์',
      },
      games: [
        { a: 21, b: 15 },
        { a: 19, b: 21 },
        { a: 21, b: 18 },
      ],
    };

    mockUseReportedMatches.mockReturnValue({
      data: [matchWithMeta],
      isLoading: false,
      isError: false,
      refetch: refetchMock,
    });

    render(<ResultsQueue eventId="ev1" />);

    // 1. row shows result-meta and result-outcome
    const metaEl = screen.getByTestId('result-meta');
    expect(metaEl).toHaveTextContent('รายงานเมื่อ');
    expect(metaEl).toHaveTextContent('โดย สมปอง ผู้ตัดสิน');
    // raw id must never be shown
    expect(metaEl).not.toHaveTextContent('usr-raw-id-999');

    const outcomeEl = screen.getByTestId('result-outcome');
    expect(outcomeEl).toHaveTextContent('ชนะ: คู่เอก / สมชาย');

    // Flags render text
    const flagEls = screen.getAllByTestId('result-flag');
    expect(flagEls).toHaveLength(2);
    expect(flagEls[0]).toHaveTextContent('ผู้ตัดสินเกี่ยวข้องกับทีมในแมตช์');
    expect(flagEls[1]).toHaveTextContent('แก้ไขผล');

    // 2. opening approve dialog shows result-dialog-match with pair names and game scores
    fireEvent.click(screen.getByTestId('result-approve'));

    const approveDialog = screen.getByRole('dialog');
    expect(approveDialog).toBeInTheDocument();

    const approveDialogMatch = screen.getByTestId('result-dialog-match');
    expect(approveDialogMatch).toHaveTextContent('คู่เอก / สมชาย พบ คู่วิชัย / ชัยวัฒน์');
    expect(approveDialogMatch).toHaveTextContent('1: 21–15');
    expect(approveDialogMatch).toHaveTextContent('2: 19–21');
    expect(approveDialogMatch).toHaveTextContent('3: 21–18');

    // Close approve dialog
    fireEvent.click(screen.getByText('ยกเลิก'));
    expect(screen.queryByRole('dialog')).toBeNull();

    // 3. opening reject dialog shows result-dialog-match with pair names and game scores
    fireEvent.click(screen.getByTestId('result-reject'));

    const rejectDialog = screen.getByRole('dialog');
    expect(rejectDialog).toBeInTheDocument();

    const rejectDialogMatch = screen.getByTestId('result-dialog-match');
    expect(rejectDialogMatch).toHaveTextContent('คู่เอก / สมชาย พบ คู่วิชัย / ชัยวัฒน์');
    expect(rejectDialogMatch).toHaveTextContent('1: 21–15');
    expect(rejectDialogMatch).toHaveTextContent('2: 19–21');
    expect(rejectDialogMatch).toHaveTextContent('3: 21–18');
  });

  it('renders result-meta without reportedByName when field is absent, never showing raw reportedBy id', () => {
    const matchWithoutName: Match = {
      id: 'm-noname',
      stage: 'group',
      round: 1,
      status: 'reported',
      reportedAt: '2026-10-08T09:00:00.000Z',
      reportedBy: 'secret-uuid-12345',
      result: 'b_win',
      flags: ['COMMITTEE_DIRECT_ENTRY'],
      aEntry: { entryId: 'e1', displayName: 'ฝ่าย ก' },
      bEntry: { entryId: 'e2', displayName: 'ฝ่าย ข' },
      games: [{ a: 10, b: 21 }, { a: 12, b: 21 }],
    };

    mockUseReportedMatches.mockReturnValue({
      data: [matchWithoutName],
      isLoading: false,
      isError: false,
      refetch: refetchMock,
    });

    render(<ResultsQueue eventId="ev1" />);

    const metaEl = screen.getByTestId('result-meta');
    expect(metaEl).toHaveTextContent('รายงานเมื่อ');
    expect(metaEl).not.toHaveTextContent('โดย');
    expect(metaEl).not.toHaveTextContent('secret-uuid-12345');

    const outcomeEl = screen.getByTestId('result-outcome');
    expect(outcomeEl).toHaveTextContent('ชนะ: ฝ่าย ข');

    const flagEl = screen.getByTestId('result-flag');
    expect(flagEl).toHaveTextContent('คณะกรรมการกรอกเอง');
  });

  it('renders draw outcome when result is draw', () => {
    const matchDraw: Match = {
      id: 'm-draw',
      stage: 'group',
      round: 1,
      status: 'reported',
      result: 'draw',
      aEntry: { entryId: 'e1', displayName: 'ทีม A' },
      bEntry: { entryId: 'e2', displayName: 'ทีม B' },
      games: [{ a: 15, b: 15 }],
    };

    mockUseReportedMatches.mockReturnValue({
      data: [matchDraw],
      isLoading: false,
      isError: false,
      refetch: refetchMock,
    });

    render(<ResultsQueue eventId="ev1" />);

    expect(screen.getByTestId('result-outcome')).toHaveTextContent('เสมอ');
  });

  it('renders walkover outcome with pair name', () => {
    const matchWo: Match = {
      id: 'm-wo',
      stage: 'group',
      round: 1,
      status: 'reported',
      result: 'walkover_a',
      aEntry: { entryId: 'e1', displayName: 'ทีมชนะบาย' },
      bEntry: { entryId: 'e2', displayName: 'ทีมสละสิทธิ์' },
      games: [],
    };

    mockUseReportedMatches.mockReturnValue({
      data: [matchWo],
      isLoading: false,
      isError: false,
      refetch: refetchMock,
    });

    render(<ResultsQueue eventId="ev1" />);

    expect(screen.getByTestId('result-outcome')).toHaveTextContent('ชนะโดยไม่ลงแข่ง: ทีมชนะบาย');
  });
});
