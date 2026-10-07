import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { GRADE_KEYS } from './GradeBand';
import { GradeRangeSelect, TIERS } from './GradeRangeSelect';

describe('GradeRangeSelect', () => {
  it('raising min above max drags max up', () => {
    const onChange = vi.fn();
    render(<GradeRangeSelect min="S-" max="S" onChange={onChange} />);

    const minSelect = screen.getByTestId('grade-min');
    fireEvent.change(minSelect, { target: { value: 'N' } });

    expect(onChange).toHaveBeenCalledWith({ min: 'N', max: 'N' });
  });

  it('lowering max below min drags min down', () => {
    const onChange = vi.fn();
    render(<GradeRangeSelect min="S" max="N" onChange={onChange} />);

    const maxSelect = screen.getByTestId('grade-max');
    fireEvent.change(maxSelect, { target: { value: 'BG2' } });

    expect(onChange).toHaveBeenCalledWith({ min: 'BG2', max: 'BG2' });
  });

  it('normal min change within bounds preserves max', () => {
    const onChange = vi.fn();
    render(<GradeRangeSelect min="RK1" max="P+" onChange={onChange} />);

    const minSelect = screen.getByTestId('grade-min');
    fireEvent.change(minSelect, { target: { value: 'BG1' } });

    expect(onChange).toHaveBeenCalledWith({ min: 'BG1', max: 'P+' });
  });

  it('normal max change within bounds preserves min', () => {
    const onChange = vi.fn();
    render(<GradeRangeSelect min="RK1" max="P+" onChange={onChange} />);

    const maxSelect = screen.getByTestId('grade-max');
    fireEvent.change(maxSelect, { target: { value: 'S' } });

    expect(onChange).toHaveBeenCalledWith({ min: 'RK1', max: 'S' });
  });

  it('renders 5 optgroups and 15 options per select', () => {
    render(<GradeRangeSelect min="RK1" max="P+" onChange={vi.fn()} />);

    const minSelect = screen.getByTestId('grade-min');
    const maxSelect = screen.getByTestId('grade-max');

    [minSelect, maxSelect].forEach((select) => {
      const optgroups = select.querySelectorAll('optgroup');
      expect(optgroups).toHaveLength(5);
      expect(Array.from(optgroups).map((og) => og.label)).toEqual([
        'Rookie',
        'Beginner',
        'Standard',
        'Neutral',
        'Professional',
      ]);

      const options = select.querySelectorAll('option');
      expect(options).toHaveLength(15);
      expect(Array.from(options).map((opt) => opt.value)).toEqual([...GRADE_KEYS]);
    });
  });

  it('displays error in role="alert" when error prop is provided', () => {
    const { rerender } = render(
      <GradeRangeSelect
        min="RK1"
        max="P+"
        onChange={vi.fn()}
        error="ช่วงเกรดไม่ถูกต้อง"
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('ช่วงเกรดไม่ถูกต้อง');
    expect(alert).toHaveAttribute('data-testid', 'grade-range-error');

    rerender(<GradeRangeSelect min="RK1" max="P+" onChange={vi.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
