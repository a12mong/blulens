import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewCard } from './ReviewCard';
import type { components } from '@/lib/api/schema';

type ReviewAssignment = components['schemas']['ReviewAssignment'];

describe('ReviewCard', () => {
  it('shows the neutral task id, the state badge and a start link only for open tasks', () => {
    const openAssignment: ReviewAssignment = {
      id: 'aaaa-bbbb-a3f2',
      state: 'open',
      dueAt: '2026-10-08T15:30:00Z',
      submittedAt: null,
    };

    render(<ReviewCard assignment={openAssignment} now={new Date('2026-10-07T12:00:00Z')} />);

    // Heading with last 4 chars uppercased
    expect(screen.getByText(/งาน #A3F2/)).toBeInTheDocument();

    // State badge for open
    const stateBadges = screen.getAllByTestId('review-card-state');
    expect(stateBadges[0]).toHaveTextContent('ยังไม่ทำ');

    // Action link for open
    const actionLink = screen.getByTestId('review-card-action');
    expect(actionLink).toHaveTextContent('เริ่ม');
    expect(actionLink).toHaveAttribute('href', '/review/tasks/aaaa-bbbb-a3f2');
  });

  it('expired task shows state badge and no action link', () => {
    const expiredAssignment: ReviewAssignment = {
      id: 'aaaa-bbbb-c3d4',
      state: 'expired',
      dueAt: '2026-10-06T15:30:00Z',
      submittedAt: null,
    };

    render(<ReviewCard assignment={expiredAssignment} />);

    expect(screen.getByTestId('review-card-state')).toHaveTextContent('หมดเวลา');
    expect(screen.queryByTestId('review-card-action')).not.toBeInTheDocument();
  });

  it('submitted shows state badge and view link', () => {
    const submittedAssignment: ReviewAssignment = {
      id: 'aaaa-bbbb-b1c2',
      state: 'submitted',
      dueAt: '2026-10-08T15:30:00Z',
      submittedAt: '2026-10-07T10:00:00Z',
    };

    render(<ReviewCard assignment={submittedAssignment} />);

    // State badge shows 'ส่งแล้ว'
    expect(screen.getByTestId('review-card-state')).toHaveTextContent('ส่งแล้ว');

    // Action link shows 'ดู'
    const actionLink = screen.getByTestId('review-card-action');
    expect(actionLink).toHaveTextContent('ดู');
    expect(actionLink).toHaveAttribute('href', '/review/tasks/aaaa-bbbb-b1c2');
  });

  it('open task due in 2h shows expiring indicator', () => {
    const now = new Date('2026-10-07T12:00:00Z');
    const dueAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours from now

    const assignment: ReviewAssignment = {
      id: 'aaaa-bbbb-e5f6',
      state: 'open',
      dueAt,
      submittedAt: null,
    };

    render(<ReviewCard assignment={assignment} now={now} />);

    // Should have review-card-soon marker
    const card = screen.getByTestId('review-card-soon');
    expect(card).toHaveAttribute('data-state', 'open');
    expect(screen.getByText('ใกล้ครบกำหนด')).toBeInTheDocument();
  });

  it('never contains calibration references', () => {
    const calibrationAssignment: ReviewAssignment = {
      id: 'aaaa-bbbb-f7g8',
      state: 'open',
      dueAt: '2026-10-08T15:30:00Z',
      submittedAt: null,
    };

    const { container } = render(<ReviewCard assignment={calibrationAssignment} />);

    const text = container.textContent || '';
    expect(text).not.toMatch(/calibration/i);
    expect(text).not.toMatch(/ชุดมาตรฐาน/);
  });

  it('never exposes assessment id or player info', () => {
    const assignment: ReviewAssignment = {
      id: 'aaaa-bbbb-g9h0',
      state: 'open',
      dueAt: '2026-10-08T15:30:00Z',
      submittedAt: null,
    };

    const { container } = render(<ReviewCard assignment={assignment} />);

    const text = container.textContent || '';
    expect(text).not.toContain('secret-assessment-id-12345');
    expect(text).not.toContain('assessmentId');
  });
});
