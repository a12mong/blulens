import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import {
  GroupStandingsTable,
  type GroupStanding,
} from './GroupStandingsTable';

describe('GroupStandingsTable', () => {
  const mockRows: GroupStanding[] = [
    {
      groupId: 'g-1',
      entryId: 'e-3',
      rank: 3,
      played: 3,
      won: 1,
      drawn: 0,
      lost: 2,
      points: 3,
      diff: -9,
      qualification: 'best_third_contender',
      confirmed: true,
      entry: {
        entryId: 'e-3',
        displayName: 'กิตติ / สุรชัย',
        teamNames: ['บดินทร์'],
        gradeLabel: 'GRADE_SECRET_3',
      },
    },
    {
      groupId: 'g-1',
      entryId: 'e-1',
      rank: 1,
      played: 3,
      won: 3,
      drawn: 0,
      lost: 0,
      points: 9,
      diff: 24,
      qualification: 'qualified',
      confirmed: true,
      entry: {
        entryId: 'e-1',
        displayName: 'สมชาย / วิภา',
        teamNames: ['เชียงใหม่ แบด'],
        gradeLabel: 'GRADE_SECRET_1',
      },
    },
    {
      groupId: 'g-1',
      entryId: 'e-4',
      rank: 4,
      played: 3,
      won: 0,
      drawn: 0,
      lost: 3,
      points: 0,
      diff: -21,
      qualification: 'out',
      confirmed: true,
      entry: {
        entryId: 'e-4',
        displayName: 'เอกชัย / วนิดา',
        teamNames: ['บ้านทองหยอด'],
        gradeLabel: 'GRADE_SECRET_4',
      },
    },
    {
      groupId: 'g-1',
      entryId: 'e-2',
      rank: 2,
      played: 3,
      won: 2,
      drawn: 0,
      lost: 1,
      points: 6,
      diff: 6,
      qualification: 'best_third',
      confirmed: false, // one row unconfirmed -> provisional marker
      entry: {
        entryId: 'e-2',
        displayName: 'อนันต์ / มาลี',
        teamNames: ['ทีไทยแลนด์'],
        gradeLabel: 'GRADE_SECRET_2',
      },
    },
  ];

  it('rows are ordered by rank, show signed diff, qualification badges and the provisional marker', () => {
    render(
      <GroupStandingsTable
        label="A"
        rows={mockRows}
        pendingReportedCount={1}
      />,
    );

    // Section exists with aria-label
    const section = screen.getByTestId('group-standings');
    expect(section).toHaveAttribute('aria-label', 'กลุ่ม A');

    // 4 rows sorted by rank 1..4
    const rows = screen.getAllByTestId('standing-row');
    expect(rows).toHaveLength(4);

    expect(rows[0]).toHaveTextContent('สมชาย / วิภา');
    expect(rows[0]).toHaveTextContent('+24');
    expect(rows[0]).toHaveTextContent('9');
    expect(rows[0]).toHaveTextContent('3/0/0');

    expect(rows[1]).toHaveTextContent('อนันต์ / มาลี');
    expect(rows[1]).toHaveTextContent('+6');
    expect(rows[1]).toHaveTextContent('6');

    expect(rows[2]).toHaveTextContent('กิตติ / สุรชัย');
    expect(rows[2]).toHaveTextContent('-9');
    expect(rows[2]).toHaveTextContent('3');

    expect(rows[3]).toHaveTextContent('เอกชัย / วนิดา');
    expect(rows[3]).toHaveTextContent('-21');
    expect(rows[3]).toHaveTextContent('0');

    // Four qualification badges
    const badges = screen.getAllByTestId('qual-badge');
    expect(badges).toHaveLength(4);
    expect(badges[0]).toHaveTextContent('เข้ารอบ');
    expect(badges[0].querySelector('svg')).toBeInTheDocument();
    expect(badges[1]).toHaveTextContent('เข้ารอบ (อันดับ 3 ที่ดีที่สุด)');
    expect(badges[2]).toHaveTextContent('ลุ้นอันดับ 3');
    expect(badges[3]).toHaveTextContent('ตกรอบ');

    // Provisional marker present because row e-2 has confirmed: false
    expect(screen.getByTestId('standings-provisional')).toHaveTextContent(
      'ตารางชั่วคราว',
    );

    // Pending reported matches notice
    const pendingNotice = screen.getByTestId('standings-pending');
    expect(pendingNotice).toHaveTextContent('1 แมตช์');
    expect(pendingNotice).toHaveTextContent('มี 1 แมตช์รอยืนยัน (ยังไม่นับในตาราง)');
  });

  it('shows tiebreak note footnote only when present', () => {
    const rowsWithoutTiebreak = mockRows.map((r) => ({
      ...r,
      tiebreakNote: null,
      confirmed: true,
    }));

    const { rerender } = render(
      <GroupStandingsTable label="B" rows={rowsWithoutTiebreak} />,
    );

    expect(screen.queryByTestId('tiebreak-note')).toBeNull();
    expect(screen.queryByTestId('standings-provisional')).toBeNull();

    // Rerender with a tiebreak note on row 2
    const rowsWithTiebreak = rowsWithoutTiebreak.map((r) =>
      r.entryId === 'e-2'
        ? { ...r, tiebreakNote: 'เฮดทูเฮด (ชนะ 2-1 เซ็ต)' }
        : r,
    );

    rerender(<GroupStandingsTable label="B" rows={rowsWithTiebreak} />);

    const note = screen.getByTestId('tiebreak-note');
    expect(note).toBeInTheDocument();
    expect(note).toHaveTextContent('เสมอแต้ม ตัดสินด้วย: เฮดทูเฮด (ชนะ 2-1 เซ็ต)');
  });

  it('never renders gradeLabel in output', () => {
    render(<GroupStandingsTable label="A" rows={mockRows} />);

    expect(screen.queryByText(/GRADE_SECRET/)).toBeNull();
    expect(screen.queryByText('GRADE_SECRET_1')).toBeNull();
    expect(screen.queryByText('GRADE_SECRET_2')).toBeNull();
    expect(screen.queryByText('GRADE_SECRET_3')).toBeNull();
    expect(screen.queryByText('GRADE_SECRET_4')).toBeNull();
  });

  it('maps tiebreaker keys to Thai names and falls back to เกณฑ์อื่น', () => {
    const rows: GroupStanding[] = [
      {
        ...mockRows[0]!,
        tiebreakNote: 'diff',
      },
      {
        ...mockRows[1]!,
        tiebreakNote: 'head_to_head',
      },
      {
        ...mockRows[2]!,
        tiebreakNote: 'points_for',
      },
      {
        ...mockRows[3]!,
        tiebreakNote: 'wins',
      },
      {
        groupId: 'g-1',
        entryId: 'e-5',
        rank: 5,
        played: 3,
        won: 0,
        drawn: 0,
        lost: 3,
        points: 0,
        diff: -30,
        qualification: 'out',
        confirmed: true,
        tiebreakNote: 'random_lottery',
      },
    ];

    render(<GroupStandingsTable label="A" rows={rows} />);

    const note = screen.getByTestId('tiebreak-note');
    expect(note).toHaveTextContent('เสมอแต้ม ตัดสินด้วย: ผลต่างแต้ม');
    expect(note).toHaveTextContent('เสมอแต้ม ตัดสินด้วย: เจอกันเอง');
    expect(note).toHaveTextContent('เสมอแต้ม ตัดสินด้วย: แต้มได้');
    expect(note).toHaveTextContent('เสมอแต้ม ตัดสินด้วย: จำนวนชนะ');
    expect(note).toHaveTextContent('เสมอแต้ม ตัดสินด้วย: เกณฑ์อื่น');
    expect(note).not.toHaveTextContent('diff');
    expect(note).not.toHaveTextContent('head_to_head');
    expect(note).not.toHaveTextContent('random_lottery');
  });

  it('renders column header and legend explaining W/D/L abbreviations', () => {
    render(<GroupStandingsTable label="A" rows={mockRows} />);

    // Header has responsive spans
    const headers = screen.getAllByRole('columnheader');
    const wdlHeader = headers.find((h) => h.textContent?.includes('ชนะ/เสมอ/แพ้'));
    expect(wdlHeader).toBeDefined();
    expect(wdlHeader).toHaveTextContent('ชนะ/เสมอ/แพ้');
    expect(wdlHeader).toHaveTextContent('ช/ส/พ');

    // Legend present
    const legend = screen.getByTestId('standings-legend');
    expect(legend).toHaveTextContent('ช = ชนะ · ส = เสมอ · พ = แพ้');
  });

  it('controls provisional badge with allPlayed prop when provided', () => {
    // mockRows has confirmed: false on row 2, but allPlayed is true
    const { rerender } = render(
      <GroupStandingsTable label="A" rows={mockRows} allPlayed={true} />,
    );
    expect(screen.queryByTestId('standings-provisional')).toBeNull();

    // all confirmed rows, but allPlayed is false
    const confirmedRows = mockRows.map((r) => ({ ...r, confirmed: true }));
    rerender(
      <GroupStandingsTable label="A" rows={confirmedRows} allPlayed={false} />,
    );
    expect(screen.getByTestId('standings-provisional')).toBeInTheDocument();
  });
});
