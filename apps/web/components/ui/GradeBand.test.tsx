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

  it('shows the provisional badge with reviewer count and marks the root', () => {
    render(
      <GradeBand
        lower="S-"
        upper="S+"
        score={7.8}
        provisional
        reviewerCount={1}
      />,
    );

    const root = screen.getByRole('img');
    expect(root).toHaveAttribute('data-provisional', 'true');
    expect(root.getAttribute('aria-label')).toMatch(/\(ผลชั่วคราว\)$/);
    expect(screen.getByText('ชั่วคราว · กรรมการ 1 คน')).toBeInTheDocument();
    expect(screen.getByTestId('grade-badge-provisional')).toHaveTextContent(
      'ชั่วคราว · กรรมการ 1 คน',
    );
  });

  it('shows the disputed badge and marks the root', () => {
    render(
      <GradeBand
        lower="S-"
        upper="S+"
        score={7.8}
        disputed
      />,
    );

    const root = screen.getByRole('img');
    expect(root).toHaveAttribute('data-disputed', 'true');
    expect(root.getAttribute('aria-label')).toMatch(/\(ผลไม่ตรงกัน\)$/);
    expect(screen.getByText('ผลไม่ตรงกัน รอคณะกรรมการ')).toBeInTheDocument();
    expect(screen.getByTestId('grade-badge-disputed')).toBeInTheDocument();
    expect(screen.queryByTestId('grade-badge-provisional')).not.toBeInTheDocument();
  });

  it('shows both provisional and disputed badges together', () => {
    render(
      <GradeBand
        lower="S-"
        upper="S+"
        score={7.8}
        provisional
        disputed
        reviewerCount={2}
      />,
    );

    const root = screen.getByRole('img');
    expect(root).toHaveAttribute('data-provisional', 'true');
    expect(root).toHaveAttribute('data-disputed', 'true');
    expect(root.getAttribute('aria-label')).toBe(
      'เกรด S- ถึง S+ คะแนน 7.8 (ผลชั่วคราว) (ผลไม่ตรงกัน)',
    );
    expect(screen.getByTestId('grade-badge-provisional')).toHaveTextContent(
      'ชั่วคราว · กรรมการ 2 คน',
    );
    expect(screen.getByTestId('grade-badge-disputed')).toHaveTextContent(
      'ผลไม่ตรงกัน รอคณะกรรมการ',
    );
  });

  it('renders neither badge when flags are not set', () => {
    render(<GradeBand lower="S-" upper="S+" score={7.4} />);

    const root = screen.getByRole('img');
    expect(root).not.toHaveAttribute('data-provisional');
    expect(root).not.toHaveAttribute('data-disputed');
    expect(screen.queryByTestId('grade-badge-provisional')).not.toBeInTheDocument();
    expect(screen.queryByTestId('grade-badge-disputed')).not.toBeInTheDocument();
  });
});
