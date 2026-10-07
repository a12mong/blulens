import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  EventTypeCard,
  defaultEventType,
  type EventTypeDraft,
} from './EventTypeCard';

describe('EventTypeCard', () => {
  it('choosing the groups preset and a grade range reports the full draft', () => {
    let current = defaultEventType();
    const onChange = vi.fn().mockImplementation((updated: EventTypeDraft) => {
      current = updated;
    });

    const { rerender } = render(
      <EventTypeCard value={current} onChange={onChange} />,
    );

    // Pick MD
    const select = screen.getByTestId('etc-discipline');
    fireEvent.change(select, { target: { value: 'MD' } });
    expect(onChange).toHaveBeenCalledWith({
      ...defaultEventType(),
      discipline: 'MD',
    });

    // Re-render with new value
    rerender(<EventTypeCard value={current} onChange={onChange} />);

    // Click groups_knockout radio
    const groupsRadio = screen.getByTestId('etc-format-groups_knockout');
    fireEvent.click(groupsRadio);

    expect(onChange).toHaveBeenLastCalledWith({
      discipline: 'MD',
      gradeMin: 'S-',
      gradeMax: 'S+',
      maxEntries: undefined,
      requiresFreshAssessment: false,
      minReviewers: 2,
      formatPreset: 'groups_knockout',
    });
  });

  it('lists doubles options first in the discipline select', () => {
    render(<EventTypeCard value={defaultEventType()} onChange={vi.fn()} />);

    const select = screen.getByTestId('etc-discipline');
    const options = Array.from(select.querySelectorAll('option')).map(
      (opt) => opt.value,
    );

    expect(options).toEqual(['MD', 'WD', 'XD', 'MS', 'WS']);
  });

  it('renders remove button only when onRemove prop is provided', () => {
    const onRemove = vi.fn();
    const { rerender } = render(
      <EventTypeCard
        value={defaultEventType()}
        onChange={vi.fn()}
        onRemove={onRemove}
      />,
    );

    const removeBtn = screen.getByTestId('etc-remove');
    expect(removeBtn).toBeInTheDocument();
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledTimes(1);

    rerender(<EventTypeCard value={defaultEventType()} onChange={vi.fn()} />);
    expect(screen.queryByTestId('etc-remove')).toBeNull();
  });

  it('updates maxEntries and requiresFreshAssessment via onChange', () => {
    const onChange = vi.fn();
    render(<EventTypeCard value={defaultEventType()} onChange={onChange} />);

    // Update max entries
    const maxEntriesInput = screen.getByTestId('etc-max-entries');
    fireEvent.change(maxEntriesInput, { target: { value: '32' } });
    expect(onChange).toHaveBeenCalledWith({
      ...defaultEventType(),
      maxEntries: 32,
    });

    // Toggle fresh assessment
    const freshCheckbox = screen.getByTestId('etc-fresh');
    fireEvent.click(freshCheckbox);
    expect(onChange).toHaveBeenCalledWith({
      ...defaultEventType(),
      requiresFreshAssessment: true,
    });
  });

  it('renders errors with role="alert"', () => {
    render(
      <EventTypeCard
        value={defaultEventType()}
        onChange={vi.fn()}
        errors={{
          discipline: 'กรุณาเลือกประเภท',
          grade: 'ช่วงเกรดไม่ถูกต้อง',
          maxEntries: 'จำนวนต้องไม่เกิน 256',
        }}
      />,
    );

    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByTestId('etc-error-discipline')).toHaveTextContent(
      'กรุณาเลือกประเภท',
    );
    expect(screen.getByTestId('grade-range-error')).toHaveTextContent(
      'ช่วงเกรดไม่ถูกต้อง',
    );
    expect(screen.getByTestId('etc-error-max-entries')).toHaveTextContent(
      'จำนวนต้องไม่เกิน 256',
    );
  });
});
