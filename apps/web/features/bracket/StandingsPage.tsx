'use client';

import React from 'react';
import Link from 'next/link';
import { thaiError } from '@/lib/errors';
import { GroupStandingsTable } from './GroupStandingsTable';
import { groupStandings } from './BracketPage';
import { useStandings } from './api';

export interface StandingsPageProps {
  eventId: string;
}

export function StandingsPage({ eventId }: StandingsPageProps) {
  const { data: standings = [], isPending, isError, error, refetch } = useStandings(eventId);

  if (isPending) {
    return (
      <main
        data-testid="standings-page"
        className="min-h-screen bg-night text-night-foreground p-4 md:p-6 lg:p-8"
      >
        <div
          role="status"
          data-testid="standings-loading"
          className="flex items-center justify-center p-12"
        >
          <p className="font-sans text-night-muted">กำลังโหลด…</p>
        </div>
      </main>
    );
  }

  if (isError) {
    return (
      <main
        data-testid="standings-page"
        className="min-h-screen bg-night text-night-foreground p-4 md:p-6 lg:p-8"
      >
        <div className="max-w-xl mx-auto flex flex-col gap-4 p-8">
          <div
            role="alert"
            className="p-4 border-2 border-night-line bg-night-panel text-night-foreground font-sans text-sm"
          >
            {thaiError(error, 'เกิดข้อผิดพลาดในการโหลดตารางคะแนน')}
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 border-2 border-night-line bg-night-panel text-night-foreground hover:bg-night-panel-2 transition-colors font-sans text-sm"
          >
            ลองใหม่
          </button>
        </div>
      </main>
    );
  }

  const groups = groupStandings(standings);
  const allConfirmed = standings.length > 0 && standings.every((row) => row.confirmed === true);

  return (
    <main
      data-testid="standings-page"
      className="min-h-screen bg-night text-night-foreground p-4 md:p-6 lg:p-8"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b-2 border-night-line pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-sans text-2xl font-bold text-night-foreground">
              ตารางคะแนนกลุ่ม
            </h1>
            {standings.length > 0 && (
              <span
                data-testid="standings-lock"
                data-locked={allConfirmed}
                className="inline-flex items-center gap-1.5 px-3 py-1 border-2 border-night-line bg-night-panel font-pixel text-xs text-night-foreground"
              >
                <span aria-hidden="true">{allConfirmed ? '🔒' : '⚠️'}</span>
                <span>{allConfirmed ? 'ล็อกแล้ว' : 'ยังไม่ครบ: มีผลที่รอยืนยัน'}</span>
              </span>
            )}
          </div>
          <Link
            href={`/events/${eventId}/bracket`}
            data-testid="standings-bracket-link"
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-4 py-2 border-2 border-night-line bg-night-panel text-night-foreground hover:bg-night-panel-2 transition-colors font-sans text-sm"
          >
            ดูสายน็อคเอาท์
          </Link>
        </header>

        {/* Group Standings or Empty state */}
        {groups.length > 0 ? (
          <section aria-label="ตารางคะแนนรอบกลุ่ม" className="flex flex-col gap-6">
            {groups.map(({ groupId, label, rows }) => (
              <GroupStandingsTable key={groupId} label={label} rows={rows} />
            ))}
          </section>
        ) : (
          <div
            data-testid="standings-empty"
            className="p-8 text-center font-sans text-night-muted bg-night-panel border-2 border-night-line"
          >
            ยังไม่มีการจับกลุ่ม
          </div>
        )}
      </div>
    </main>
  );
}

export default StandingsPage;
