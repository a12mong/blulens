import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AssessmentTable } from './AssessmentTable';
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
    expect(screen.getByText('S-–S+')).toBeInTheDocument();
    expect(screen.getByText('ยังสรุปไม่ได้')).toBeInTheDocument();

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
});
