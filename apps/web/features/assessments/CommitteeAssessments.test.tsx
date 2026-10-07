import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommitteeAssessments } from './CommitteeAssessments';
import * as assessmentsApi from './api';
import type { components } from '@/lib/api/schema';

type GradeView = components['schemas']['GradeView'];

interface Assessment {
  id: string;
  subjectUserId: string;
  subject?: { displayName: string } | null;
  status: components['schemas']['AssessmentStatus'];
  latestGrade: GradeView | null;
  reviewsSubmitted: number;
  reviewsRequired: number;
  createdAt: string;
}

vi.mock('./api', () => ({
  useAssessments: vi.fn(),
  assessmentsKey: vi.fn((status) => ['assessments', status ?? 'all']),
}));

vi.mock('./AssessmentTable', () => ({
  AssessmentTable: vi.fn(({ items, status, onStatusChange, emptyText }) => (
    <div data-testid="assessment-table">
      <div data-testid="table-items">{items.length} items</div>
      <div data-testid="table-empty-text">{emptyText}</div>
      <select
        data-testid="assessment-filter"
        value={status ?? 'all'}
        onChange={(e) => {
          const val = e.target.value === 'all' ? undefined : e.target.value;
          onStatusChange?.(val);
        }}
      >
        <option value="all">ทั้งหมด</option>
        <option value="needs_reviewers">ต้องหากรรมการเพิ่ม</option>
      </select>
    </div>
  )),
}));

describe('CommitteeAssessments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads assessments for the chosen status', () => {
    const mockAssessments: Assessment[] = [
      {
        id: 'assess-1',
        subjectUserId: 'user-1',
        subject: { displayName: 'Alice' },
        status: 'provisional',
        latestGrade: { score: 7.5, lower: 'S', upper: 'S+', center: 'S', label: 'S-–S+', kind: 'straddle' },
        reviewsSubmitted: 1,
        reviewsRequired: 1,
        createdAt: '2026-10-07T12:00:00Z',
      },
      {
        id: 'assess-2',
        subjectUserId: 'user-2',
        subject: { displayName: 'Bob' },
        status: 'disputed',
        latestGrade: null,
        reviewsSubmitted: 3,
        reviewsRequired: 3,
        createdAt: '2026-10-07T11:00:00Z',
      },
    ];

    vi.mocked(assessmentsApi.useAssessments).mockReturnValue({
      data: { items: mockAssessments, nextCursor: null },
      isPending: false,
      isError: false,
    } as any);

    render(<CommitteeAssessments />);

    // Initial render: called with undefined
    expect(assessmentsApi.useAssessments).toHaveBeenCalledWith(undefined);
    expect(screen.getByTestId('table-items')).toHaveTextContent('2 items');

    // Change filter
    const filter = screen.getByTestId('assessment-filter');
    fireEvent.change(filter, { target: { value: 'needs_reviewers' } });

    // Should call useAssessments with the new status
    expect(assessmentsApi.useAssessments).toHaveBeenLastCalledWith('needs_reviewers');
  });

  it('shows loading state', () => {
    vi.mocked(assessmentsApi.useAssessments).mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    } as any);

    render(<CommitteeAssessments />);

    expect(screen.getByTestId('assessments-loading')).toHaveTextContent('กำลังโหลด…');
    expect(screen.getByTestId('assessments-loading')).toHaveAttribute('role', 'status');
  });

  it('shows error state with retry button', () => {
    const refetchMock = vi.fn();
    vi.mocked(assessmentsApi.useAssessments).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('FETCH_ERROR'),
      refetch: refetchMock,
    } as any);

    render(<CommitteeAssessments />);

    const alert = screen.getByTestId('assessments-error');
    expect(alert).toHaveAttribute('role', 'alert');

    const retryBtn = screen.getByText('ลองใหม่');
    fireEvent.click(retryBtn);

    expect(refetchMock).toHaveBeenCalled();
  });

  it('shows empty text when no items', () => {
    vi.mocked(assessmentsApi.useAssessments).mockReturnValue({
      data: { items: [], nextCursor: null },
      isPending: false,
      isError: false,
    } as any);

    render(<CommitteeAssessments />);

    expect(screen.getByTestId('table-empty-text')).toHaveTextContent('ยังไม่มีผลประเมิน');
  });
});
