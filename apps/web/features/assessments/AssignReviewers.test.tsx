import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '@/lib/api/client';
import { useReviewerSearch, type UserPickerItem } from '../users/api';
import { AssignReviewers } from './AssignReviewers';
import { useAssignReviewers, type AssessmentDetail } from './api';

vi.mock('../users/api', () => ({
  useReviewerSearch: vi.fn(),
}));

vi.mock('./api', () => ({
  useAssignReviewers: vi.fn(),
}));

describe('AssignReviewers', () => {
  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    (useAssignReviewers as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const baseDetail: AssessmentDetail = {
    id: 'asm-1',
    subjectUserId: 'user-1',
    status: 'in_review',
    createdAt: '2026-10-07T10:00:00Z',
    reviewerRows: [
      {
        reviewerId: 'r1',
        reviewerName: 'กรรมการ 1',
      },
    ],
  };

  const mockReviewers: UserPickerItem[] = [
    {
      id: 'r1',
      displayName: 'กรรมการ 1',
    },
    {
      id: 'r2',
      displayName: 'กรรมการ 2',
      teamNames: ['สโมสร ก'],
      gradeLabel: 'S',
    },
    {
      id: 'r3',
      displayName: 'กรรมการ 3',
      teamNames: ['สโมสร ข'],
    },
  ];

  it('searches reviewers, excludes those already assigned, assigns the picked ones and shows a conflict per reviewer (proving test)', async () => {
    (useReviewerSearch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (q: string) => {
        if (!q || q.length < 1) return { data: [], isLoading: false };
        return { data: mockReviewers, isLoading: false };
      },
    );

    render(<AssignReviewers detail={baseDetail} />);

    // 1. Open dialog
    fireEvent.click(screen.getByTestId('assign-open'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // 2. Search reviewers
    const searchInput = screen.getByTestId('assign-search');
    fireEvent.change(searchInput, { target: { value: 'กรรม' } });

    // Advance 250ms debounce
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    // 3. r1 is excluded from options because it is in detail.reviewerRows!
    const options = screen.getAllByTestId('assign-option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('กรรมการ 2');
    expect(options[0]).toHaveTextContent('สโมสร ก');
    expect(options[0]).toHaveTextContent('เกรด S');
    expect(options[1]).toHaveTextContent('กรรมการ 3');
    expect(options[1]).toHaveTextContent('สโมสร ข');

    // 4. Pick r2 and r3
    fireEvent.click(options[0]); // picks r2
    // Search input clears, type again to pick r3
    fireEvent.change(searchInput, { target: { value: 'กรรม' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    const optionsAfterR2 = screen.getAllByTestId('assign-option');
    expect(optionsAfterR2).toHaveLength(1);
    expect(optionsAfterR2[0]).toHaveTextContent('กรรมการ 3');
    fireEvent.click(optionsAfterR2[0]); // picks r3

    // Verify 2 picked chips
    const pickedChips = screen.getAllByTestId('assign-picked');
    expect(pickedChips).toHaveLength(2);
    expect(pickedChips[0]).toHaveTextContent('กรรมการ 2');
    expect(pickedChips[1]).toHaveTextContent('กรรมการ 3');

    // 5. Submit
    const submitBtn = screen.getByTestId('assign-submit');
    expect(submitBtn).toBeEnabled();
    fireEvent.click(submitBtn);

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith(
      {
        reviewerIds: ['r2', 'r3'],
        dueAt: undefined,
      },
      expect.any(Object),
    );

    // 6. Simulate mutation error REVIEWER_CONFLICT_OF_INTEREST for r3
    const mutateOptions = mockMutate.mock.calls[0][1];
    act(() => {
      mutateOptions.onError(
        new ApiRequestError(409, 'REVIEWER_CONFLICT_OF_INTEREST', 'Conflict', {
          reviewerId: 'r3',
        }),
      );
    });

    // Verify dialog stays open and conflict text appears on r3 chip
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const conflictChip = screen.getByTestId('assign-conflict');
    expect(conflictChip).toHaveTextContent('ผู้ประเมินสังกัดทีมเดียวกับผู้ถูกประเมิน');
  });

  it('renders nothing for inactive statuses (approved, provisional, disputed, pending_approval)', () => {
    const inactiveStatuses = [
      'approved',
      'provisional',
      'disputed',
      'pending_approval',
    ] as const;

    for (const status of inactiveStatuses) {
      const { unmount } = render(
        <AssignReviewers detail={{ ...baseDetail, status: status as any }} />,
      );
      expect(screen.queryByTestId('assign-open')).not.toBeInTheDocument();
      unmount();
    }
  });

  it('renders assign-open for active statuses (submitted, in_review, needs_reviewers)', () => {
    const activeStatuses = ['submitted', 'in_review', 'needs_reviewers'] as const;

    for (const status of activeStatuses) {
      const { unmount } = render(
        <AssignReviewers detail={{ ...baseDetail, status: status as any }} />,
      );
      expect(screen.getByTestId('assign-open')).toBeInTheDocument();
      unmount();
    }
  });

  it('submit is disabled until at least one reviewer is picked', () => {
    (useReviewerSearch as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(<AssignReviewers detail={baseDetail} />);

    fireEvent.click(screen.getByTestId('assign-open'));

    const submitBtn = screen.getByTestId('assign-submit');
    expect(submitBtn).toBeDisabled();
  });

  it('sends due date as ISO string when provided', async () => {
    (useReviewerSearch as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [mockReviewers[1]],
      isLoading: false,
    });

    render(<AssignReviewers detail={baseDetail} />);

    fireEvent.click(screen.getByTestId('assign-open'));

    // Search and pick
    const searchInput = screen.getByTestId('assign-search');
    fireEvent.change(searchInput, { target: { value: 'กรรม' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    fireEvent.click(screen.getByTestId('assign-option'));

    // Set due date
    const dueInput = screen.getByTestId('assign-due');
    fireEvent.change(dueInput, { target: { value: '2026-10-15T14:30' } });

    // Submit
    fireEvent.click(screen.getByTestId('assign-submit'));

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const sentDueAt = mockMutate.mock.calls[0][0].dueAt;
    expect(sentDueAt).toBe(new Date('2026-10-15T14:30').toISOString());
  });

  it('allows removing a picked reviewer', async () => {
    (useReviewerSearch as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [mockReviewers[1]],
      isLoading: false,
    });

    render(<AssignReviewers detail={baseDetail} />);

    fireEvent.click(screen.getByTestId('assign-open'));

    const searchInput = screen.getByTestId('assign-search');
    fireEvent.change(searchInput, { target: { value: 'กรรม' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    fireEvent.click(screen.getByTestId('assign-option'));
    expect(screen.getByTestId('assign-picked')).toBeInTheDocument();

    // Click remove
    fireEvent.click(screen.getByTestId('assign-remove'));
    expect(screen.queryByTestId('assign-picked')).not.toBeInTheDocument();
    expect(screen.getByTestId('assign-submit')).toBeDisabled();
  });

  it('displays general error in role="alert" when other error occurs', async () => {
    (useReviewerSearch as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [mockReviewers[1]],
      isLoading: false,
    });

    render(<AssignReviewers detail={baseDetail} />);

    fireEvent.click(screen.getByTestId('assign-open'));

    const searchInput = screen.getByTestId('assign-search');
    fireEvent.change(searchInput, { target: { value: 'กรรม' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    fireEvent.click(screen.getByTestId('assign-option'));
    fireEvent.click(screen.getByTestId('assign-submit'));

    const mutateOptions = mockMutate.mock.calls[0][1];
    act(() => {
      mutateOptions.onError(
        new ApiRequestError(
          400,
          'ASSESSMENT_NOT_ASSIGNABLE',
          'Cannot assign',
        ),
      );
    });

    const alert = screen.getByTestId('assign-error');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent('สถานะนี้มอบหมายผู้ประเมินเพิ่มไม่ได้');
  });
});
