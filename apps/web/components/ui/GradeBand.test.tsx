import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GradeBand, type GradeKey } from './GradeBand';

describe('GradeBand', () => {
  it('highlights exactly the cells between lower and upper inclusive', () => {
    render(<GradeBand lower="S-" upper="S+" score={7.4} />);

    const root = screen.getByRole('img');
    expect(root).toHaveAttribute('aria-label', 'เกรด S- ถึง S+ คะแนน 7.4');

    const cells = screen.getAllByTestId('grade-cell');
    expect(cells).toHaveLength(15);

    const activeCells = cells.filter((c) => c.getAttribute('data-active') === 'true');
    expect(activeCells).toHaveLength(3);
    expect(activeCells.map((c) => c.getAttribute('data-key'))).toEqual(['S-', 'S', 'S+']);

    const markerCells = cells.filter((c) => c.getAttribute('data-marker') === 'true');
    expect(markerCells).toHaveLength(1);
    expect(markerCells[0]).toHaveAttribute('data-key', 'S');
    expect(markerCells[0]).toHaveAttribute('data-tier', 'Standard');
  });

  it('renders exact case with a single active cell', () => {
    render(<GradeBand lower="S" upper="S" score={7} />);

    const root = screen.getByRole('img');
    expect(root).toHaveAttribute('aria-label', 'เกรด S คะแนน 7');

    const cells = screen.getAllByTestId('grade-cell');
    const activeCells = cells.filter((c) => c.getAttribute('data-active') === 'true');
    expect(activeCells).toHaveLength(1);
    expect(activeCells[0]).toHaveAttribute('data-key', 'S');

    const markerCells = cells.filter((c) => c.getAttribute('data-marker') === 'true');
    expect(markerCells).toHaveLength(1);
    expect(markerCells[0]).toHaveAttribute('data-key', 'S');
  });

  it('handles invalid case by rendering null and calling console.error once', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // lower='P', upper='S' (index 13 > index 7) is invalid
    const { container } = render(
      <GradeBand lower={'P' as GradeKey} upper={'S' as GradeKey} score={7.4} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(errorSpy).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });

  it('renders label fallback correctly when label is omitted vs provided', () => {
    // 1. Range without label: shows lower–upper (en dash)
    const { rerender } = render(<GradeBand lower="BG1" upper="BG3" score={4.2} />);
    const labelContainer = screen.getByTestId('grade-band-label');
    expect(labelContainer).toHaveTextContent('BG1\u2013BG3');

    // 2. Exact without label: shows lower
    rerender(<GradeBand lower="BG2" upper="BG2" score={4.0} />);
    expect(labelContainer).toHaveTextContent('BG2');

    // 3. Explicit label provided: shows custom label
    rerender(<GradeBand lower="BG1" upper="BG3" score={4.2} label="BG1/BG2" />);
    expect(labelContainer).toHaveTextContent('BG1/BG2');
  });
});
