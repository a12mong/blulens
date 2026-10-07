import React from 'react';

export type MatchStatus =
  | 'scheduled'
  | 'bye'
  | 'reported'
  | 'confirmed'
  | 'walkover';

export type EntryRef = {
  entryId?: string;
  displayName?: string;
  players?: { userId?: string; displayName?: string }[];
  teamNames?: string[];
  gradeLabel?: string | null;
};

export type MatchCardData = {
  matchNo: number;
  top: EntryRef | null;
  bottom: EntryRef | null;
  winnerId: string | null;
  status: MatchStatus;
  games?: { a: number; b: number }[];
  withdrawnIds?: string[];
};

export interface MatchCardProps {
  match: MatchCardData;
  highlightEntryId?: string;
}

export function MatchCard({ match, highlightEntryId }: MatchCardProps) {
  const { matchNo, top, bottom, winnerId, status, games, withdrawnIds } = match;

  const renderStatusBadge = () => {
    if (status === 'confirmed') {
      return null;
    }

    if (status === 'reported') {
      return (
        <span
          data-testid="match-status"
          title="ยังไม่นับในตารางคะแนน"
          className="inline-flex items-center gap-1 text-xs text-night-muted"
        >
          <span aria-hidden="true">⏱</span>
          <span>รอยืนยัน</span>
        </span>
      );
    }

    if (status === 'scheduled') {
      return (
        <span
          data-testid="match-status"
          className="inline-flex items-center text-xs text-night-muted"
        >
          รอแข่ง
        </span>
      );
    }

    if (status === 'bye') {
      return (
        <span
          data-testid="match-status"
          className="inline-flex items-center font-pixel text-xs text-night-muted"
        >
          BYE
        </span>
      );
    }

    if (status === 'walkover') {
      return (
        <span
          data-testid="match-status"
          className="inline-flex items-center text-xs text-rose-400"
        >
          ไม่มาแข่ง
        </span>
      );
    }

    return null;
  };

  const renderRow = (
    entry: EntryRef | null,
    scoreKey: 'a' | 'b',
    testId: 'match-top' | 'match-bottom',
  ) => {
    const isWinner = Boolean(
      entry?.entryId &&
        entry.entryId === winnerId &&
        (status === 'confirmed' || status === 'walkover'),
    );
    const isWithdrawn = Boolean(
      entry?.entryId && withdrawnIds?.includes(entry.entryId),
    );
    const isHighlighted = Boolean(
      entry?.entryId &&
        highlightEntryId &&
        entry.entryId === highlightEntryId,
    );

    return (
      <div
        data-testid={testId}
        {...(isWinner ? { 'data-winner': 'true' } : {})}
        {...(isHighlighted ? { 'data-highlight': 'true' } : {})}
        className={`flex items-center justify-between px-2.5 py-1.5 min-h-[38px] transition-colors ${
          isHighlighted ? 'outline-2 outline-solid outline-night-line' : ''
        } ${isWinner ? 'bg-night-panel-2' : ''}`}
      >
        <div className="flex flex-col min-w-0 pr-2">
          {entry ? (
            <>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`font-sans text-sm font-medium ${
                    isWithdrawn
                      ? 'line-through text-night-muted'
                      : 'text-night-foreground'
                  }`}
                >
                  {entry.displayName ?? '—'}
                </span>
                {isWithdrawn && (
                  <span className="text-xs text-rose-400 font-medium">
                    ถอนตัว
                  </span>
                )}
                {isWinner && (
                  <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-400">
                    <span>ชนะ</span>
                    <span aria-hidden="true">✓</span>
                  </span>
                )}
              </div>
              {entry.teamNames && entry.teamNames.length > 0 && (
                <span className="font-sans text-xs text-night-muted truncate">
                  {entry.teamNames.join(', ')}
                </span>
              )}
            </>
          ) : (
            <span className="font-sans text-sm text-night-muted">รอผล</span>
          )}
        </div>

        {games && games.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {games.map((game, idx) => (
              <span
                key={idx}
                className={`font-pixel text-xs px-1.5 py-0.5 min-w-[20px] text-center ${
                  isWinner ? 'text-emerald-400 font-bold' : 'text-night-foreground'
                }`}
              >
                {game[scoreKey]}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <article
      data-testid="match-card"
      data-status={status}
      className={`w-full max-w-sm border-2 border-night-line bg-night-panel p-2 text-night-foreground ${
        status === 'reported' ? 'border-dashed' : 'border-solid'
      }`}
    >
      <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-night-line">
        <span className="font-pixel text-xs text-night-muted">#{matchNo}</span>
        {renderStatusBadge()}
      </div>
      <div className="flex flex-col gap-1">
        {renderRow(top, 'a', 'match-top')}
        {renderRow(bottom, 'b', 'match-bottom')}
      </div>
    </article>
  );
}
