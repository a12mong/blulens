import Link from 'next/link';
import React from 'react';
import type { Match } from './api';

export type UmpireMatchCardProps = {
  match: Match;
};

const STAGE_LABELS: Record<string, string> = {
  group: 'กลุ่ม',
  knockout: 'น็อคเอาท์',
  third_place: 'ชิงที่ 3',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'รอกรอกผล',
  reported: 'รายงานแล้ว',
  confirmed: 'ยืนยันแล้ว',
  bye: 'BYE',
  walkover: 'ไม่มาแข่ง',
  void: 'ยกเลิก',
};

export function UmpireMatchCard({ match }: UmpireMatchCardProps) {
  const courtText = match.court ?? '-';
  const stageText = (match.stage && STAGE_LABELS[match.stage]) || match.stage || '';
  const roundNum = match.round != null ? match.round : 1;
  const headerText = `สนาม ${courtText} · ${stageText} รอบ ${roundNum}`;

  const nameA = match.aEntry?.displayName || 'ฝ่าย A';
  const clubA = match.aEntry?.teamNames?.join(', ');
  const nameB = match.bEntry?.displayName || 'ฝ่าย B';
  const clubB = match.bEntry?.teamNames?.join(', ');

  const status = match.status ?? 'scheduled';
  const statusText = STATUS_LABELS[status] || status;

  let actionLabel: string | null = null;
  if (status === 'scheduled') {
    actionLabel = 'กรอกผล';
  } else if (status === 'reported') {
    actionLabel = 'แก้ผล';
  } else if (status === 'confirmed') {
    actionLabel = 'ดู';
  }

  const hasConflict = match.flags?.includes('UMPIRE_TEAM_CONFLICT');

  return (
    <article
      data-testid="umpire-match"
      data-status={status}
      className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm flex flex-col gap-3"
    >
      <header className="text-xs font-semibold text-muted-foreground border-b border-border/50 pb-2">
        {headerText}
      </header>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-1">
        <div className="flex-1 w-full sm:w-auto">
          <div className="font-semibold text-sm text-card-foreground">{nameA}</div>
          {clubA && <div className="text-xs text-muted-foreground">{clubA}</div>}
        </div>

        <div className="text-xs font-bold text-muted-foreground px-2 py-0.5">vs</div>

        <div className="flex-1 w-full sm:w-auto text-left sm:text-right">
          <div className="font-semibold text-sm text-card-foreground">{nameB}</div>
          {clubB && <div className="text-xs text-muted-foreground">{clubB}</div>}
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
        <div className="flex flex-wrap items-center gap-2">
          <span
            data-testid="umpire-match-status"
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground"
          >
            {statusText}
          </span>
          {hasConflict && (
            <span
              data-testid="umpire-team-conflict"
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-warning text-warning-foreground"
            >
              ผู้ตัดสินสังกัดเดียวกับผู้เล่น
            </span>
          )}
        </div>

        {actionLabel && match.id && (
          <Link
            href={`/umpire/matches/${match.id}`}
            data-testid="umpire-match-action"
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            {actionLabel}
          </Link>
        )}
      </footer>
    </article>
  );
}
