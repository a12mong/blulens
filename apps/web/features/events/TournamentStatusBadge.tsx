import React from 'react';
import type { components } from '@/lib/api/schema';

export type TournamentStatus = components['schemas']['Tournament']['status'];

export type TournamentStatusBadgeProps = {
  status: TournamentStatus;
};

const STATUS_CONFIG: Record<
  TournamentStatus,
  { label: string; symbol: string; className: string }
> = {
  draft: {
    label: 'ร่าง',
    symbol: '✎',
    className: 'bg-muted text-muted-foreground border-border',
  },
  open: {
    label: 'เปิดรับสมัคร',
    symbol: '●',
    className: 'bg-primary/10 text-primary border-primary/20',
  },
  closed: {
    label: 'ปิดรับสมัคร',
    symbol: '✕',
    className: 'bg-muted text-muted-foreground border-border',
  },
  running: {
    label: 'กำลังแข่งขัน',
    symbol: '▶',
    className: 'bg-secondary text-secondary-foreground border-border',
  },
  finished: {
    label: 'จบแล้ว',
    symbol: '✓',
    className: 'bg-muted text-muted-foreground border-border',
  },
};

export const STATUS_LABELS: Record<TournamentStatus, string> = {
  draft: 'ร่าง',
  open: 'เปิดรับสมัคร',
  closed: 'ปิดรับสมัคร',
  running: 'กำลังแข่งขัน',
  finished: 'จบแล้ว',
};

export function TournamentStatusBadge({ status }: TournamentStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    symbol: '•',
    className: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <span
      data-testid="tournament-status"
      data-status={status}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
    >
      <span aria-hidden="true" className="inline-flex">
        {status === 'draft' ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" />
          </svg>
        ) : (
          config.symbol
        )}
      </span>
      <span>{config.label}</span>
    </span>
  );
}

export default TournamentStatusBadge;
