import Link from 'next/link';
import React from 'react';
import type { components } from '@/lib/api/schema';
import { TournamentStatusBadge } from './TournamentStatusBadge';

export type TournamentDetail = components['schemas']['TournamentDetail'];

export type TournamentCardProps = {
  tournament: TournamentDetail;
  canManage?: boolean;
  onOpen?: (t: TournamentDetail) => void;
};

function formatThaiDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  });
}

export function TournamentCard({
  tournament,
  canManage = false,
  onOpen,
}: TournamentCardProps) {
  const { id, name, startsOn, entriesCloseAt, venue, status, events } = tournament;

  const startDateText = startsOn ? formatThaiDate(startsOn) : '';
  const closeDateText = entriesCloseAt ? formatThaiDate(entriesCloseAt) : '';

  return (
    <article
      data-testid="tournament-card"
      data-tournament-id={id}
      className="border border-border rounded-lg p-4 bg-card text-card-foreground shadow-sm flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h3 data-testid="tournament-name" className="text-base font-semibold">
            {name}
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {startDateText ? <span>{startDateText}</span> : null}
            {venue ? (
              <>
                <span aria-hidden="true">·</span>
                <span data-testid="tournament-venue">{venue}</span>
              </>
            ) : null}
            {closeDateText ? (
              <>
                <span aria-hidden="true">·</span>
                <span data-testid="tournament-close-date">
                  ปิดรับ {closeDateText}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <TournamentStatusBadge status={status} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="text-xs text-muted-foreground">อีเวนต์:</span>
        {events && events.length > 0 ? (
          events.map((evt) => (
            <span
              key={evt.id}
              data-testid="tournament-event-chip"
              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground font-medium"
            >
              {evt.discipline} {evt.gradeMin}–{evt.gradeMax}
            </span>
          ))
        ) : (
          <span
            data-testid="tournament-no-events"
            className="text-xs text-muted-foreground"
          >
            ยังไม่มีอีเวนต์
          </span>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        {canManage && status === 'draft' ? (
          <button
            type="button"
            data-testid="tournament-publish"
            onClick={() => onOpen?.(tournament)}
            className="px-3 py-1.5 text-xs font-medium rounded border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
          >
            เปิดรับสมัคร
          </button>
        ) : null}

        <Link
          data-testid="tournament-open"
          href={`/events/${id}`}
          className="px-3 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          เปิด
        </Link>
      </div>
    </article>
  );
}

export default TournamentCard;
