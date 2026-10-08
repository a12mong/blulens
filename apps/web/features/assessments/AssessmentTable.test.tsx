import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AssessmentTable, type Assessment } from './AssessmentTable';
import { AssessmentDecisions } from './AssessmentDecisions';
import type { AssessmentDetail } from './api';
import type { components } from '@/lib/api/schema';

vi.mock('./api', () => ({
  useAssessmentAction: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  })),
}));

type GradeView = components['schemas']['GradeView'];

const mockAssessments: Assessment[] = [
  {
    id: 'assess-1',
    subjectUserId: 'user-1',
    subject: { displayName: 'Alice' },
    status: 'provisional',
    latestGrade: {
      score: 7.5,
      lower: 'S',
      upper: 'S+',
      center: 'S',
      label: 'S-–S+',
      kind: 'straddle',
    },
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

describe('AssessmentTable', () => {
  it('renders status badge, progress and grade label per row and reports the filter change', async () => {
    const onStatusChange = vi.fn();

    render(
      <AssessmentTable
        items={mockAssessments}
        onStatusChange={onStatusChange}
      />
    );

    // Check badge texts
    const statusElements = screen.getAllByTestId('assessment-status');
    expect(statusElements[0]).toHaveTextContent('ชั่วคราว (กรรมการ 1 คน)');
    expect(statusElements[1]).toHaveTextContent('เห็นต่างกันมาก');

    // Check progress
    expect(screen.getByText('1/1')).toBeInTheDocument();
    expect(screen.getByText('3/3')).toBeInTheDocument();

    // Check grade labels
    expect(screen.getAllByText('S-–S+')[0]).toBeInTheDocument();
    expect(screen.getByText('รอผู้ตรวจ 3/3')).toBeInTheDocument();

    // Check links
    const links = screen.getAllByTestId('assessment-open');
    expect(links[0]).toHaveAttribute('href', '/committee/assessments/assess-1');
    expect(links[1]).toHaveAttribute('href', '/committee/assessments/assess-2');

    // Check filter change
    const filter = screen.getByTestId('assessment-filter');
    fireEvent.change(filter, { target: { value: 'needs_reviewers' } });
    expect(onStatusChange).toHaveBeenCalledWith('needs_reviewers');

    // Filter back to all
    fireEvent.change(filter, { target: { value: 'all' } });
    expect(onStatusChange).toHaveBeenCalledWith(undefined);
  });

  it('shows empty text when items is empty', () => {
    render(<AssessmentTable items={[]} emptyText="ไม่มีรายการ" />);
    expect(screen.getByText('ไม่มีรายการ')).toBeInTheDocument();
  });

  it('uses custom emptyText when provided', () => {
    render(
      <AssessmentTable items={[]} emptyText="ยังไม่มีการประเมิน" />
    );
    expect(screen.getByText('ยังไม่มีการประเมิน')).toBeInTheDocument();
  });

  it('renders all 11 status options in filter', () => {
    render(<AssessmentTable items={mockAssessments} />);

    const filter = screen.getByTestId('assessment-filter') as HTMLSelectElement;
    const options = Array.from(filter.options).map((o) => o.textContent);

    const expectedStatuses = [
      'ทั้งหมด',
      'ร่าง',
      'ส่งแล้ว',
      'กำลังรีวิว',
      'ต้องหากรรมการเพิ่ม',
      'ชั่วคราว (กรรมการ 1 คน)',
      'เห็นต่างกันมาก',
      'รออนุมัติ',
      'อนุมัติแล้ว',
      'แก้ไขโดยคณะกรรมการ',
      'ไม่ผ่าน',
      'ถอนคำขอ',
    ];

    expect(options).toEqual(expectedStatuses);
  });

  it('handles subject with no displayName', () => {
    const item: Assessment = {
      id: 'assess-3',
      subjectUserId: 'user-3',
      subject: undefined,
      status: 'draft',
      latestGrade: null,
      reviewsSubmitted: 0,
      reviewsRequired: 2,
      createdAt: '2026-10-07T10:00:00Z',
    };

    render(<AssessmentTable items={[item]} />);
    expect(screen.getByText('ไม่ระบุ')).toBeInTheDocument();
  });

  it('renders row data-testid and data-assessment-id', () => {
    render(<AssessmentTable items={mockAssessments} />);

    const rows = screen.getAllByTestId('assessment-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute('data-assessment-id', 'assess-1');
    expect(rows[1]).toHaveAttribute('data-assessment-id', 'assess-2');
  });

  it('shows the grade for an overridden row and the result summary in the approve dialog', async () => {
    // 1. Overridden row in AssessmentTable shows GradeBand compact + label + range
    const overriddenItem: Assessment = {
      id: 'assess-overridden',
      subjectUserId: 'user-ov',
      subject: { displayName: 'ชานนท์' },
      status: 'overridden',
      latestGrade: {
        score: 7.5,
        lower: 'S',
        upper: 'S+',
        center: 'S',
        label: 'S/S+',
        kind: 'straddle',
      },
      reviewsSubmitted: 2,
      reviewsRequired: 2,
      createdAt: '2026-10-07T12:00:00Z',
    };

    const unfinishedItem: Assessment = {
      id: 'assess-unfinished',
      subjectUserId: 'user-un',
      subject: { displayName: 'กานต์' },
      status: 'in_review',
      latestGrade: null,
      reviewsSubmitted: 1,
      reviewsRequired: 2,
      createdAt: '2026-10-07T13:00:00Z',
    };

    const { unmount } = render(
      <AssessmentTable items={[overriddenItem, unfinishedItem]} />
    );

    const rows = screen.getAllByTestId('assessment-row');
    const ovRow = rows[0];
    expect(ovRow).toHaveTextContent('S/S+');
    expect(ovRow).toHaveTextContent('ช่วง S–S+');
    expect(ovRow).not.toHaveTextContent('ยังสรุปไม่ได้');
    expect(ovRow.querySelector('[role="img"]')).toBeInTheDocument();

    // 2. Unfinished row has no grade numbers and shows 'รอผู้ตรวจ n/m'
    const unRow = rows[1];
    expect(unRow).toHaveTextContent('รอผู้ตรวจ 1/2');
    expect(unRow).not.toHaveTextContent('ยังสรุปไม่ได้');
    const resultCell = unRow.querySelector('[data-testid="assessment-result"]')!;
    expect(resultCell.textContent).toBe('รอผู้ตรวจ 1/2');
    expect(unRow.querySelector('[role="img"]')).not.toBeInTheDocument();

    unmount();

    // 3. Result summary in approve dialog
    const disputedDetail: AssessmentDetail = {
      id: 'asm-disputed',
      subjectUserId: 'user-d',
      status: 'disputed',
      createdAt: '2026-10-07T10:00:00Z',
      subject: { userId: 'user-d', displayName: 'ธนกร', clubNames: [] },
      latestResultVersion: 1,
      latestResult: {
        version: 1,
        source: 'computed',
        status: 'pending_approval',
        grade: {
          score: 4.0,
          margin: 3.75,
          lower: 'RK1',
          upper: 'S',
          center: 'BG2',
          kind: 'wide',
          label: 'RK1–S',
        },
        nRaters: 2,
        nExcluded: 0,
        flags: ['HIGH_DISAGREEMENT'],
        methodVersion: 'grading-v1',
        computedAt: '2026-10-07T12:00:00Z',
      },
      reviewerRows: [],
    };

    render(<AssessmentDecisions detail={disputedDetail} />);
    fireEvent.click(screen.getByTestId('decide-approve'));

    const summary = screen.getByTestId('approve-summary');
    expect(summary).toBeInTheDocument();
    expect(summary).toHaveTextContent('RK1–S · 4.00 ± 3.75 · เห็นต่างกันมาก');
  });

  it('shows รอผล when an unfinished row has no review counts', () => {
    const item: Assessment = {
      id: 'assess-no-counts',
      subjectUserId: 'user-nc',
      status: 'draft',
      latestGrade: null,
      reviewsSubmitted: undefined,
      reviewsRequired: undefined,
      createdAt: '2026-10-07T10:00:00Z',
    };

    render(<AssessmentTable items={[item]} />);
    expect(screen.getByText('รอผล')).toBeInTheDocument();
  });

  it('list row with event null shows "ประเมินทั่วไป"', () => {
    const item: Assessment = {
      id: 'assess-null-event',
      subjectUserId: 'user-ne',
      subject: { displayName: 'ผู้เล่น ทั่วไป' },
      event: null,
      status: 'in_review',
      latestGrade: null,
      reviewsSubmitted: 1,
      reviewsRequired: 2,
      createdAt: '2026-10-07T10:00:00Z',
    };

    render(<AssessmentTable items={[item]} />);
    expect(screen.getByText('ประเมินทั่วไป')).toBeInTheDocument();
  });

  it('subject name shown instead of "ไม่ระบุ" and displays club names when non-empty', () => {
    const item: Assessment = {
      id: 'assess-subject-club',
      subjectUserId: 'user-sc',
      subject: {
        displayName: 'พงษ์ศักดิ์ ชัยชนะ',
        clubNames: ['สโมสร กทม.', 'สโมสร สิงห์'],
      },
      status: 'submitted',
      latestGrade: null,
      reviewsSubmitted: 0,
      reviewsRequired: 2,
      createdAt: '2026-10-07T10:00:00Z',
    };

    render(<AssessmentTable items={[item]} />);
    expect(screen.getByText('พงษ์ศักดิ์ ชัยชนะ')).toBeInTheDocument();
    expect(screen.getByText('สโมสร กทม., สโมสร สิงห์')).toBeInTheDocument();
    expect(screen.queryByText('ไม่ระบุ')).toBeNull();
  });

  it('renders tournament name and discipline in Thai when event is provided', () => {
    const item: Assessment = {
      id: 'assess-with-event',
      subjectUserId: 'user-we',
      subject: { displayName: 'วิภาวี สดใส' },
      event: {
        tournamentName: 'BluLens Masters 2026',
        discipline: 'MD',
      },
      status: 'in_review',
      latestGrade: null,
      reviewsSubmitted: 1,
      reviewsRequired: 2,
      createdAt: '2026-10-07T10:00:00Z',
    };

    render(<AssessmentTable items={[item]} />);
    expect(screen.getByText('BluLens Masters 2026 · ชายคู่')).toBeInTheDocument();
  });
});
