import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CommitteeHome } from './CommitteeHome';

describe('CommitteeHome', () => {
  const originalEnv = process.env.NEXT_PUBLIC_CALIBRATION_UI;

  afterEach(() => {
    process.env.NEXT_PUBLIC_CALIBRATION_UI = originalEnv;
  });

  it('shows calibration card when flag is on', () => {
    process.env.NEXT_PUBLIC_CALIBRATION_UI = '1';

    render(<CommitteeHome />);

    const card = screen.getByTestId('committee-link-calibration');
    expect(card).toHaveTextContent('ชุดคลิปมาตรฐาน');
    expect(card).toHaveTextContent('สร้างชุดคลิปและดูความลำเอียงของผู้ตรวจ');
    expect(card).toHaveAttribute('href', '/committee/calibration');
  });

  it('does not show calibration card when flag is off', () => {
    process.env.NEXT_PUBLIC_CALIBRATION_UI = undefined;

    render(<CommitteeHome />);

    const card = screen.queryByTestId('committee-link-calibration');
    expect(card).not.toBeInTheDocument();
  });
});
