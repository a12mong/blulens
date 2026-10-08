'use client';

import React from 'react';
import Link from 'next/link';
import { thaiError } from '@/lib/errors';
import { GroupStandingsTable } from './GroupStandingsTable';
import { groupStandings } from './BracketPage';
import { useStandings, useEventMatches } from './api';

export interface StandingsPageProps {
  eventId: string;
}

export function StandingsPage({ eventId }: StandingsPageProps) {
  const { data: standings = [], isPending, isError, error, refetch } = useStandings(eventId);
  const { data: matches = [] } = useEventMatches(eventId);

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
            className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 border-2 border-night-line bg-night-panel text-night-foreground hover:bg-night-panel-2 transition-colors font-sans text-sm cursor-pointer"
          >
            ลองใหม่
          </button>
        </div>
      </main>
    );
  }

  const groups = groupStandings(standings);
  const allConfirmed = standings.length > 0 && standings.every((row) => row.confirmed === true);

  const groupMatches = matches.filter((m) => m.stage === 'group' || !m.stage);
  const reportedMatches = groupMatches.filter((m) => m.status === 'reported');
  const scheduledMatches = groupMatches.filter((m) => m.status === 'scheduled');
  const confirmedMatches = groupMatches.filter((m) => m.status === 'confirmed');

  const reportedCount = reportedMatches.length;
  const scheduledCount = scheduledMatches.length;
  const playedCount = confirmedMatches.length;
  const totalMatches = groupMatches.length;

  let lockText = 'ล็อกแล้ว';
  let isLocked = false;

  if (reportedCount > 0) {
    lockText = `มี ${reportedCount} ผลรอคณะกรรมการยืนยัน`;
    isLocked = false;
  } else if (scheduledCount > 0 || (totalMatches > 0 && playedCount < totalMatches)) {
    lockText = `แข่งแล้ว ${playedCount} จาก ${totalMatches} แมตช์`;
    isLocked = false;
  } else if (standings.length > 0 && allConfirmed) {
    lockText = 'ล็อกแล้ว';
    isLocked = true;
  } else if (totalMatches > 0 && playedCount === totalMatches) {
    lockText = 'ล็อกแล้ว';
    isLocked = true;
  } else {
    lockText = allConfirmed ? 'ล็อกแล้ว' : 'ตารางชั่วคราว';
    isLocked = allConfirmed;
  }

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
            {(standings.length > 0 || matches.length > 0) && (
              <span
                data-testid="standings-lock"
                data-locked={isLocked}
                className="inline-flex items-center gap-1.5 px-3 py-1 border-2 border-night-line bg-night-panel font-pixel text-xs text-night-foreground"
              >
                {isLocked ? (
                  <svg
                    className="h-3.5 w-3.5 flex-shrink-0 text-night-foreground"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 2a4 4 0 00-4 4v2H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-1V6a4 4 0 00-4-4zm2 6V6a2 2 0 10-4 0v2h4z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-3.5 w-3.5 flex-shrink-0 text-night-muted"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                <span>{lockText}</span>
              </span>
            )}
          </div>
          <Link
            href={`/events/${eventId}/bracket`}
            data-testid="standings-bracket-link"
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-4 py-2 border-2 border-night-line bg-night-panel text-night-foreground hover:bg-night-panel-2 transition-colors font-sans text-sm cursor-pointer"
          >
            ดูสายน็อคเอาท์
          </Link>
        </header>

        {/* Group Standings or Empty state */}
        {groups.length > 0 ? (
          <section aria-label="ตารางคะแนนรอบกลุ่ม" className="flex flex-col gap-6">
            {groups.map(({ groupId, label, rows }) => {
              const matchesForGroup = groupMatches.filter((m) => m.groupId === groupId);
              const groupAllPlayed =
                matchesForGroup.length > 0
                  ? matchesForGroup.every((m) => m.status === 'confirmed')
                  : totalMatches > 0
                    ? scheduledCount === 0 && reportedCount === 0
                    : rows.every((r) => r.confirmed === true);

              const groupReportedCount =
                matchesForGroup.length > 0
                  ? matchesForGroup.filter((m) => m.status === 'reported').length
                  : undefined;

              return (
                <GroupStandingsTable
                  key={groupId}
                  label={label}
                  rows={rows}
                  allPlayed={groupAllPlayed}
                  pendingReportedCount={groupReportedCount}
                />
              );
            })}
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
