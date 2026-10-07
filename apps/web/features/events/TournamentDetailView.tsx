'use client';

import Link from 'next/link';
import { useMe } from '@/features/auth/api';
import { thaiError } from '@/lib/errors';
import { useEvents, useTournament, type Event } from './api';
import { TournamentStatusBadge } from './TournamentStatusBadge';

export type EventWithCount = Event & {
  entryCount?: number;
};

const DISCIPLINE_TH: Record<string, string> = {
  MS: 'ชายเดี่ยว',
  WS: 'หญิงเดี่ยว',
  MD: 'ชายคู่',
  WD: 'หญิงคู่',
  XD: 'คู่ผสม',
};

/** Tournament page: header, status, one row per event with role-based links to the entries screens. */
export function TournamentDetailView({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const { data: me } = useMe();
  const tournament = useTournament(tournamentId);
  const events = useEvents(tournamentId);
  const roles = me?.roles ?? [];

  if (tournament.isPending) {
    return (
      <div
        role="status"
        aria-label="กำลังโหลด"
        data-testid="tournament-skeleton"
        className="flex flex-col gap-4 animate-pulse"
      >
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-6 w-24 bg-muted rounded" />
        <div className="h-20 w-full bg-muted rounded" />
      </div>
    );
  }

  if (tournament.isError || !tournament.data) {
    return (
      <p
        role="alert"
        data-testid="tournament-detail-error"
        className="text-destructive text-sm"
      >
        {thaiError(tournament.error, 'ไม่พบทัวร์นาเมนต์')}
      </p>
    );
  }

  const t = tournament.data;
  const eventList = (events.data ?? []) as EventWithCount[];

  return (
    <div className="flex flex-col gap-4" data-testid="tournament-detail">
      <div className="space-y-1">
        <h2 data-testid="tournament-name" className="text-xl font-bold text-foreground">
          {t.name}
        </h2>
        <TournamentStatusBadge status={t.status} />
      </div>

      {t.status !== 'open' && (
        <p
          data-testid="tournament-not-open"
          className="text-sm text-muted-foreground"
        >
          ยังไม่เปิดรับสมัคร
        </p>
      )}

      <ul className="flex flex-col gap-2" data-testid="event-list">
        {eventList.map((e) => {
          const entryCount = e.entryCount;
          const maxEntries = e.maxEntries;

          return (
            <li
              key={e.id}
              data-testid="event-row"
              data-event-id={e.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground"
            >
              <div className="flex flex-col gap-1">
                <span className="font-medium text-foreground">
                  {DISCIPLINE_TH[e.discipline] ?? e.discipline} ({e.discipline}){' '}
                  {e.gradeMin}–{e.gradeMax}
                </span>
                {entryCount !== undefined && (
                  <span
                    data-testid="event-entry-count"
                    className="text-sm text-muted-foreground"
                  >
                    ผู้สมัคร {entryCount} คู่
                    {maxEntries ? ` / สูงสุด ${maxEntries}` : ''}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {roles.includes('Admin') && (
                  <Link
                    data-testid="event-entries-admin"
                    href={`/admin/events/${e.id}/entries`}
                    className="inline-flex min-h-[44px] items-center rounded bg-primary text-primary-foreground px-4 text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    จัดการคู่ผู้สมัคร
                  </Link>
                )}
                {roles.includes('Committee') && (
                  <Link
                    data-testid="event-entries-committee"
                    href={`/committee/events/${e.id}/entries`}
                    className="inline-flex min-h-[44px] items-center rounded border border-border bg-card text-card-foreground px-4 text-sm font-medium hover:bg-muted transition-colors"
                  >
                    คิวอนุมัติ
                  </Link>
                )}
              </div>
            </li>
          );
        })}
        {events.data?.length === 0 && (
          <li data-testid="event-empty" className="text-sm text-muted-foreground py-2">
            ยังไม่มีอีเวนต์
          </li>
        )}
      </ul>
    </div>
  );
}
