import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssessmentDecisions } from './AssessmentDecisions';
import { useAssessmentAction, type AssessmentDetail } from './api';

vi.mock('./api', () => ({
  useAssessmentAction: vi.fn(),
}));

describe('AssessmentDecisions', () => {
  const mockMutate = vi.fn();
  const mockReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAssessmentAction as any).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      error: null,
      reset: mockReset,
    });
  });

  const baseDetail: AssessmentDetail = {
    id: 'asm-100',
    subjectUserId: 'user-1',
    status: 'provisional',
    createdAt: '2026-10-07T10:00:00Z',
    subject: {
      userId: 'user-1',
      displayName: 'สมชาย',
      clubNames: [],
    },
    latestResultVersion: 2,
    latestResult: {
      version: 2,
      source: 'computed',
      status: 'pending',
      grade: {
        score: 7.2,
        lower: 'S-',
        upper: 'S',
        center: 'S-',
        kind: 'exact',
        label: 'S-/S',
      },
      nRaters: 1,
      nExcluded: 0,
      flags: ['SINGLE_REVIEWER'],
      methodVersion: 'grading-v1',
      computedAt: '2026-10-07T12:00:00Z',
    },
    reviewerRows: [],
  };

  it('shows only the buttons the status allows and sends the override with a 20-char reason (proving test)', async () => {
    render(<AssessmentDecisions detail={baseDetail} />);

    // Provisional status checks
    expect(screen.getByTestId('decide-confirm')).toBeInTheDocument();
    expect(screen.getByTestId('decide-return')).toBeInTheDocument();
    expect(screen.getByTestId('decide-override')).toBeInTheDocument();
    expect(screen.queryByTestId('decide-approve')).not.toBeInTheDocument();
    expect(
      screen.getByText('ยังไม่ใช้สมัคร/จัดสายจนกว่ายืนยัน'),
    ).toBeInTheDocument();

    // Open override dialog
    fireEvent.click(screen.getByTestId('decide-override'));
    expect(
      screen.getByRole('heading', { name: 'แก้ไขผลการประเมิน (Override)' }),
    ).toBeInTheDocument();

    const submitBtn = screen.getByTestId('override-submit');
    expect(submitBtn).toBeDisabled();

    // Pick a grade: S
    fireEvent.click(screen.getByTestId('gp-key-S'));

    // Sentence text
    expect(screen.getByText(/ผลเดิม S-\/S → ผลใหม่ S/)).toBeInTheDocument();

    const reasonInput = screen.getByTestId('override-reason');

    // 19-char reason -> disabled
    const nineteenChars = '1234567890123456789';
    expect(nineteenChars.length).toBe(19);
    fireEvent.change(reasonInput, { target: { value: nineteenChars } });
    expect(screen.getByText('19/20')).toBeInTheDocument();
    expect(submitBtn).toBeDisabled();

    // 20-char reason -> enabled
    const twentyChars = '12345678901234567890';
    expect(twentyChars.length).toBe(20);
    fireEvent.change(reasonInput, { target: { value: twentyChars } });
    expect(screen.getByText('20/20')).toBeInTheDocument();
    expect(submitBtn).toBeEnabled();

    // Submit override
    fireEvent.click(submitBtn);
    expect(mockMutate).toHaveBeenCalledWith(
      {
        action: 'override',
        body: {
          centerKey: 'S',
          reason: twentyChars,
          resultVersion: 2,
        },
      },
      expect.any(Object),
    );
  });

  it('approved status shows only override', () => {
    const detail: AssessmentDetail = {
      ...baseDetail,
      status: 'approved',
    };
    render(<AssessmentDecisions detail={detail} />);

    expect(screen.queryByTestId('decide-confirm')).not.toBeInTheDocument();
    expect(screen.queryByTestId('decide-approve')).not.toBeInTheDocument();
    expect(screen.queryByTestId('decide-return')).not.toBeInTheDocument();
    expect(screen.getByTestId('decide-override')).toBeInTheDocument();
  });

  it('in_review shows none with the explanatory text', () => {
    const detail: AssessmentDetail = {
      ...baseDetail,
      status: 'in_review',
    };
    render(<AssessmentDecisions detail={detail} />);

    expect(screen.queryByTestId('decide-confirm')).not.toBeInTheDocument();
    expect(screen.queryByTestId('decide-approve')).not.toBeInTheDocument();
    expect(screen.queryByTestId('decide-return')).not.toBeInTheDocument();
    expect(screen.queryByTestId('decide-override')).not.toBeInTheDocument();
    expect(
      screen.getByText('ยังไม่มีการตัดสินใจที่ทำได้ในสถานะนี้'),
    ).toBeInTheDocument();
  });

  it('disputed and pending_approval show approve, return, override (confirm absent) and approve sends note + resultVersion', () => {
    const detail: AssessmentDetail = {
      ...baseDetail,
      status: 'disputed',
    };
    render(<AssessmentDecisions detail={detail} />);

    expect(screen.queryByTestId('decide-confirm')).not.toBeInTheDocument();
    expect(screen.getByTestId('decide-approve')).toBeInTheDocument();
    expect(screen.getByTestId('decide-return')).toBeInTheDocument();
    expect(screen.getByTestId('decide-override')).toBeInTheDocument();

    // Open approve dialog
    fireEvent.click(screen.getByTestId('decide-approve'));
    expect(
      screen.getByRole('heading', { name: 'อนุมัติผลการประเมิน' }),
    ).toBeInTheDocument();

    const noteInput = screen.getByTestId('approve-note');
    fireEvent.change(noteInput, { target: { value: 'ผ่านการพิจารณาพิเศษ' } });

    fireEvent.click(screen.getByTestId('approve-submit'));
    expect(mockMutate).toHaveBeenCalledWith(
      {
        action: 'approve',
        body: {
          note: 'ผ่านการพิจารณาพิเศษ',
          resultVersion: 2,
        },
      },
      expect.any(Object),
    );
  });

  it('a disputed result needs a note of at least 5 characters before approve; pending_approval does not', () => {
    const { unmount } = render(<AssessmentDecisions detail={{ ...baseDetail, status: 'disputed' }} />);
    fireEvent.click(screen.getByTestId('decide-approve'));
    expect(screen.getByTestId('approve-submit')).toBeDisabled();
    fireEvent.change(screen.getByTestId('approve-note'), { target: { value: 'abcd' } });
    expect(screen.getByTestId('approve-submit')).toBeDisabled();
    fireEvent.change(screen.getByTestId('approve-note'), { target: { value: 'abcde' } });
    expect(screen.getByTestId('approve-submit')).not.toBeDisabled();
    unmount();

    render(<AssessmentDecisions detail={{ ...baseDetail, status: 'pending_approval' }} />);
    fireEvent.click(screen.getByTestId('decide-approve'));
    expect(screen.getByTestId('approve-submit')).not.toBeDisabled();
  });

  it('confirm action opens dialog and submits confirm mutation', () => {
    render(<AssessmentDecisions detail={baseDetail} />);

    fireEvent.click(screen.getByTestId('decide-confirm'));
    expect(
      screen.getByRole('heading', {
        name: 'ยืนยันผลที่ประเมินโดยกรรมการ 1 คน?',
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('confirm-submit'));
    expect(mockMutate).toHaveBeenCalledWith(
      { action: 'confirm', body: { resultVersion: 2 } },
      expect.any(Object),
    );
  });

  it('return action opens ReasonDialog and validates reason length', () => {
    render(<AssessmentDecisions detail={baseDetail} />);

    fireEvent.click(screen.getByTestId('decide-return'));
    // ReasonDialog heading / title
    expect(screen.getByText('ส่งกลับให้รีวิวเพิ่ม')).toBeInTheDocument();

    const textarea = screen.getByRole('textbox');
    // Less than 5 characters: submit button should be disabled
    fireEvent.change(textarea, { target: { value: '1234' } });
    const submitBtn = screen.getByTestId('reason-submit');
    expect(submitBtn).toBeDisabled();

    // >= 5 characters
    fireEvent.change(textarea, { target: { value: 'ขอให้ตรวจคลิปเพิ่ม' } });
    expect(submitBtn).toBeEnabled();

    fireEvent.click(submitBtn);
    expect(mockMutate).toHaveBeenCalledWith(
      {
        action: 'return',
        body: { reason: 'ขอให้ตรวจคลิปเพิ่ม' },
      },
      expect.any(Object),
    );
  });

  it('shows mutation error inside dialog', () => {
    (useAssessmentAction as any).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      error: new Error('SERVER_ERROR'),
      reset: mockReset,
    });

    render(<AssessmentDecisions detail={baseDetail} />);

    // Open confirm dialog
    fireEvent.click(screen.getByTestId('decide-confirm'));
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
