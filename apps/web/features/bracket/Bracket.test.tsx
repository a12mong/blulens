import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Bracket, getRoundLabels } from './Bracket';
import { bracketFixture } from './bracketFixture';

describe('Bracket', () => {
  it('renders one match card per match in both layouts, titles the rounds and keeps a reported match unconfirmed', () => {
    render(<Bracket rounds={bracketFixture} />);

    // Total matches in fixture = 4 (R1) + 2 (R2) + 1 (R3) = 7
    // Tree and list both render all matches => 7 * 2 = 14 MatchCards
    const allMatchCards = screen.getAllByTestId('match-card');
    expect(allMatchCards).toHaveLength(14);

    const tree = screen.getByTestId('bracket-tree');
    const treeCards = within(tree).getAllByTestId('match-card');
    expect(treeCards).toHaveLength(7);

    const list = screen.getByTestId('bracket-list');
    const listCards = within(list).getAllByTestId('match-card');
    expect(listCards).toHaveLength(7);

    // Round titles include 'รอบชิง' and 'รองชนะเลิศ' (and 'รอบ 8 ทีม')
    expect(screen.getAllByText('รอบชิง').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('รองชนะเลิศ').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('รอบ 8 ทีม').length).toBeGreaterThanOrEqual(1);

    // Pixel labels present
    expect(screen.getAllByText('F').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('SF').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('QF').length).toBeGreaterThanOrEqual(1);

    // Reported match cards (matchNo 5): data-status="reported" and NO data-winner
    const reportedCards = allMatchCards.filter(
      (c) => c.getAttribute('data-status') === 'reported',
    );
    expect(reportedCards).toHaveLength(2); // 1 in tree, 1 in list
    for (const card of reportedCards) {
      expect(card.querySelector('[data-winner="true"]')).toBeNull();
    }

    // Confirmed winner check: matchNo 1 has winner E1
    const confirmedCards = allMatchCards.filter(
      (c) => c.getAttribute('data-status') === 'confirmed',
    );
    expect(confirmedCards.length).toBeGreaterThanOrEqual(2);
    const winnerRows = screen.getAllByTestId('match-top').filter(
      (row) => row.getAttribute('data-winner') === 'true',
    );
    expect(winnerRows.length).toBeGreaterThanOrEqual(2);

    // Screen reader table has one row per match (7 rows)
    const srTable = screen.getByTestId('bracket-sr-table');
    const bodyRows = srTable.querySelectorAll('tbody tr');
    expect(bodyRows).toHaveLength(7);

    // Verify SR table headers
    const headerCols = Array.from(srTable.querySelectorAll('thead th')).map(
      (th) => th.textContent,
    );
    expect(headerCols).toEqual([
      'รอบ',
      'แมตช์',
      'คู่บน',
      'คู่ล่าง',
      'สถานะ',
      'ผู้ชนะ',
    ]);
  });

  it('marks rows matching highlightEntryId with data-highlight', () => {
    render(<Bracket rounds={bracketFixture} highlightEntryId="E1" />);

    const highlightedRows = screen
      .getAllByTestId('match-top')
      .filter((row) => row.getAttribute('data-highlight') === 'true');

    expect(highlightedRows.length).toBeGreaterThan(0);
  });

  it('renders empty rounds text when rounds is empty or missing', () => {
    const { rerender } = render(<Bracket rounds={[]} />);
    expect(screen.getByText('ยังไม่มีสายแข่ง')).toBeInTheDocument();
    expect(screen.queryByTestId('bracket-tree')).toBeNull();
    expect(screen.queryByTestId('bracket-list')).toBeNull();

    rerender(<Bracket rounds={[{ round: 1, nameTh: 'รอบแรก', matches: [] }]} />);
    expect(screen.getByText('ยังไม่มีสายแข่ง')).toBeInTheDocument();
  });

  it('calculates round titles and pixel labels accurately for various total rounds', () => {
    // 4 rounds (16 teams)
    expect(getRoundLabels(4, 0)).toEqual({ title: 'รอบ 16 ทีม', pixelLabel: 'R16' });
    expect(getRoundLabels(4, 1)).toEqual({ title: 'รอบ 8 ทีม', pixelLabel: 'QF' });
    expect(getRoundLabels(4, 2)).toEqual({ title: 'รองชนะเลิศ', pixelLabel: 'SF' });
    expect(getRoundLabels(4, 3)).toEqual({ title: 'รอบชิง', pixelLabel: 'F' });

    // 1 round
    expect(getRoundLabels(1, 0)).toEqual({ title: 'รอบชิง', pixelLabel: 'F' });

    // 5 rounds (32 teams)
    expect(getRoundLabels(5, 0)).toEqual({ title: 'รอบ 32 ทีม', pixelLabel: 'R32' });
  });

  it('renders open details accordion items in mobile layout', () => {
    render(<Bracket rounds={bracketFixture} />);
    const details = screen.getAllByTestId('bracket-round-details');
    expect(details).toHaveLength(3);
    for (const d of details) {
      expect(d).toHaveAttribute('open');
    }
  });

  it('sr table contains correct Thai status texts and winner details', () => {
    render(<Bracket rounds={bracketFixture} />);
    const srTable = screen.getByTestId('bracket-sr-table');
    const rows = srTable.querySelectorAll('tbody tr');

    // Row 0: Match 1 confirmed winner E1
    expect(rows[0]).toHaveTextContent('รอบ 8 ทีม');
    expect(rows[0]).toHaveTextContent('#1');
    expect(rows[0]).toHaveTextContent('สมชาย / วิภา');
    expect(rows[0]).toHaveTextContent('อนันต์ / มาลี');
    expect(rows[0]).toHaveTextContent('ยืนยันแล้ว');
    expect(rows[0]).toHaveTextContent('สมชาย / วิภา');

    // Row 1: Match 2 bye
    expect(rows[1]).toHaveTextContent('BYE');

    // Row 4: Match 5 reported (winner unconfirmed, so '—')
    expect(rows[4]).toHaveTextContent('#5');
    expect(rows[4]).toHaveTextContent('รอยืนยัน');
    const cells = rows[4].querySelectorAll('td');
    expect(cells[5]).toHaveTextContent('—');
  });
});
