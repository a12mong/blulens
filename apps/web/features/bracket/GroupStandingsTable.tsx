import React from 'react';
import {
  QualificationBadge,
  type QualificationStatus,
} from './QualificationBadge';

export type EntryRef = {
  entryId?: string;
  displayName?: string;
  players?: { userId?: string; displayName?: string }[];
  teamNames?: string[];
  gradeLabel?: string | null;
};

export type GroupStanding = {
  groupId?: string;
  entryId?: string;
  entry?: EntryRef;
  rank?: number;
  played?: number;
  won?: number;
  drawn?: number;
  lost?: number;
  points?: number;
  pointsFor?: number;
  pointsAgainst?: number;
  diff?: number;
  tiebreakNote?: string | null;
  qualification?: QualificationStatus;
  confirmed?: boolean;
};

export interface GroupStandingsTableProps {
  label: string;
  rows: GroupStanding[];
  pendingReportedCount?: number;
  allPlayed?: boolean;
}

export const TIEBREAK_LABELS: Record<string, string> = {
  diff: 'ผลต่างแต้ม',
  point_diff: 'ผลต่างแต้ม',
  head_to_head: 'เจอกันเอง',
  points_for: 'แต้มได้',
  wins: 'จำนวนชนะ',
};

export function formatTiebreakNote(rawNote: string): string {
  const trimmed = rawNote.trim();
  if (/[ก-๙]/.test(trimmed)) {
    return trimmed;
  }
  const lower = trimmed.toLowerCase();
  return TIEBREAK_LABELS[lower] ?? 'เกณฑ์อื่น';
}

function formatDiff(diff?: number): string {
  if (diff === undefined || diff === null) return '0';
  if (diff > 0) return `+${diff}`;
  return `${diff}`;
}

export function GroupStandingsTable({
  label,
  rows,
  pendingReportedCount,
  allPlayed,
}: GroupStandingsTableProps) {
  const sortedRows = [...rows].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const isProvisional =
    allPlayed !== undefined
      ? !allPlayed
      : sortedRows.some((r) => r.confirmed === false);

  const tiebreakNotes = Array.from(
    new Set(
      sortedRows
        .map((r) => r.tiebreakNote)
        .filter((note): note is string => Boolean(note && note.trim().length > 0)),
    ),
  );

  return (
    <section
      data-testid="group-standings"
      aria-label={`กลุ่ม ${label}`}
      className="w-full border-2 border-night-line bg-night-panel p-3 text-night-foreground"
    >
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-night-line">
        <h3 className="font-sans text-base font-semibold text-night-foreground">
          กลุ่ม {label}
        </h3>
        {isProvisional && (
          <span
            data-testid="standings-provisional"
            className="px-2 py-0.5 text-xs font-pixel border border-night-line bg-night-panel text-night-muted"
          >
            ตารางชั่วคราว
          </span>
        )}
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-night-line text-night-muted font-normal text-xs">
              <th scope="col" className="py-2 px-2 text-left font-normal w-10">
                #
              </th>
              <th scope="col" className="py-2 px-2 text-left font-normal">
                คู่
              </th>
              <th scope="col" className="py-2 px-2 text-center font-normal w-14">
                แข่ง
              </th>
              <th scope="col" className="py-2 px-2 text-center font-normal w-24">
                <span className="hidden md:inline">ชนะ/เสมอ/แพ้</span>
                <span className="md:hidden">ช/ส/พ</span>
              </th>
              <th scope="col" className="py-2 px-2 text-center font-normal w-16">
                ผลต่าง
              </th>
              <th scope="col" className="py-2 px-2 text-center font-normal w-14">
                แต้ม
              </th>
              <th scope="col" className="py-2 px-2 text-left font-normal w-36">
                สถานะ
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, idx) => (
              <tr
                key={row.entryId ?? `${row.groupId}-${idx}`}
                data-testid="standing-row"
                className="border-b border-night-line last:border-b-0 hover:bg-night-panel-2/50 transition-colors"
              >
                <td className="py-2 px-2 text-left font-pixel text-xs text-night-muted">
                  {row.rank ?? idx + 1}
                </td>
                <td className="py-2 px-2">
                  <div className="flex flex-col">
                    <span className="font-sans font-medium text-night-foreground">
                      {row.entry?.displayName ?? '—'}
                    </span>
                    {row.entry?.teamNames && row.entry.teamNames.length > 0 && (
                      <span className="font-sans text-xs text-night-muted truncate">
                        {row.entry.teamNames.join(', ')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2 px-2 text-center font-pixel text-xs text-night-foreground">
                  {row.played ?? 0}
                </td>
                <td className="py-2 px-2 text-center font-pixel text-xs text-night-foreground whitespace-nowrap">
                  {`${row.won ?? 0}/${row.drawn ?? 0}/${row.lost ?? 0}`}
                </td>
                <td className="py-2 px-2 text-center font-pixel text-xs whitespace-nowrap">
                  <span
                    className={
                      (row.diff ?? 0) > 0
                        ? 'text-night-foreground font-bold'
                        : 'text-night-muted'
                    }
                  >
                    {formatDiff(row.diff)}
                  </span>
                </td>
                <td className="py-2 px-2 text-center font-pixel text-xs font-bold text-night-foreground">
                  {row.points ?? 0}
                </td>
                <td className="py-2 px-2 text-left">
                  {row.qualification ? (
                    <QualificationBadge q={row.qualification} />
                  ) : (
                    <span className="text-xs text-night-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        data-testid="standings-legend"
        className="mt-2.5 text-xs text-night-muted"
      >
        ช = ชนะ · ส = เสมอ · พ = แพ้
      </div>

      {pendingReportedCount !== undefined && pendingReportedCount > 0 && (
        <div
          data-testid="standings-pending"
          className="mt-2.5 flex items-center gap-1.5 text-xs text-night-muted border-t border-night-line pt-2"
        >
          <svg
            className="h-3.5 w-3.5 flex-shrink-0 text-night-muted"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
              clipRule="evenodd"
            />
          </svg>
          <span>มี {pendingReportedCount} แมตช์รอยืนยัน (ยังไม่นับในตาราง)</span>
        </div>
      )}

      {tiebreakNotes.length > 0 && (
        <div
          data-testid="tiebreak-note"
          className="mt-2.5 text-xs text-night-muted flex flex-col gap-1 border-t border-night-line pt-2"
        >
          {tiebreakNotes.map((note, idx) => (
            <p key={idx}>เสมอแต้ม ตัดสินด้วย: {formatTiebreakNote(note)}</p>
          ))}
        </div>
      )}
    </section>
  );
}
