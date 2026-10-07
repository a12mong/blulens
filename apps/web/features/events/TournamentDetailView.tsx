'use client';

import Link from 'next/link';
import { useMe } from '@/features/auth/api';
import { useEvents, useTournament } from './api';
import { TournamentStatusBadge } from './TournamentStatusBadge';

const DISCIPLINE_TH: Record<string, string> = { MS: 'ชายเดี่ยว', WS: 'หญิงเดี่ยว', MD: 'ชายคู่', WD: 'หญิงคู่', XD: 'คู่ผสม' };

/** Tournament page: header, status, one row per event with role-based links to the entries screens. */
export function TournamentDetailView({ tournamentId }: { tournamentId: string }) {
  const { data: me } = useMe();
  const tournament = useTournament(tournamentId);
  const events = useEvents(tournamentId);
  const roles = me?.roles ?? [];

  if (tournament.isPending) return <p role="status">กำลังโหลด…</p>;
  if (tournament.isError || !tournament.data) {
    return (
      <p role="alert" data-testid="tournament-detail-error">
        {tournament.error?.message ?? 'ไม่พบทัวร์นาเมนต์'}
      </p>
    );
  }
  const t = tournament.data;

  return (
    <div className="flex flex-col gap-4" data-testid="tournament-detail">
      <div>
        <h2 data-testid="tournament-name" className="text-xl font-bold">{t.name}</h2>
        <TournamentStatusBadge status={t.status} />
      </div>
      <ul className="flex flex-col gap-2" data-testid="event-list">
        {(events.data ?? []).map((e) => (
          <li key={e.id} data-testid="event-row" data-event-id={e.id} className="flex flex-wrap items-center gap-3 rounded border p-3">
            <span>
              {DISCIPLINE_TH[e.discipline]} ({e.discipline}) {e.gradeMin}–{e.gradeMax}
            </span>
            {roles.includes('Admin') && (
              <Link data-testid="event-entries-admin" href={`/admin/events/${e.id}/entries`} className="underline">
                จัดการคู่ผู้สมัคร
              </Link>
            )}
            {roles.includes('Committee') && (
              <Link data-testid="event-entries-committee" href={`/committee/events/${e.id}/entries`} className="underline">
                คิวอนุมัติ
              </Link>
            )}
          </li>
        ))}
        {events.data?.length === 0 && <li data-testid="event-empty">ยังไม่มีอีเวนต์</li>}
      </ul>
    </div>
  );
}
