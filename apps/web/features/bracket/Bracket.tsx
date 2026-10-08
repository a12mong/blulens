import React from 'react';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import type { components } from '@/lib/api/schema';
import { useBracket, useEventMatches } from './api';
import {
  MatchCard,
  type MatchCardData,
  type MatchStatus,
} from './MatchCard';

export type BracketRound = NonNullable<
  components['schemas']['Bracket']['rounds']
>[number];

export type BracketMatch = NonNullable<BracketRound['matches']>[number] & {
  isThirdPlace?: boolean;
};

export interface BracketProps {
  rounds?: BracketRound[];
  highlightEntryId?: string;
  eventId?: string;
  scores?:
    | Record<string, { a: number; b: number }[]>
    | ((round: number, matchNo: number) => { a: number; b: number }[] | undefined);
}

const STATUS_THAI: Record<string, string> = {
  scheduled: 'รอแข่ง',
  bye: 'BYE',
  reported: 'รอยืนยัน',
  confirmed: 'ยืนยันแล้ว',
  walkover: 'ไม่มาแข่ง',
};

export function getRoundLabels(
  totalRounds: number,
  roundIndex: number,
): { title: string; pixelLabel: string } {
  const distanceFromFinal = totalRounds - 1 - roundIndex;
  if (distanceFromFinal <= 0) {
    return { title: 'รอบชิง', pixelLabel: 'F' };
  }
  if (distanceFromFinal === 1) {
    return { title: 'รองชนะเลิศ', pixelLabel: 'SF' };
  }
  if (distanceFromFinal === 2) {
    return { title: 'รอบ 8 ทีม', pixelLabel: 'QF' };
  }
  const teams = Math.pow(2, distanceFromFinal + 1);
  return {
    title: `รอบ ${teams} ทีม`,
    pixelLabel: `R${teams}`,
  };
}

function getWinnerDisplayName(match: BracketMatch): string {
  if (!match.winner) return '—';
  if (match.status === 'reported' || match.status === 'scheduled') return '—';
  if (match.topEntry?.entryId === match.winner) {
    return match.topEntry.displayName ?? match.winner;
  }
  if (match.bottomEntry?.entryId === match.winner) {
    return match.bottomEntry.displayName ?? match.winner;
  }
  return match.winner;
}

export function Bracket({
  rounds,
  highlightEntryId,
  eventId,
  scores,
}: BracketProps) {
  let resolvedEventId = eventId;
  try {
    const params = useParams();
    if (!resolvedEventId && params) {
      resolvedEventId = (params.id as string) || (params.eventId as string);
    }
  } catch {
    // non-router environment
  }

  let hasQueryClient = true;
  try {
    useQueryClient();
  } catch {
    hasQueryClient = false;
  }

  const bracketQuery =
    hasQueryClient && resolvedEventId ? useBracket(resolvedEventId) : null;
  const isProvisional = Boolean(bracketQuery?.data?.provisional);

  const matchesQuery =
    hasQueryClient && resolvedEventId ? useEventMatches(resolvedEventId) : null;
  const eventMatches = matchesQuery?.data;

  const getMatchGames = (
    roundNo: number,
    match: BracketMatch,
  ): { a: number; b: number }[] | undefined => {
    if (match.games && match.games.length > 0) {
      return match.games.map((g) => ({ a: g.a ?? 0, b: g.b ?? 0 }));
    }
    if (scores) {
      if (typeof scores === 'function') {
        const s = scores(roundNo, match.matchNo ?? 0);
        if (s) return s;
      } else {
        const k1 = `${roundNo}-${match.matchNo}`;
        const k2 = `${match.matchNo}`;
        if (scores[k1]) return scores[k1];
        if (scores[k2]) return scores[k2];
      }
    }
    if (eventMatches) {
      const found = eventMatches.find((m) => {
        const matchNumber = (m as { matchNo?: number }).matchNo;
        const matchesRound = m.round === roundNo;
        const matchesNo = matchNumber !== undefined && matchNumber === match.matchNo;
        const matchesEntries =
          Boolean(match.top && match.bottom) &&
          ((m.a === match.top && m.b === match.bottom) ||
            (m.aEntry?.entryId === match.top && m.bEntry?.entryId === match.bottom));
        return (
          (m.stage === 'knockout' || m.stage === 'third_place') &&
          matchesRound &&
          (matchesNo || matchesEntries)
        );
      });
      if (found?.games && found.games.length > 0) {
        return found.games.map((g) => ({ a: g.a ?? 0, b: g.b ?? 0 }));
      }
    }
    return undefined;
  };

  const getIsThirdPlace = (
    roundNo: number,
    match: BracketMatch,
  ): boolean => {
    if (match.isThirdPlace) return true;
    if (eventMatches) {
      const found = eventMatches.find((m) => {
        const matchNumber = (m as { matchNo?: number }).matchNo;
        const matchesRound = m.round === roundNo;
        const matchesNo = matchNumber !== undefined && matchNumber === match.matchNo;
        return matchesRound && matchesNo;
      });
      if (found?.stage === 'third_place') return true;
    }
    return false;
  };

  const toMatchCardData = (
    match: BracketMatch,
    roundNo: number,
  ): MatchCardData => {
    return {
      matchNo: match.matchNo ?? 0,
      top: isProvisional ? null : (match.topEntry ?? null),
      bottom: isProvisional ? null : (match.bottomEntry ?? null),
      topPlaceholder: match.topPlaceholder,
      bottomPlaceholder: match.bottomPlaceholder,
      winnerId: match.winner ?? null,
      status: (match.status as MatchStatus) ?? 'scheduled',
      games: getMatchGames(roundNo, match),
      withdrawnIds: undefined,
      isThirdPlace: getIsThirdPlace(roundNo, match),
      court: match.court,
    };
  };

  const activeRounds =
    rounds && rounds.length > 0 ? rounds : bracketQuery?.data?.rounds;

  if (
    !activeRounds ||
    activeRounds.length === 0 ||
    activeRounds.every((r) => !r.matches || r.matches.length === 0)
  ) {
    return (
      <div
        data-testid="bracket-empty"
        className="p-8 text-center font-sans text-night-muted bg-night-panel border-2 border-night-line"
      >
        ยังไม่มีสายแข่ง
      </div>
    );
  }

  const sortedRounds = [...activeRounds].sort(
    (a, b) => (a.round ?? 0) - (b.round ?? 0),
  );

  return (
    <section data-testid="bracket" className="w-full bg-night text-night-foreground">
      {/* Visually hidden text table for screen readers */}
      <div className="sr-only">
      <table data-testid="bracket-sr-table">
        <caption>ผังสายแข่งรอบน็อคเอาท์</caption>
        <thead>
          <tr>
            <th scope="col">รอบ</th>
            <th scope="col">แมตช์</th>
            <th scope="col">คู่บน</th>
            <th scope="col">คู่ล่าง</th>
            <th scope="col">สถานะ</th>
            <th scope="col">ผู้ชนะ</th>
          </tr>
        </thead>
        <tbody>
          {sortedRounds.flatMap((round, rIdx) => {
            const { title } = getRoundLabels(sortedRounds.length, rIdx);
            return (round.matches ?? []).map((match, mIdx) => {
              const statusText =
                STATUS_THAI[match.status ?? 'scheduled'] ??
                (match.status || 'รอแข่ง');
              const winnerText = getWinnerDisplayName(match);
              return (
                <tr key={`${round.round ?? rIdx}-${match.matchNo ?? mIdx}`}>
                  <td>{title}</td>
                  <td>
                    {match.matchNo ? `#${match.matchNo}` : `แมตช์ ${mIdx + 1}`}
                  </td>
                  <td>{match.topEntry?.displayName ?? 'รอผล'}</td>
                  <td>{match.bottomEntry?.displayName ?? 'รอผล'}</td>
                  <td>{statusText}</td>
                  <td>{winnerText}</td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>
      </div>

      {/* Desktop layout: tree with columns per round */}
      <div
        data-testid="bracket-tree"
        className="hidden lg:flex gap-6 overflow-x-auto p-4 items-stretch"
      >
        {sortedRounds.map((round, rIdx) => {
          const { title, pixelLabel } = getRoundLabels(
            sortedRounds.length,
            rIdx,
          );
          return (
            <div
              key={round.round ?? rIdx}
              data-testid="bracket-round-column"
              className={`flex-1 min-w-[280px] flex flex-col gap-4 ${
                rIdx > 0 ? 'border-l-2 border-night-line pl-6' : ''
              }`}
            >
              <div className="flex items-center gap-2 pb-2 border-b-2 border-night-line">
                <span className="font-pixel text-xs text-night-muted">
                  {pixelLabel}
                </span>
                <h3 className="font-sans text-sm font-semibold text-night-foreground">
                  {title}
                </h3>
              </div>
              <div className="flex flex-col justify-around flex-1 gap-4 py-2">
                {(round.matches ?? []).map((match, mIdx) => (
                  <MatchCard
                    key={match.matchNo ?? mIdx}
                    match={toMatchCardData(match, round.round ?? (rIdx + 1))}
                    highlightEntryId={highlightEntryId}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile layout: accordion list per round */}
      <div data-testid="bracket-list" className="lg:hidden flex flex-col gap-4 p-4">
        {sortedRounds.map((round, rIdx) => {
          const { title, pixelLabel } = getRoundLabels(
            sortedRounds.length,
            rIdx,
          );
          return (
            <details
              key={round.round ?? rIdx}
              open
              data-testid="bracket-round-details"
              className="border-2 border-night-line bg-night-panel p-3"
            >
              <summary className="cursor-pointer font-semibold flex items-center gap-2 pb-2 list-none select-none text-night-foreground">
                <span className="font-pixel text-xs text-night-muted">
                  {pixelLabel}
                </span>
                <span className="font-sans text-sm">{title}</span>
              </summary>
              <div className="flex flex-col gap-3 mt-3">
                {(round.matches ?? []).map((match, mIdx) => (
                  <MatchCard
                    key={match.matchNo ?? mIdx}
                    match={toMatchCardData(match, round.round ?? (rIdx + 1))}
                    highlightEntryId={highlightEntryId}
                  />
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
