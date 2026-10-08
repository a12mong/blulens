import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CommitteeHome, COMMITTEE_HUB_ITEMS } from './CommitteeHome';

describe('CommitteeHome', () => {
  it('links every committee area with correct hrefs and descriptions (proving test)', () => {
    render(<CommitteeHome />);

    // 1. Assessments link
    const assessmentsLink = screen.getByTestId('committee-link-assessments');
    expect(assessmentsLink).toBeInTheDocument();
    expect(assessmentsLink).toHaveAttribute('href', '/committee/assessments');
    expect(assessmentsLink).toHaveTextContent('ผลประเมิน');
    expect(assessmentsLink).toHaveTextContent('ดูผล ตัดสิน และมอบหมายผู้ตรวจ');

    // 2. Team requests link
    const teamRequestsLink = screen.getByTestId('committee-link-team-requests');
    expect(teamRequestsLink).toBeInTheDocument();
    expect(teamRequestsLink).toHaveAttribute('href', '/committee/teams/requests');
    expect(teamRequestsLink).toHaveTextContent('คำขอทีม');
    expect(teamRequestsLink).toHaveTextContent('สร้างทีมใหม่ ผูกชื่อเรียกอื่น หรือปฏิเสธ');

    // 3. Events link
    const eventsLink = screen.getByTestId('committee-link-events');
    expect(eventsLink).toBeInTheDocument();
    expect(eventsLink).toHaveAttribute('href', '/events');
    expect(eventsLink).toHaveTextContent('อีเวนต์');
    expect(eventsLink).toHaveTextContent('คิวอนุมัติผู้สมัคร จัดกลุ่ม และผลที่รอยืนยัน อยู่ในแต่ละอีเวนต์');
  });

  it('renders all configured hub items with 44px min-height tap targets', () => {
    render(<CommitteeHome />);

    for (const item of COMMITTEE_HUB_ITEMS) {
      const link = screen.getByTestId(item.testId);
      expect(link).toHaveClass('min-h-[44px]');
    }
  });

  it('renders a responsive grid container (single column on mobile, two columns on desktop)', () => {
    const { container } = render(<CommitteeHome />);
    const grid = container.firstChild as HTMLElement;

    expect(grid).toHaveClass('grid');
    expect(grid).toHaveClass('grid-cols-1');
    expect(grid).toHaveClass('md:grid-cols-2');
  });
});

describe('CommitteeHome calibration flag', () => {
  it('shows the calibration card unless NEXT_PUBLIC_CALIBRATION_UI is 0', () => {
    vi.stubEnv('NEXT_PUBLIC_CALIBRATION_UI', '1');
    const { unmount } = render(<CommitteeHome />);
    expect(screen.getByTestId('committee-link-calibration')).toHaveAttribute('href', '/committee/calibration');
    unmount();
    vi.stubEnv('NEXT_PUBLIC_CALIBRATION_UI', '0');
    render(<CommitteeHome />);
    expect(screen.queryByTestId('committee-link-calibration')).toBeNull();
    vi.unstubAllEnvs();
  });
});
