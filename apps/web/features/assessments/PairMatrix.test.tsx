import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PairMatrix } from './PairMatrix';

describe('PairMatrix', () => {
  it('shows kappa with band text per pair, dash for insufficient data, and is symmetric', () => {
    const r1 = 'reviewer-1';
    const r2 = 'reviewer-2';
    const r3 = 'reviewer-3';

    const pairs: any[] = [
      { a: r1, b: r2, cohenKappaQuadratic: { kappa: 0.78, n: 15, band: 'substantial' } },
      { a: r2, b: r3, cohenKappaQuadratic: { kappa: 0.31, n: 10, band: 'fair' } },
      // no pair for (r1, r3) - insufficient
    ];

    render(
      <PairMatrix reviewerIds={[r1, r2, r3]} pairs={pairs} />
    );

    const table = screen.getByTestId('pair-matrix');
    expect(table).toBeInTheDocument();

    // Check cell 0-1 and 1-0: both should contain 0.78 and 'ดี'
    const cell01 = screen.getByTestId('pair-cell-0-1');
    expect(cell01).toHaveTextContent('0.78');
    expect(cell01).toHaveTextContent('ดี');

    const cell10 = screen.getByTestId('pair-cell-1-0');
    expect(cell10).toHaveTextContent('0.78');
    expect(cell10).toHaveTextContent('ดี');

    // Check cell 1-2: should contain 0.31, 'พอใช้' and '⚠'
    const cell12 = screen.getByTestId('pair-cell-1-2');
    expect(cell12).toHaveTextContent('0.31');
    expect(cell12).toHaveTextContent('พอใช้');
    expect(cell12).toHaveTextContent('⚠');

    // Check cell 0-2: should show '—' with 'ข้อมูลร่วมไม่พอ'
    const cell02 = screen.getByTestId('pair-cell-0-2');
    expect(cell02).toHaveTextContent('—');
    expect(cell02).toHaveAttribute('title', 'ข้อมูลร่วมไม่พอ');

    // Check diagonal cells: should show '–'
    const cell00 = screen.getByTestId('pair-cell-0-0');
    expect(cell00).toHaveTextContent('–');

    const cell11 = screen.getByTestId('pair-cell-1-1');
    expect(cell11).toHaveTextContent('–');

    const cell22 = screen.getByTestId('pair-cell-2-2');
    expect(cell22).toHaveTextContent('–');
  });

  it('calls onCellClick with (a, b) when a cell is clicked', async () => {
    const r1 = 'reviewer-1';
    const r2 = 'reviewer-2';
    const pairs: any[] = [{ a: r1, b: r2, cohenKappaQuadratic: { kappa: 0.78, n: 15, band: 'substantial' } }];
    const onCellClick = vi.fn();

    const { rerender } = render(
      <PairMatrix
        reviewerIds={[r1, r2]}
        pairs={pairs}
        onCellClick={onCellClick}
      />
    );

    const cell01 = screen.getByTestId('pair-cell-0-1').querySelector(
      'button'
    );
    expect(cell01).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(cell01!);

    expect(onCellClick).toHaveBeenCalledWith(r1, r2);
    expect(onCellClick).toHaveBeenCalledTimes(1);
  });

  it('does not show raw uuids in output', () => {
    const r1 = 'uuid-1234-5678-abcd';
    const r2 = 'uuid-9999-eeee-ffff';
    const pairs: any[] = [{ a: r1, b: r2, cohenKappaQuadratic: { kappa: 0.78, n: 15, band: 'substantial' } }];

    const { container } = render(
      <PairMatrix reviewerIds={[r1, r2]} pairs={pairs} />
    );

    const text = container.textContent || '';
    expect(text).not.toContain('uuid-1234-5678-abcd');
    expect(text).not.toContain('uuid-9999-eeee-ffff');
    // Should show default labels instead
    expect(text).toContain('R1');
    expect(text).toContain('R2');
  });

  it('shows empty state for empty reviewerIds', () => {
    render(<PairMatrix reviewerIds={[]} pairs={[]} />);
    expect(screen.getByText('ยังไม่มีข้อมูลผู้ประเมิน')).toBeInTheDocument();
  });

  it('respects labelFor prop override', () => {
    const r1 = 'reviewer-1';
    const r2 = 'reviewer-2';
    const pairs: any[] = [];

    const labelFor = (id: string) => {
      if (id === r1) return 'Alice';
      if (id === r2) return 'Bob';
      return 'Unknown';
    };

    render(
      <PairMatrix
        reviewerIds={[r1, r2]}
        pairs={pairs}
        labelFor={labelFor}
      />
    );

    const aliceElements = screen.getAllByText('Alice');
    const bobElements = screen.getAllByText('Bob');
    expect(aliceElements.length).toBeGreaterThan(0);
    expect(bobElements.length).toBeGreaterThan(0);
  });

  it('wraps table in overflow-x-auto container', () => {
    render(
      <PairMatrix
        reviewerIds={['r1', 'r2']}
        pairs={[{ a: 'r1', b: 'r2', cohenKappaQuadratic: { kappa: 0.5, n: 10, band: 'moderate' } }]}
      />
    );

    const table = screen.getByTestId('pair-matrix');
    const container = table.parentElement;
    expect(container).toHaveClass('overflow-x-auto');
  });

  it('shows 44px min size button when onCellClick is provided', async () => {
    const r1 = 'r1';
    const r2 = 'r2';
    const pairs: any[] = [{ a: r1, b: r2, cohenKappaQuadratic: { kappa: 0.78, n: 15, band: 'substantial' } }];

    render(
      <PairMatrix
        reviewerIds={[r1, r2]}
        pairs={pairs}
        onCellClick={vi.fn()}
      />
    );

    const button = screen.getByTestId('pair-cell-0-1').querySelector('button');
    expect(button).toHaveClass('min-h-[44px]', 'min-w-[44px]');
  });

  it('finds pairs with symmetric lookup (a,b or b,a)', () => {
    const r1 = 'r1';
    const r2 = 'r2';
    const r3 = 'r3';

    // Pair defined as (r2, r1) but should be found when looking for (r1, r2)
    const pairs: any[] = [
      { a: r2, b: r1, cohenKappaQuadratic: { kappa: 0.65, n: 14, band: 'substantial' } },
    ];

    render(
      <PairMatrix reviewerIds={[r1, r2, r3]} pairs={pairs} />
    );

    const cell01 = screen.getByTestId('pair-cell-0-1');
    expect(cell01).toHaveTextContent('0.65');
    expect(cell01).toHaveTextContent('ดี');

    const cell10 = screen.getByTestId('pair-cell-1-0');
    expect(cell10).toHaveTextContent('0.65');
    expect(cell10).toHaveTextContent('ดี');
  });

  it('handles null kappa in pairs array', () => {
    const r1 = 'r1';
    const r2 = 'r2';
    const pairs: any[] = [{ a: r1, b: r2, cohenKappaQuadratic: { kappa: null, n: 0, band: 'insufficient' } }];

    render(
      <PairMatrix reviewerIds={[r1, r2]} pairs={pairs} />
    );

    const cell01 = screen.getByTestId('pair-cell-0-1');
    expect(cell01).toHaveTextContent('—');
    expect(cell01).toHaveAttribute('title', 'ข้อมูลร่วมไม่พอ');
  });
});
