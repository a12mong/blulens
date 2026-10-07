import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReviewQueue } from './ReviewQueue';
import * as api from './api';
import type { components } from '@/lib/api/schema';

type ReviewAssignment = components['schemas']['ReviewAssignment'];

// Mock the api module
vi.mock('./api', () => ({
  useMyAssignments: vi.fn(),
}));

// Mock ReviewCard to avoid rendering the actual component
vi.mock('./ReviewCard', () => ({
  ReviewCard: ({ assignment }: { assignment: ReviewAssignment }) => (
    <div data-testid="review-card" data-id={assignment.id}>
      Card {assignment.id}
    </div>
  ),
}));

describe('ReviewQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows counts, defaults to the open tab and switches', () => {
    const assignments: ReviewAssignment[] = [
      {
        id: 'open-1',
        assessmentId: 'a1',
        state: 'open',
        kind: 'assessment',
        dueAt: '2026-10-10T12:00:00Z',
        submittedAt: null,
      },
      {
        id: 'open-2',
        assessmentId: 'a2',
        state: 'open',
        kind: 'assessment',
        dueAt: '2026-10-11T12:00:00Z',
        submittedAt: null,
      },
      {
        id: 'submitted-1',
        assessmentId: 'a3',
        state: 'submitted',
        kind: 'assessment',
        dueAt: '2026-10-09T12:00:00Z',
        submittedAt: '2026-10-07T10:00:00Z',
      },
      {
        id: 'expired-1',
        assessmentId: 'a4',
        state: 'expired',
        kind: 'assessment',
        dueAt: '2026-10-08T12:00:00Z',
        submittedAt: null,
      },
    ];

    vi.mocked(api.useMyAssignments).mockReturnValue({
      data: assignments,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<ReviewQueue />);

    // Check tab labels with counts
    expect(screen.getByTestId('review-tab-open')).toHaveTextContent('ยังไม่ทำ 2');
    expect(screen.getByTestId('review-tab-submitted')).toHaveTextContent('ส่งแล้ว 1');
    expect(screen.getByTestId('review-tab-expired')).toHaveTextContent('หมดเวลา 1');

    // Default to open tab
    expect(screen.getByTestId('review-tab-open')).toHaveAttribute('aria-selected', 'true');

    // Open tab shows 2 cards
    expect(screen.getAllByTestId('review-card')).toHaveLength(2);

    // Progress shows 1/4 (1 submitted out of 4 total)
    expect(screen.getByTestId('review-progress')).toHaveTextContent('เสร็จ 1/4');

    // Click submitted tab
    fireEvent.click(screen.getByTestId('review-tab-submitted'));

    // Submitted tab is selected
    expect(screen.getByTestId('review-tab-submitted')).toHaveAttribute('aria-selected', 'true');

    // Only 1 card shown
    expect(screen.getAllByTestId('review-card')).toHaveLength(1);
    expect(screen.getByTestId('review-card')).toHaveAttribute('data-id', 'submitted-1');
  });

  it('error state shows retry button', () => {
    const testError = new Error('Network error');
    vi.mocked(api.useMyAssignments).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: testError,
      refetch: vi.fn(),
    } as any);

    render(<ReviewQueue />);

    expect(screen.getByTestId('review-error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ลองใหม่' })).toBeInTheDocument();

    const refetchMock = vi.mocked(api.useMyAssignments).mock.results[0].value.refetch;
    fireEvent.click(screen.getByRole('button', { name: 'ลองใหม่' }));
    expect(refetchMock).toHaveBeenCalled();
  });

  it('loading state shows skeleton cards', () => {
    vi.mocked(api.useMyAssignments).mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<ReviewQueue />);

    expect(screen.getAllByTestId('review-skeleton')).toHaveLength(3);
  });

  it('empty assignments show message', () => {
    vi.mocked(api.useMyAssignments).mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<ReviewQueue />);

    expect(screen.getByText('ยังไม่มีงานที่มอบหมายให้คุณ')).toBeInTheDocument();
  });

  it('empty tab shows message', () => {
    const assignments: ReviewAssignment[] = [
      {
        id: 'open-1',
        assessmentId: 'a1',
        state: 'open',
        kind: 'assessment',
        dueAt: '2026-10-10T12:00:00Z',
        submittedAt: null,
      },
    ];

    vi.mocked(api.useMyAssignments).mockReturnValue({
      data: assignments,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<ReviewQueue />);

    // Click submitted tab (which has no assignments)
    fireEvent.click(screen.getByTestId('review-tab-submitted'));

    expect(screen.getByText('ไม่มีงานในหมวดนี้')).toBeInTheDocument();
  });

  it('cards sorted by dueAt ascending', () => {
    const assignments: ReviewAssignment[] = [
      {
        id: 'later',
        assessmentId: 'a1',
        state: 'open',
        kind: 'assessment',
        dueAt: '2026-10-12T12:00:00Z',
        submittedAt: null,
      },
      {
        id: 'sooner',
        assessmentId: 'a2',
        state: 'open',
        kind: 'assessment',
        dueAt: '2026-10-10T12:00:00Z',
        submittedAt: null,
      },
    ];

    vi.mocked(api.useMyAssignments).mockReturnValue({
      data: assignments,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<ReviewQueue />);

    const cards = screen.getAllByTestId('review-card');
    expect(cards[0]).toHaveAttribute('data-id', 'sooner');
    expect(cards[1]).toHaveAttribute('data-id', 'later');
  });
});
