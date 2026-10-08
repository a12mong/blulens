'use client';

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ApiRequestError } from '@/lib/api/client';
import { thaiError } from '@/lib/errors';
import { useReportResult, type Match } from './api';
import { GameScoreStepper } from './GameScoreStepper';
import { MatchFormatBadge } from './MatchFormatBadge';
import { validateMatch, type Game, type MatchFormat } from './scoreRules';
import { formatCourtName } from './UmpireMatchCard';
import { useResultDraft } from './useResultDraft';

export type MatchResultFormProps = {
  match: Match;
  format: MatchFormat;
  onReported?: (m: Match) => void;
};

export function MatchResultForm({
  match,
  format,
  onReported,
}: MatchResultFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const mutation = useReportResult(match.id ?? '');
  const { draft, saveDraft, clearDraft } = useResultDraft(match.id ?? '');

  const [games, setGames] = useState<Game[]>(() => {
    const list: Game[] = [];
    for (let i = 0; i < format.games; i++) {
      const draftGame = draft?.games?.[i];
      const matchGame = match.games?.[i];
      list.push({
        a: draftGame?.a ?? matchGame?.a ?? 0,
        b: draftGame?.b ?? matchGame?.b ?? 0,
      });
    }
    return list;
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [walkoverOpen, setWalkoverOpen] = useState(false);

  const isConfirmed = match.status === 'confirmed';
  const isReported = match.status === 'reported';

  const validation = validateMatch(games, format);
  const visibleCount =
    format.mode === 'best_of' ? validation.visibleGames : format.games;

  const nameA = match.aEntry?.displayName || 'ฝ่าย A';
  const clubA = match.aEntry?.teamNames?.join(', ');
  const nameB = match.bEntry?.displayName || 'ฝ่าย B';
  const clubB = match.bEntry?.teamNames?.join(', ');

  let totalA = 0;
  let totalB = 0;
  let gamesA = 0;
  let gamesB = 0;
  for (let i = 0; i < visibleCount; i++) {
    totalA += games[i].a;
    totalB += games[i].b;
    if (games[i].a > games[i].b) gamesA++;
    else if (games[i].b > games[i].a) gamesB++;
  }

  let summaryPrimary = '';
  let summarySecondary = '';
  let winnerDisplayName = '';
  if (validation.ok) {
    if (validation.winner === 'a') {
      winnerDisplayName = nameA;
      summaryPrimary = `ผู้ชนะ: ${nameA} (ชนะ ${gamesA}–${gamesB} เกม)`;
      summarySecondary = `แต้มรวม ${totalA}–${totalB}`;
    } else if (validation.winner === 'b') {
      winnerDisplayName = nameB;
      summaryPrimary = `ผู้ชนะ: ${nameB} (ชนะ ${gamesB}–${gamesA} เกม)`;
      summarySecondary = `แต้มรวม ${totalB}–${totalA}`;
    } else if (validation.winner === 'draw') {
      winnerDisplayName = 'เสมอ';
      summaryPrimary = `เสมอ ${gamesA}–${gamesB} เกม`;
      summarySecondary = `แต้มรวม ${totalA}–${totalB}`;
    }
  }

  const handleGameChange = (idx: number, nextGame: Game) => {
    const updated = [...games];
    updated[idx] = nextGame;
    setGames(updated);
    saveDraft({ games: updated, outcome: 'played' });
  };

  const handleConfirmSubmit = () => {
    const payloadGames = games.slice(0, visibleCount);
    mutation.mutate(
      {
        outcome: 'played',
        games: payloadGames,
      },
      {
        onSuccess: (updated) => {
          clearDraft();
          setConfirmOpen(false);
          onReported?.(updated);
        },
        onError: (err) => {
          const apiErr = err as ApiRequestError;
          if (apiErr?.status === 401) {
            setConfirmOpen(false);
            const currentPath =
              pathname ||
              (typeof window !== 'undefined' ? window.location.pathname : `/umpire/matches/${match.id}`);
            router.push(`/login?next=${encodeURIComponent(currentPath)}`);
          }
        },
      },
    );
  };

  const handleWalkoverSubmit = (outcome: 'walkover_a' | 'walkover_b') => {
    mutation.mutate(
      { outcome },
      {
        onSuccess: (updated) => {
          clearDraft();
          setWalkoverOpen(false);
          onReported?.(updated);
        },
        onError: (err) => {
          const apiErr = err as ApiRequestError;
          if (apiErr?.status === 401) {
            setWalkoverOpen(false);
            const currentPath =
              pathname ||
              (typeof window !== 'undefined' ? window.location.pathname : `/umpire/matches/${match.id}`);
            router.push(`/login?next=${encodeURIComponent(currentPath)}`);
          }
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-card text-card-foreground">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {match.court ? <span>{formatCourtName(match.court)}</span> : null}
            {match.court && (match.stage || match.round) ? <span>·</span> : null}
            {match.stage === 'group' ? <span>รอบกลุ่ม</span> : null}
            {match.stage === 'knockout' ? <span>รอบน็อคเอาท์</span> : null}
            {match.round ? <span>รอบ {match.round}</span> : null}
          </div>
          <MatchFormatBadge format={format} />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
          <div className="flex flex-col">
            <span className="text-base font-semibold text-foreground">
              {nameA}
            </span>
            {clubA ? (
              <span className="text-xs text-muted-foreground">{clubA}</span>
            ) : null}
          </div>
          <div className="flex flex-col text-right">
            <span className="text-base font-semibold text-foreground">
              {nameB}
            </span>
            {clubB ? (
              <span className="text-xs text-muted-foreground">{clubB}</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Status banners */}
      {isReported ? (
        <div
          data-testid="result-reported"
          className="p-3 rounded-lg border border-border bg-muted text-sm text-foreground text-center"
        >
          รายงานแล้ว รอ Committee ยืนยัน
        </div>
      ) : null}

      {isConfirmed ? (
        <div
          data-testid="result-confirmed"
          className="p-3 rounded-lg border border-border bg-muted text-sm font-medium text-foreground text-center"
        >
          ยืนยันแล้ว
          {match.flags?.includes('CORRECTED') ? ' (แก้ไขหลังยืนยัน)' : ''}
        </div>
      ) : null}

      {/* Game steppers */}
      <div className="flex flex-col gap-4">
        {games.slice(0, visibleCount).map((g, idx) => (
          <GameScoreStepper
            key={idx}
            index={idx}
            value={g}
            onChange={(nextGame) => handleGameChange(idx, nextGame)}
            error={validation.errors[idx]}
            disabled={isConfirmed || mutation.isPending}
          />
        ))}
      </div>

      {/* Result summary */}
      {validation.ok ? (
        <div
          data-testid="result-summary"
          className="p-4 rounded-xl border border-border bg-card text-center font-semibold text-foreground flex flex-col gap-1"
        >
          <div>{summaryPrimary}</div>
          {summarySecondary ? (
            <div className="text-sm font-normal text-muted-foreground">
              {summarySecondary}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Actions */}
      {!isConfirmed ? (
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            type="button"
            data-testid="result-submit"
            disabled={!validation.ok || mutation.isPending}
            onClick={() => {
              mutation.reset();
              setConfirmOpen(true);
            }}
            className="w-full sm:flex-1 min-h-[44px] px-6 py-2.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? 'กำลังส่งข้อมูล…' : 'รายงานผล'}
          </button>

          <button
            type="button"
            data-testid="result-walkover"
            disabled={mutation.isPending}
            onClick={() => {
              mutation.reset();
              setWalkoverOpen(true);
            }}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 text-sm font-medium rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ไม่มาแข่ง (walkover)
          </button>
        </div>
      ) : null}

      {/* Mutation error */}
      {mutation.error && (mutation.error as ApiRequestError)?.status !== 401 ? (
        <p
          role="alert"
          data-testid="result-error"
          className="text-xs text-destructive text-center"
        >
          {thaiError(mutation.error)}
        </p>
      ) : null}

      {/* Confirm Dialog */}
      {confirmOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 flex items-center justify-center bg-background/80 z-50 p-4"
        >
          <div className="bg-background border border-border rounded-xl shadow-lg p-6 max-w-md w-full flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-foreground">
              ยืนยันรายงานผล {winnerDisplayName}
            </h2>
            <p className="text-sm text-muted-foreground">
              ผลจะถูกส่งเข้าสู่ระบบในสถานะรอยืนยันโดยคณะกรรมการ
            </p>

            {mutation.error && (mutation.error as ApiRequestError)?.status !== 401 ? (
              <p role="alert" className="text-xs text-destructive">
                {thaiError(mutation.error)}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                data-testid="result-cancel"
                onClick={() => setConfirmOpen(false)}
                className="min-h-[44px] px-4 py-2 text-sm rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                data-testid="result-confirm"
                disabled={mutation.isPending}
                onClick={handleConfirmSubmit}
                className="min-h-[44px] px-5 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
              >
                {mutation.isPending ? 'กำลังบันทึก…' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Walkover Dialog */}
      {walkoverOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 flex items-center justify-center bg-background/80 z-50 p-4"
        >
          <div className="bg-background border border-border rounded-xl shadow-lg p-6 max-w-md w-full flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-foreground">
              เลือกฝ่ายที่ไม่มาแข่ง (Walkover)
            </h2>
            <p className="text-sm text-muted-foreground">
              ระบุฝ่ายที่ไม่มาแข่งเพื่อปรับแพ้แบบชนะผ่าน
            </p>

            {mutation.error && (mutation.error as ApiRequestError)?.status !== 401 ? (
              <p role="alert" className="text-xs text-destructive">
                {thaiError(mutation.error)}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                data-testid="walkover-a"
                disabled={mutation.isPending}
                onClick={() => handleWalkoverSubmit('walkover_a')}
                className="min-h-[44px] px-4 py-2.5 text-sm font-medium rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer text-left disabled:opacity-50"
              >
                {nameA} ไม่มาแข่ง
              </button>
              <button
                type="button"
                data-testid="walkover-b"
                disabled={mutation.isPending}
                onClick={() => handleWalkoverSubmit('walkover_b')}
                className="min-h-[44px] px-4 py-2.5 text-sm font-medium rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer text-left disabled:opacity-50"
              >
                {nameB} ไม่มาแข่ง
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                data-testid="walkover-cancel"
                onClick={() => setWalkoverOpen(false)}
                className="min-h-[44px] px-4 py-2 text-sm rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default MatchResultForm;
