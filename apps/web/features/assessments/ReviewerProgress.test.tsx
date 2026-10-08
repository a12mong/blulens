import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import {
  ReviewerProgress,
  formatEventLabel,
  DISCIPLINE_TH,
  type AssignmentProgressRow,
} from './ReviewerProgress';

describe('ReviewerProgress', () => {
  it('lists each assigned reviewer with a text status and the submitted count', () => {
    const assignments: AssignmentProgressRow[] = [
      {
        id: 'asg-1',
        reviewerId: 'rev-1',
        reviewerName: 'กรรมการ สมบูรณ์',
        state: 'submitted',
        dueAt: '2026-10-15T12:00:00Z',
        submittedAt: '2026-10-08T09:30:00Z',
      },
      {
        id: 'asg-2',
        reviewerId: 'rev-2',
        reviewerName: 'กรรมการ วารี',
        state: 'open',
        dueAt: '2026-10-15T12:00:00Z',
      },
      {
        id: 'asg-3',
        reviewerId: 'rev-3',
        reviewerName: 'กรรมการ กิตติ',
        state: 'expired',
        dueAt: '2026-10-07T12:00:00Z',
      },
    ];

    render(<ReviewerProgress assignments={assignments} />);

    // 3 progress rows
    const rows = screen.getAllByTestId('progress-row');
    expect(rows).toHaveLength(3);

    // Header has 'ส่งแล้ว 1/3'
    expect(screen.getByText('ส่งแล้ว 1/3')).toBeInTheDocument();

    // Each state text present
    expect(screen.getByText('ส่งแล้ว')).toBeInTheDocument();
    expect(screen.getByText('รอส่ง')).toBeInTheDocument();
    expect(screen.getByText('หมดเวลา')).toBeInTheDocument();

    // Reviewer names present
    expect(screen.getByText('กรรมการ สมบูรณ์')).toBeInTheDocument();
    expect(screen.getByText('กรรมการ วารี')).toBeInTheDocument();
    expect(screen.getByText('กรรมการ กิตติ')).toBeInTheDocument();
  });

  it('renders declined state correctly', () => {
    const assignments: AssignmentProgressRow[] = [
      {
        id: 'asg-4',
        reviewerId: 'rev-4',
        reviewerName: 'กรรมการ ปฏิเสธ',
        state: 'declined',
        dueAt: '2026-10-15T12:00:00Z',
      },
    ];

    render(<ReviewerProgress assignments={assignments} />);

    expect(screen.getByText('ปฏิเสธ')).toBeInTheDocument();
    expect(screen.getByText('ส่งแล้ว 0/1')).toBeInTheDocument();
  });

  it('renders nothing when assignments is empty or undefined', () => {
    const { container: emptyContainer } = render(
      <ReviewerProgress assignments={[]} />
    );
    expect(emptyContainer.firstChild).toBeNull();

    const { container: undefinedContainer } = render(
      <ReviewerProgress assignments={undefined} />
    );
    expect(undefinedContainer.firstChild).toBeNull();

    const { container: nullContainer } = render(
      <ReviewerProgress assignments={null} />
    );
    expect(nullContainer.firstChild).toBeNull();
  });

  describe('formatEventLabel', () => {
    it('returns "ประเมินทั่วไป" when event is null or undefined', () => {
      expect(formatEventLabel(null)).toBe('ประเมินทั่วไป');
      expect(formatEventLabel(undefined)).toBe('ประเมินทั่วไป');
    });

    it('formats event with tournament name and discipline in Thai', () => {
      expect(
        formatEventLabel({
          tournamentName: 'BluLens Open 2026',
          discipline: 'MD',
        })
      ).toBe('BluLens Open 2026 · ชายคู่');

      expect(
        formatEventLabel({
          tournamentName: 'เยาวชนแห่งชาติ',
          discipline: 'WS',
        })
      ).toBe('เยาวชนแห่งชาติ · หญิงเดี่ยว');
    });

    it('maps all 5 disciplines to correct Thai labels', () => {
      expect(DISCIPLINE_TH.MS).toBe('ชายเดี่ยว');
      expect(DISCIPLINE_TH.WS).toBe('หญิงเดี่ยว');
      expect(DISCIPLINE_TH.MD).toBe('ชายคู่');
      expect(DISCIPLINE_TH.WD).toBe('หญิงคู่');
      expect(DISCIPLINE_TH.XD).toBe('คู่ผสม');
    });
  });
});
