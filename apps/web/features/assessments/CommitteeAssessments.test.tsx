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

vi.mock('./RaterPanel', () => ({
  RaterPanel: () => <div data-testid="rater-panel">RaterPanel</div>,
}));

vi.mock('./StatTile', () => ({
  StatTile: ({ label, count, active, onClick }: any) => (
    <button
      data-testid="stat-tile"
      aria-pressed={active}
      onClick={onClick}
    >
      {label} {count}
    </button>
  ),
}));

describe('CommitteeAssessments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tiles count per status and clicking one filters the table', () => {
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
        status: 'provisional',
        latestGrade: null,
        reviewsSubmitted: 3,
        reviewsRequired: 3,
        createdAt: '2026-10-07T11:00:00Z',
      },
      {
        id: 'assess-3',
        subjectUserId: 'user-3',
        subject: { displayName: 'Charlie' },
        status: 'disputed',
        latestGrade: null,
        reviewsSubmitted: 2,
        reviewsRequired: 2,
        createdAt: '2026-10-07T10:00:00Z',
      },
      {
        id: 'assess-4',
        subjectUserId: 'user-4',
        subject: { displayName: 'Dana' },
        status: 'in_review',
        latestGrade: null,
        reviewsSubmitted: 1,
        reviewsRequired: 2,
        createdAt: '2026-10-07T09:00:00Z',
      },
      {
        id: 'assess-5',
        subjectUserId: 'user-5',
        subject: { displayName: 'Eve' },
        status: 'in_review',
        latestGrade: null,
        reviewsSubmitted: 0,
        reviewsRequired: 2,
        createdAt: '2026-10-07T08:00:00Z',
      },
    ];

    vi.mocked(assessmentsApi.useAssessments).mockReturnValue({
      data: { items: mockAssessments, nextCursor: null },
      isPending: false,
      isError: false,
    } as any);

    render(<CommitteeAssessments />);

    // Hook should be called with undefined to fetch all
    expect(assessmentsApi.useAssessments).toHaveBeenCalledWith(undefined);

    // All items shown initially
    expect(screen.getByTestId('table-items')).toHaveTextContent('5 items');

    // Click the 'ชั่วคราว' (provisional) tile - should show only 2
    const tiles = screen.getAllByTestId('stat-tile');
    const provisionalTile = tiles.find((t) => t.textContent?.includes('ชั่วคราว'));
    fireEvent.click(provisionalTile!);
    expect(screen.getByTestId('table-items')).toHaveTextContent('2 items');

    // Click it again to clear filter
    fireEvent.click(provisionalTile!);
    expect(screen.getByTestId('table-items')).toHaveTextContent('5 items');
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

  it('displays RaterPanel component', () => {
    vi.mocked(assessmentsApi.useAssessments).mockReturnValue({
      data: { items: [], nextCursor: null },
      isPending: false,
      isError: false,
    } as any);

    render(<CommitteeAssessments />);

    expect(screen.getByTestId('rater-panel')).toBeInTheDocument();
  });

  it('displays all stat tiles', () => {
    vi.mocked(assessmentsApi.useAssessments).mockReturnValue({
      data: { items: [], nextCursor: null },
      isPending: false,
      isError: false,
    } as any);

    render(<CommitteeAssessments />);

    expect(screen.getByText(/ต้องหากรรมการเพิ่ม 0/)).toBeInTheDocument();
    expect(screen.getByText(/กำลังรีวิว 0/)).toBeInTheDocument();
    expect(screen.getByText(/ชั่วคราว 0/)).toBeInTheDocument();
    expect(screen.getByText(/เห็นต่างกัน 0/)).toBeInTheDocument();
    expect(screen.getByText(/รออนุมัติ 0/)).toBeInTheDocument();
  });
});
