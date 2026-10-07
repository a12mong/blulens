import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RubricItemCard } from './RubricItemCard';
import type { Criterion } from './RubricItemCard';

vi.mock('@/components/ui/GradePicker', () => ({
  GradePicker: vi.fn(() => null),
}));

const mockCriterion: Criterion = {
  key: 'criterion-1',
  nameTh: 'ความชัดเจนในการเล่น',
  weight: 2,
  anchorsTh: {
    Rookie: 'ยังต้องฝึกฝน',
    Beginner: 'พัฒนาอย่างต่อเนื่อง',
    Standard: 'เล่นได้ชัดเจน',
  },
};

describe('RubricItemCard', () => {
  it('shows the unanswered status, then reports the picked grade through onChange', async () => {
    const onChange = vi.fn();

    // Test 1: undefined value shows "ยังไม่เลือก"
    render(
      <RubricItemCard
        index={1}
        criterion={mockCriterion}
        value={undefined}
        onChange={onChange}
      />
    );

    expect(screen.getByTestId('rubric-item')).toHaveAttribute('data-answered', 'false');
    expect(screen.getByTestId('rubric-item-status')).toHaveTextContent('ยังไม่เลือก');
  });

  it('shows graded status when value is a GradeKey', () => {
    render(
      <RubricItemCard
        index={1}
        criterion={mockCriterion}
        value="S"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByTestId('rubric-item-status')).toHaveTextContent('ให้ S');
    expect(screen.getByTestId('rubric-item')).toHaveAttribute('data-answered', 'true');
  });

  it('shows cannot-assess status when value is null', () => {
    render(
      <RubricItemCard
        index={1}
        criterion={mockCriterion}
        value={null}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByTestId('rubric-item-status')).toHaveTextContent('ประเมินไม่ได้');
    expect(screen.getByTestId('rubric-item')).toHaveAttribute('data-answered', 'true');
  });

  it('renders weight text', () => {
    render(
      <RubricItemCard
        index={2}
        criterion={mockCriterion}
        value={undefined}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText(/น้ำหนัก ×2/)).toBeInTheDocument();
  });
});
