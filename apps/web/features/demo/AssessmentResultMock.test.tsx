import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { AssessmentResultMock } from './AssessmentResultMock';

describe('AssessmentResultMock', () => {
  it('renders the approved result with 3 reviewers, one outlier and 4 how-to steps', () => {
    render(<AssessmentResultMock />);

    // Root page container
    expect(screen.getByTestId('demo-result-page')).toBeInTheDocument();

    // demo-status has text 'อนุมัติแล้ว'
    const statusChip = screen.getByTestId('demo-status');
    expect(statusChip).toHaveTextContent('อนุมัติแล้ว');

    // Exactly 3 demo-reviewer-row
    const reviewerRows = screen.getAllByTestId('demo-reviewer-row');
    expect(reviewerRows).toHaveLength(3);

    // Exactly 1 demo-outlier-badge
    const outlierBadges = screen.getAllByTestId('demo-outlier-badge');
    expect(outlierBadges).toHaveLength(1);
    expect(outlierBadges[0]).toHaveTextContent('ตัดออก (outlier)');

    // Exactly 4 demo-howto-step
    const howtoSteps = screen.getAllByTestId('demo-howto-step');
    expect(howtoSteps).toHaveLength(4);

    // demo-kappa contains '0.68'
    const kappaEl = screen.getByTestId('demo-kappa');
    expect(kappaEl).toHaveTextContent('0.68');

    // Grade label is S-/S
    expect(screen.getByTestId('demo-grade-label')).toHaveTextContent('S-/S');
    expect(screen.getByTestId('demo-score')).toHaveTextContent('7.42');
  });

  it('switches between approved, provisional, and disputed states via status switcher', () => {
    render(<AssessmentResultMock />);

    // Initially approved
    expect(screen.getByTestId('demo-status')).toHaveTextContent('อนุมัติแล้ว');
    expect(screen.getByTestId('demo-grade-label')).toHaveTextContent('S-/S');
    expect(screen.getAllByTestId('demo-reviewer-row')).toHaveLength(3);

    // Switch to provisional
    const provisionalBtn = screen.getByTestId('demo-status-switch-provisional');
    fireEvent.click(provisionalBtn);

    expect(screen.getByTestId('demo-status')).toHaveTextContent('ชั่วคราว');
    expect(screen.getByTestId('demo-grade-label')).toHaveTextContent('S-–S+');
    expect(screen.getByTestId('demo-score')).toHaveTextContent('7.50');
    expect(screen.getAllByTestId('demo-reviewer-row')).toHaveLength(1);
    expect(screen.getByTestId('demo-kappa')).toHaveTextContent('—');
    expect(
      screen.getByText(/ผลชั่วคราวจากกรรมการ 1 คน/),
    ).toBeInTheDocument();

    // Switch to disputed
    const disputedBtn = screen.getByTestId('demo-status-switch-disputed');
    fireEvent.click(disputedBtn);

    expect(screen.getByTestId('demo-status')).toHaveTextContent('เห็นต่างกันมาก');
    expect(screen.getByTestId('demo-grade-label')).toHaveTextContent('S-–N-');
    expect(screen.getByTestId('demo-score')).toHaveTextContent('7.75');
    expect(screen.getAllByTestId('demo-reviewer-row')).toHaveLength(2);
    expect(screen.getByTestId('demo-kappa')).toHaveTextContent('0.38');
    expect(
      screen.getByText(/กรรมการเห็นต่างกันมาก/),
    ).toBeInTheDocument();

    // Switch back to approved
    const approvedBtn = screen.getByTestId('demo-status-switch-approved');
    fireEvent.click(approvedBtn);

    expect(screen.getByTestId('demo-status')).toHaveTextContent('อนุมัติแล้ว');
    expect(screen.getByTestId('demo-grade-label')).toHaveTextContent('S-/S');
    expect(screen.getAllByTestId('demo-reviewer-row')).toHaveLength(3);
  });

  it('renders outlier reviewer with struck-through score and explanation note', () => {
    render(<AssessmentResultMock />);

    const outlierBadge = screen.getByTestId('demo-outlier-badge');
    const outlierRow = outlierBadge.closest('[data-testid="demo-reviewer-row"]');
    expect(outlierRow).not.toBeNull();

    if (outlierRow) {
      expect(outlierRow).toHaveTextContent('กรรมการ C');
      expect(outlierRow).toHaveTextContent('9.83');
      expect(outlierRow).toHaveTextContent(
        'ห่างจากกรรมการส่วนใหญ่ 2.33 ขั้น',
      );
    }
  });

  it('toggles collapsible criteria table and formula accordion', () => {
    render(<AssessmentResultMock />);

    // Criteria table toggle
    const toggleCriteriaBtn = screen.getByText('▸ ดูคะแนนรายหัวข้อ');
    fireEvent.click(toggleCriteriaBtn);
    expect(screen.getByText('▲ ซ่อนตารางหัวข้อ')).toBeInTheDocument();
    expect(screen.getByText('ทักษะ 6 ด้าน')).toBeInTheDocument();

    // Formula accordion toggle
    const toggleFormulaBtn = screen.getByText('ดูสูตรอย่างละเอียด ▸');
    fireEvent.click(toggleFormulaBtn);
    expect(screen.getByText('▲ ซ่อนสูตรคำนวณ')).toBeInTheDocument();
    expect(
      screen.getByText(/สรุปเกณฑ์การคำนวณตามมาตรฐาน BluLens/),
    ).toBeInTheDocument();
  });

  it('opens and closes video presentation modal', () => {
    render(<AssessmentResultMock />);

    const playArea = screen.getByRole('button', {
      name: 'เปิดวิดีโอตัวอย่างการประเมิน',
    });
    fireEvent.click(playArea);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText('ตัวอย่างการนำเสนอ — ไม่มีวิดีโอจริงสำหรับหน้านี้'),
    ).toBeInTheDocument();

    const closeBtn = screen.getByText('ปิดหน้าต่าง');
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
