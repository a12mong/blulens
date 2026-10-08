import { fireEvent, render, screen, act } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '@/lib/api/client';
import { useReportResult, type Match } from './api';
import { MatchFormatBadge } from './MatchFormatBadge';
import { MatchResultForm } from './MatchResultForm';
import type { MatchFormat } from './scoreRules';
import { formatCourtName, UmpireMatchCard } from './UmpireMatchCard';
import { loadResultDraft } from './useResultDraft';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/umpire/matches/m-1',
}));

vi.mock('./api', () => ({
  useReportResult: vi.fn(),
}));

describe('MatchResultForm', () => {
  const mockMutate = vi.fn();
  const mockReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (useReportResult as any).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      error: null,
      reset: mockReset,
    });
  });

  const bo3_21: MatchFormat = {
    preset: 'bo3_21',
    mode: 'best_of',
    games: 3,
    pointsPerGame: 21,
    deuce: true,
    cap: 30,
    drawAllowed: false,
  };

  const group_2x15: MatchFormat = {
    preset: 'group_2x15',
    mode: 'fixed_games',
    games: 2,
    pointsPerGame: 15,
    deuce: false,
    cap: null,
    drawAllowed: true,
  };

  const baseMatch: Match = {
    id: 'm-1',
    stage: 'knockout',
    round: 1,
    court: '1',
    status: 'scheduled',
    aEntry: {
      entryId: 'e-1',
      displayName: 'สมชาย / วิภา',
      teamNames: ['สโมสร ก'],
    },
    bEntry: {
      entryId: 'e-2',
      displayName: 'อนันต์ / มาลี',
      teamNames: ['สโมสร ข'],
    },
    games: [],
  };

  it('reports a valid played result after a confirm and blocks an invalid score (proving test)', () => {
    const onReported = vi.fn();
    render(
      <MatchResultForm
        match={baseMatch}
        format={bo3_21}
        onReported={onReported}
      />,
    );

    const submitBtn = screen.getByTestId('result-submit');
    expect(submitBtn).toBeDisabled();

    // Set game 1 to 21-15
    const scoreAInputs = screen.getAllByTestId('score-a');
    const scoreBInputs = screen.getAllByTestId('score-b');
    fireEvent.change(scoreAInputs[0], { target: { value: '21' } });
    fireEvent.change(scoreBInputs[0], { target: { value: '15' } });

    // Now game 2 becomes visible because bo3 requires another win
    const scoreAAfterGame1 = screen.getAllByTestId('score-a');
    const scoreBAfterGame1 = screen.getAllByTestId('score-b');
    expect(scoreAAfterGame1.length).toBeGreaterThanOrEqual(2);

    // Set game 2 to 21-10
    fireEvent.change(scoreAAfterGame1[1], { target: { value: '21' } });
    fireEvent.change(scoreBAfterGame1[1], { target: { value: '10' } });

    // Result summary shows the winner and submit button is enabled
    const summary = screen.getByTestId('result-summary');
    expect(summary).toBeInTheDocument();
    expect(summary).toHaveTextContent('ผู้ชนะ: สมชาย / วิภา');
    expect(submitBtn).toBeEnabled();

    // With game 1 at 21-20 -> submit disabled and a game-error
    fireEvent.change(screen.getAllByTestId('score-b')[0], {
      target: { value: '20' },
    });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByTestId('game-error')).toHaveTextContent(
      'ต้องห่างกัน 2 แต้ม',
    );

    // Restore game 1 to 21-15 -> submit enabled
    fireEvent.change(screen.getAllByTestId('score-b')[0], {
      target: { value: '15' },
    });
    expect(submitBtn).toBeEnabled();

    // Click submit -> confirm dialog opens
    fireEvent.click(submitBtn);
    expect(
      screen.getByRole('heading', {
        name: /ยืนยันรายงานผล สมชาย \/ วิภา/,
      }),
    ).toBeInTheDocument();

    // Click result-confirm -> mutate called with only the 2 played games
    fireEvent.click(screen.getByTestId('result-confirm'));
    expect(mockMutate).toHaveBeenCalledWith(
      {
        outcome: 'played',
        games: [
          { a: 21, b: 15 },
          { a: 21, b: 10 },
        ],
      },
      expect.any(Object),
    );
  });

  it('walkover dialog sends walkover_a for "A ไม่มา"', () => {
    render(<MatchResultForm match={baseMatch} format={bo3_21} />);

    fireEvent.click(screen.getByTestId('result-walkover'));
    expect(
      screen.getByRole('heading', {
        name: 'เลือกฝ่ายที่ไม่มาแข่ง (Walkover)',
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('walkover-a'));
    expect(mockMutate).toHaveBeenCalledWith(
      { outcome: 'walkover_a' },
      expect.any(Object),
    );
  });

  it('confirmed match is read-only with no action buttons', () => {
    const confirmedMatch: Match = {
      ...baseMatch,
      status: 'confirmed',
      flags: ['CORRECTED'],
      games: [
        { a: 21, b: 18 },
        { a: 21, b: 19 },
      ],
    };

    render(<MatchResultForm match={confirmedMatch} format={bo3_21} />);

    const confirmedBanner = screen.getByTestId('result-confirmed');
    expect(confirmedBanner).toHaveTextContent('ยืนยันแล้ว (แก้ไขหลังยืนยัน)');

    expect(screen.queryByTestId('result-submit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('result-walkover')).not.toBeInTheDocument();
  });

  it('reported match shows the banner and prefilled scores', () => {
    const reportedMatch: Match = {
      ...baseMatch,
      status: 'reported',
      games: [
        { a: 21, b: 12 },
        { a: 21, b: 14 },
      ],
    };

    render(<MatchResultForm match={reportedMatch} format={bo3_21} />);

    expect(screen.getByTestId('result-reported')).toHaveTextContent(
      'รายงานแล้ว รอ Committee ยืนยัน',
    );

    const scoreAInputs = screen.getAllByTestId('score-a');
    const scoreBInputs = screen.getAllByTestId('score-b');
    expect(scoreAInputs[0]).toHaveValue('21');
    expect(scoreBInputs[0]).toHaveValue('12');
    expect(scoreAInputs[1]).toHaveValue('21');
    expect(scoreBInputs[1]).toHaveValue('14');
  });

  it('server 422 shows "คะแนนไม่ถูกต้องตามกติกา"', () => {
    (useReportResult as any).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      error: new ApiRequestError(422, 'MATCH_SCORE_INVALID', 'Invalid score'),
      reset: mockReset,
    });

    render(<MatchResultForm match={baseMatch} format={bo3_21} />);

    const errorEl = screen.getByTestId('result-error');
    expect(errorEl).toHaveTextContent('คะแนนไม่ถูกต้องตามกติกา');
  });

  it('keeps the scores and redirects to login on 401 (proving test)', () => {
    const { unmount } = render(
      <MatchResultForm match={baseMatch} format={bo3_21} />,
    );

    // Enter scores for game 1 and game 2
    const scoreAInputs = screen.getAllByTestId('score-a');
    const scoreBInputs = screen.getAllByTestId('score-b');
    fireEvent.change(scoreAInputs[0], { target: { value: '21' } });
    fireEvent.change(scoreBInputs[0], { target: { value: '18' } });

    const scoreAInputsG2 = screen.getAllByTestId('score-a');
    const scoreBInputsG2 = screen.getAllByTestId('score-b');
    fireEvent.change(scoreAInputsG2[1], { target: { value: '21' } });
    fireEvent.change(scoreBInputsG2[1], { target: { value: '19' } });

    // Draft key holds the entered scores
    const draftBeforeSubmit = loadResultDraft(baseMatch.id!);
    expect(draftBeforeSubmit).not.toBeNull();
    expect(draftBeforeSubmit?.games[0]).toEqual({ a: 21, b: 18 });
    expect(draftBeforeSubmit?.games[1]).toEqual({ a: 21, b: 19 });

    // Reject mutation with status 401
    mockMutate.mockImplementation((payload, options) => {
      options?.onError?.(new ApiRequestError(401, 'UNAUTHORIZED', 'Session expired'));
    });

    const submitBtn = screen.getByTestId('result-submit');
    expect(submitBtn).toBeEnabled();
    fireEvent.click(submitBtn);

    const confirmBtn = screen.getByTestId('result-confirm');
    fireEvent.click(confirmBtn);

    // router.push called with login URL with pathname encoded
    expect(mockPush).toHaveBeenCalledWith('/login?next=%2Fumpire%2Fmatches%2Fm-1');

    // Dialog is closed
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // No 401 error text inside dialog or page
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('result-error')).not.toBeInTheDocument();

    // Draft key still holds entered scores
    const draftAfter401 = loadResultDraft(baseMatch.id!);
    expect(draftAfter401?.games[0]).toEqual({ a: 21, b: 18 });
    expect(draftAfter401?.games[1]).toEqual({ a: 21, b: 19 });

    // Remount restores them
    unmount();
    render(<MatchResultForm match={baseMatch} format={bo3_21} />);

    const restoredA = screen.getAllByTestId('score-a');
    const restoredB = screen.getAllByTestId('score-b');
    expect(restoredA[0]).toHaveValue('21');
    expect(restoredB[0]).toHaveValue('18');
    expect(restoredA[1]).toHaveValue('21');
    expect(restoredB[1]).toHaveValue('19');

    // Winner summary and submit button enabled
    expect(screen.getByTestId('result-summary')).toHaveTextContent('ผู้ชนะ: สมชาย / วิภา');
    expect(screen.getByTestId('result-submit')).toBeEnabled();
  });

  it('does not duplicate "สนาม" prefix when court already starts with "สนาม"', () => {
    // Component test with court starting with "สนาม"
    const matchWithPrefix: Match = {
      ...baseMatch,
      court: 'สนาม 1',
    };
    const { unmount } = render(
      <MatchResultForm match={matchWithPrefix} format={bo3_21} />,
    );
    expect(screen.getByText('สนาม 1')).toBeInTheDocument();
    expect(screen.queryByText(/สนาม สนาม/)).not.toBeInTheDocument();

    unmount();

    // Component test with plain court number
    const matchWithoutPrefix: Match = {
      ...baseMatch,
      court: '2',
    };
    render(<MatchResultForm match={matchWithoutPrefix} format={bo3_21} />);
    expect(screen.getByText('สนาม 2')).toBeInTheDocument();
    expect(screen.queryByText(/สนาม สนาม/)).not.toBeInTheDocument();

    // Helper formatCourtName behavior
    expect(formatCourtName('สนาม 1')).toBe('สนาม 1');
    expect(formatCourtName('1')).toBe('สนาม 1');
    expect(formatCourtName('  สนาม 3  ')).toBe('สนาม 3');
    expect(formatCourtName('')).toBe('สนาม -');
    expect(formatCourtName(null)).toBe('สนาม -');

    // UmpireMatchCard display
    const { container } = render(<UmpireMatchCard match={matchWithPrefix} />);
    expect(container).toHaveTextContent('สนาม 1 · น็อคเอาท์ รอบ 1');
    expect(container).not.toHaveTextContent('สนาม สนาม 1');
  });

  it('tie label shows games and total points', () => {
    render(<MatchResultForm match={baseMatch} format={group_2x15} />);

    // Game 1: 15-10
    const inputsA = screen.getAllByTestId('score-a');
    const inputsB = screen.getAllByTestId('score-b');
    fireEvent.change(inputsA[0], { target: { value: '15' } });
    fireEvent.change(inputsB[0], { target: { value: '10' } });

    // Game 2: 12-15
    fireEvent.change(inputsA[1], { target: { value: '12' } });
    fireEvent.change(inputsB[1], { target: { value: '15' } });

    const summary = screen.getByTestId('result-summary');
    expect(summary).toBeInTheDocument();
    expect(summary).toHaveTextContent('เสมอ 1–1 เกม');
    expect(summary).toHaveTextContent('แต้มรวม 27–25');
  });

  it('clears draft after successful report', () => {
    const onReported = vi.fn();
    render(
      <MatchResultForm
        match={baseMatch}
        format={bo3_21}
        onReported={onReported}
      />,
    );

    // Enter scores
    const inputsA = screen.getAllByTestId('score-a');
    const inputsB = screen.getAllByTestId('score-b');
    fireEvent.change(inputsA[0], { target: { value: '21' } });
    fireEvent.change(inputsB[0], { target: { value: '15' } });

    const inputsAG2 = screen.getAllByTestId('score-a');
    const inputsBG2 = screen.getAllByTestId('score-b');
    fireEvent.change(inputsAG2[1], { target: { value: '21' } });
    fireEvent.change(inputsBG2[1], { target: { value: '10' } });

    // Draft is stored in localStorage
    expect(loadResultDraft(baseMatch.id!)).not.toBeNull();

    // Mock successful mutation
    mockMutate.mockImplementation((payload, options) => {
      options?.onSuccess?.({ ...baseMatch, status: 'reported' });
    });

    fireEvent.click(screen.getByTestId('result-submit'));
    fireEvent.click(screen.getByTestId('result-confirm'));

    // Draft is cleared from localStorage
    expect(loadResultDraft(baseMatch.id!)).toBeNull();
    expect(onReported).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'reported' }),
    );
  });

  describe('MatchFormatBadge text', () => {
    it('formats group_2x15 text correctly', () => {
      render(<MatchFormatBadge format={group_2x15} />);
      expect(screen.getByTestId('match-format-badge')).toHaveTextContent(
        '2 เกม × 15 แต้ม ไม่มีดิวส์ เสมอได้',
      );
    });

    it('formats bo3_21 text correctly', () => {
      render(<MatchFormatBadge format={bo3_21} />);
      expect(screen.getByTestId('match-format-badge')).toHaveTextContent(
        '2 ใน 3 เกม × 21 แต้ม ดิวส์ถึง 30',
      );
    });
  });
});
