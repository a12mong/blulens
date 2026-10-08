import React from 'react';
import type { MatchFormat } from './scoreRules';

export type MatchFormatBadgeProps = {
  format: MatchFormat;
  className?: string;
};

export function formatBadgeText(format: MatchFormat): string {
  const gamesPart =
    format.mode === 'best_of'
      ? `${Math.ceil(format.games / 2)} ใน ${format.games} เกม`
      : `${format.games} เกม`;

  const pointsPart = ` × ${format.pointsPerGame} แต้ม`;

  const deucePart = format.deuce
    ? format.cap
      ? ` ดิวส์ถึง ${format.cap}`
      : ' ดิวส์'
    : ' ไม่มีดิวส์';

  const drawPart = format.drawAllowed ? ' เสมอได้' : '';

  return `${gamesPart}${pointsPart}${deucePart}${drawPart}`;
}

export function MatchFormatBadge({
  format,
  className = '',
}: MatchFormatBadgeProps) {
  const text = formatBadgeText(format);

  return (
    <span
      data-testid="match-format-badge"
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-border bg-muted text-muted-foreground ${className}`}
    >
      {text}
    </span>
  );
}

export default MatchFormatBadge;
