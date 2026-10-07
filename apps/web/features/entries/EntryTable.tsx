'use client';

import { GradeBand } from '@/components/ui/GradeBand';
import type { components } from '@/lib/api/schema';
import { warningLines } from './warningText';

type Entry = components['schemas']['Entry'];

interface EntryTableProps {
  entries: Entry[];
  mode: 'admin' | 'committee';
  onForward?: (entry: Entry) => void;
  onApprove?: (entry: Entry) => void;
  onReject?: (entry: Entry) => void;
  onEdit?: (entry: Entry) => void;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'ร่าง',
  pending_committee: 'รอคณะกรรมการ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ถูกปฏิเสธ',
  withdrawn: 'ถอนตัว',
};

export function EntryTable({
  entries,
  mode,
  onForward,
  onApprove,
  onReject,
  onEdit,
}: EntryTableProps) {
  if (entries.length === 0) {
    return <p data-testid="entry-empty">ยังไม่มีรายการ</p>;
  }

  return (
    <table data-testid="entry-table" className="w-full border-collapse">
      <thead className="border-b border-border">
        <tr>
          <th className="text-left px-4 py-2">ผู้เล่น</th>
          <th className="text-left px-4 py-2">สถานะ</th>
          <th className="text-left px-4 py-2">เกรด</th>
          <th className="text-left px-4 py-2">เตือน</th>
          <th className="text-left px-4 py-2">เหตุผล</th>
          <th className="text-left px-4 py-2">การดำเนินการ</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          const pairDisplay = entry.name || entry.players.map((p) => p.displayName).join(' / ');

          return (
            <tr
              key={entry.id}
              data-testid="entry-row"
              data-entry-id={entry.id}
              data-status={entry.status}
              className="border-b border-border hover:bg-muted/30"
            >
              {/* Pair & Player Info */}
              <td className="px-4 py-2">
                <div>
                  <div className="font-medium" data-testid="entry-pair">
                    {pairDisplay}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {entry.players.map((player, idx) => (
                      <div key={player.userId ?? idx}>
                        {player.displayName}
                        {(player.teamCount ?? 0) > 0 && <span className="ml-1">({player.teamCount})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </td>

              {/* Status Badge */}
              <td className="px-4 py-2">
                <span
                  data-testid="entry-status"
                  className="inline-block px-2 py-1 rounded bg-muted text-sm"
                >
                  {STATUS_LABELS[entry.status] || entry.status}
                </span>
              </td>

              {/* Grades */}
              <td className="px-4 py-2">
                <div className="space-y-2">
                  {entry.players.map((player, idx) => (
                    <div key={player.userId ?? idx} className="space-y-1">
                      {player.grade ? (
                        <>
                          <div className="text-sm flex flex-wrap items-center gap-1.5">
                            {player.displayName ? (
                              <span className="font-medium">{player.displayName}</span>
                            ) : null}
                            <span data-testid="entry-grade-text">
                              <span className="font-bold">{player.grade.label}</span>
                              {` · ช่วง ${player.grade.lower}–${player.grade.upper}`}
                            </span>
                          </div>
                          <GradeBand
                            lower={player.grade.lower}
                            upper={player.grade.upper}
                            score={player.grade.score}
                            label={player.grade.label}
                          />
                        </>
                      ) : (
                        <div className="text-sm flex flex-wrap items-center gap-1.5">
                          {player.displayName ? (
                            <span className="font-medium">{player.displayName}</span>
                          ) : null}
                          <span data-testid="entry-grade-hidden" className="text-muted-foreground">
                            ซ่อนอยู่
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </td>

              {/* Warnings */}
              <td className="px-4 py-2">
                {(() => {
                  const warnings = warningLines(entry);
                  return warnings.length > 0 ? (
                    <ul data-testid="entry-warnings" className="space-y-1">
                      {warnings.map((warning, idx) => (
                        <li
                          key={`${warning}-${idx}`}
                          className="text-sm px-2 py-1 bg-warning text-warning-foreground rounded"
                        >
                          {warning}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  );
                })()}
              </td>

              {/* Decision Reason */}
              <td className="px-4 py-2">
                {entry.status === 'rejected' && entry.decisionReason ? (
                  <div className="text-sm" data-testid="entry-reason">
                    {entry.decisionReason}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>

              {/* Actions */}
              <td className="px-4 py-2">
                <div className="flex gap-2">
                  {mode === 'admin' && (
                    <>
                      {onEdit && (entry.status === 'draft' || entry.status === 'rejected') && (
                        <button
                          data-testid="entry-edit"
                          onClick={() => onEdit(entry)}
                          className="px-3 py-1 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          แก้ไข
                        </button>
                      )}
                      {onForward && entry.status === 'draft' && (
                        <button
                          data-testid="entry-forward"
                          onClick={() => onForward(entry)}
                          className="px-3 py-1 text-sm rounded bg-secondary text-secondary-foreground hover:bg-secondary/90"
                        >
                          ส่งให้คณะกรรมการ
                        </button>
                      )}
                    </>
                  )}

                  {mode === 'committee' && entry.status === 'pending_committee' && (
                    <>
                      <button
                        data-testid="entry-approve"
                        onClick={() => onApprove?.(entry)}
                        className="px-3 py-1 text-sm rounded bg-success text-success-foreground hover:opacity-90"
                      >
                        อนุมัติ
                      </button>
                      <button
                        data-testid="entry-reject"
                        onClick={() => onReject?.(entry)}
                        className="px-3 py-1 text-sm rounded bg-destructive text-destructive-foreground hover:opacity-90"
                      >
                        ปฏิเสธ
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default EntryTable;
