import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import {
  MatchCard,
  type EntryRef,
  type MatchCardData,
} from './MatchCard';

describe('MatchCard', () => {
  const topEntry: EntryRef = {
    entryId: 'entry-1',
    displayName: 'สมชาย / วิภา',
    teamNames: ['สิงห์เหนือ', 'เชียงใหม่'],
    gradeLabel: 'PROVISIONAL_GRADE_TOP',
  };

  const bottomEntry: EntryRef = {
    entryId: 'entry-2',
    displayName: 'อนันต์ / มาลี',
    teamNames: ['ลำพูนแบด'],
    gradeLabel: 'PROVISIONAL_GRADE_BOTTOM',
  };

  it('reported match is dashed, shows รอยืนยัน and no winner; confirmed shows ชนะ on the winner row only', () => {
    const reportedMatch: MatchCardData = {
      matchNo: 3,
      top: topEntry,
      bottom: bottomEntry,
      winnerId: 'entry-1',
      status: 'reported',
      games: [
        { a: 21, b: 18 },
        { a: 21, b: 19 },
      ],
    };

    const { rerender } = render(<MatchCard match={reportedMatch} />);

    const card = screen.getByTestId('match-card');
    expect(card).toHaveAttribute('data-status', 'reported');
    expect(card).toHaveClass('border-dashed');

    const statusBadge = screen.getByTestId('match-status');
    expect(statusBadge).toHaveTextContent('รอยืนยัน');
    expect(statusBadge).toHaveAttribute('title', 'ยังไม่นับในตารางคะแนน');

    const topRow = screen.getByTestId('match-top');
    const bottomRow = screen.getByTestId('match-bottom');
    expect(topRow).not.toHaveAttribute('data-winner');
    expect(bottomRow).not.toHaveAttribute('data-winner');
    expect(topRow).not.toHaveTextContent('ชนะ');

    // Confirmed state
    const confirmedMatch: MatchCardData = {
      ...reportedMatch,
      status: 'confirmed',
    };

    rerender(<MatchCard match={confirmedMatch} />);

    expect(screen.queryByTestId('match-status')).toBeNull();
    expect(screen.getByTestId('match-card')).toHaveClass('border-solid');
    expect(screen.getByTestId('match-top')).toHaveAttribute('data-winner', 'true');
    expect(screen.getByTestId('match-top')).toHaveTextContent('ชนะ');
    expect(screen.getByTestId('match-bottom')).not.toHaveAttribute('data-winner');
    expect(screen.getByTestId('match-bottom')).not.toHaveTextContent('ชนะ');
  });

  it('bye shows BYE and null bottom รอผล', () => {
    const byeMatch: MatchCardData = {
      matchNo: 1,
      top: topEntry,
      bottom: null,
      winnerId: 'entry-1',
      status: 'bye',
    };

    render(<MatchCard match={byeMatch} />);

    const statusBadge = screen.getByTestId('match-status');
    expect(statusBadge).toHaveTextContent('BYE');

    const bottomRow = screen.getByTestId('match-bottom');
    expect(bottomRow).toHaveTextContent('รอผล');
  });

  it('withdrawn entry has ถอนตัว and line-through styling', () => {
    const matchWithWithdrawn: MatchCardData = {
      matchNo: 4,
      top: topEntry,
      bottom: bottomEntry,
      winnerId: 'entry-2',
      status: 'walkover',
      withdrawnIds: ['entry-1'],
    };

    render(<MatchCard match={matchWithWithdrawn} />);

    const topRow = screen.getByTestId('match-top');
    expect(topRow).toHaveTextContent('ถอนตัว');
    const nameEl = screen.getByText('สมชาย / วิภา');
    expect(nameEl).toHaveClass('line-through');

    const bottomRow = screen.getByTestId('match-bottom');
    expect(bottomRow).not.toHaveTextContent('ถอนตัว');
  });

  it('never renders gradeLabel in the card', () => {
    const match: MatchCardData = {
      matchNo: 5,
      top: topEntry,
      bottom: bottomEntry,
      winnerId: null,
      status: 'scheduled',
    };

    render(<MatchCard match={match} />);

    expect(screen.queryByText(/PROVISIONAL_GRADE/)).toBeNull();
    expect(screen.queryByText('PROVISIONAL_GRADE_TOP')).toBeNull();
    expect(screen.queryByText('PROVISIONAL_GRADE_BOTTOM')).toBeNull();
  });

  it('scheduled match shows รอแข่ง and renders club names', () => {
    const match: MatchCardData = {
      matchNo: 7,
      top: topEntry,
      bottom: bottomEntry,
      winnerId: null,
      status: 'scheduled',
    };

    render(<MatchCard match={match} />);

    expect(screen.getByTestId('match-status')).toHaveTextContent('รอแข่ง');
    expect(screen.getByText('สิงห์เหนือ, เชียงใหม่')).toBeInTheDocument();
    expect(screen.getByText('ลำพูนแบด')).toBeInTheDocument();
    expect(screen.getByText('#7')).toHaveClass('font-pixel');
  });

  it('walkover match shows ไม่มาแข่ง and marks winner', () => {
    const match: MatchCardData = {
      matchNo: 2,
      top: topEntry,
      bottom: bottomEntry,
      winnerId: 'entry-1',
      status: 'walkover',
      withdrawnIds: ['entry-2'],
    };

    render(<MatchCard match={match} />);

    expect(screen.getByTestId('match-status')).toHaveTextContent('ไม่มาแข่ง');
    expect(screen.getByTestId('match-top')).toHaveAttribute('data-winner', 'true');
    expect(screen.getByTestId('match-top')).toHaveTextContent('ชนะ');
  });

  it('highlights matching row when highlightEntryId is provided', () => {
    const match: MatchCardData = {
      matchNo: 6,
      top: topEntry,
      bottom: bottomEntry,
      winnerId: null,
      status: 'scheduled',
    };

    render(<MatchCard match={match} highlightEntryId="entry-2" />);

    expect(screen.getByTestId('match-top')).not.toHaveAttribute('data-highlight');
    expect(screen.getByTestId('match-bottom')).toHaveAttribute('data-highlight', 'true');
  });

  it('renders per-game scores in font-pixel correctly', () => {
    const match: MatchCardData = {
      matchNo: 8,
      top: topEntry,
      bottom: bottomEntry,
      winnerId: 'entry-1',
      status: 'confirmed',
      games: [
        { a: 21, b: 15 },
        { a: 19, b: 21 },
        { a: 22, b: 20 },
      ],
    };

    render(<MatchCard match={match} />);

    const topRow = screen.getByTestId('match-top');
    const bottomRow = screen.getByTestId('match-bottom');

    expect(topRow).toHaveTextContent('21');
    expect(topRow).toHaveTextContent('19');
    expect(topRow).toHaveTextContent('22');

    expect(bottomRow).toHaveTextContent('15');
    expect(bottomRow).toHaveTextContent('21');
    expect(bottomRow).toHaveTextContent('20');
  });

  it('renders third-place badge when isThirdPlace is true', () => {
    const match: MatchCardData = {
      matchNo: 9,
      top: topEntry,
      bottom: bottomEntry,
      winnerId: null,
      status: 'scheduled',
      isThirdPlace: true,
    };

    render(<MatchCard match={match} />);
    const badge = screen.getByTestId('match-third-place');
    expect(badge).toHaveTextContent('ชิงที่ 3');
  });

  it('renders match score summary when games are present, and omits when not present', () => {
    const matchWithGames: MatchCardData = {
      matchNo: 10,
      top: topEntry,
      bottom: bottomEntry,
      winnerId: 'entry-1',
      status: 'confirmed',
      games: [
        { a: 15, b: 11 },
        { a: 15, b: 9 },
      ],
    };

    const { rerender } = render(<MatchCard match={matchWithGames} />);
    const summary = screen.getByTestId('match-score-summary');
    expect(summary).toHaveTextContent('15–11, 15–9');

    const scheduledWithoutGames: MatchCardData = {
      matchNo: 11,
      top: topEntry,
      bottom: bottomEntry,
      winnerId: null,
      status: 'scheduled',
    };
    rerender(<MatchCard match={scheduledWithoutGames} />);
    expect(screen.queryByTestId('match-score-summary')).toBeNull();
  });

  it('renders placeholders when entries are null and placeholders are provided', () => {
    const match: MatchCardData = {
      matchNo: 12,
      top: null,
      bottom: null,
      topPlaceholder: 'แชมป์กลุ่ม A',
      bottomPlaceholder: 'รองแชมป์กลุ่ม B',
      winnerId: null,
      status: 'scheduled',
      court: 'Court 1',
    };

    render(<MatchCard match={match} />);
    expect(screen.getByText('แชมป์กลุ่ม A')).toBeInTheDocument();
    expect(screen.getByText('รองแชมป์กลุ่ม B')).toBeInTheDocument();
    expect(screen.getByText('Court 1')).toBeInTheDocument();
  });
});
