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
      <span aria-hidden="true">{config.symbol}</span>
      <span>{config.label}</span>
    </span>
  );
}

export default TournamentStatusBadge;
