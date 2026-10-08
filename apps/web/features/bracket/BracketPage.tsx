'use client';

import React, { useState } from 'react';
import { thaiError } from '@/lib/errors';
import { Bracket } from './Bracket';
import { GroupStandingsTable } from './GroupStandingsTable';
import {
  bracketFixture,
  standingsFixture,
  type GroupStanding,
} from './bracketFixture';
import { useBracket, useStandings } from './api';

export interface BracketPageProps {
  eventId: string;
  fixture?: boolean;
}

function formatTime(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function groupStandings(
  standings: GroupStanding[],
): { groupId: string; label: string; rows: GroupStanding[] }[] {
  const groupsMap = new Map<string, GroupStanding[]>();
  for (const s of standings) {
    const gid = s.groupId || 'default';
    if (!groupsMap.has(gid)) {
      groupsMap.set(gid, []);
    }
    groupsMap.get(gid)!.push(s);
  }

  const result: { groupId: string; label: string; rows: GroupStanding[] }[] = [];
  let index = 0;
  for (const [groupId, rows] of groupsMap.entries()) {
    const label = String.fromCharCode(65 + index); // A, B, C...
    result.push({ groupId, label, rows });
    index++;
  }
  return result;
}

export function BracketPage({ eventId, fixture = false }: BracketPageProps) {
  const [initialTime] = useState<Date>(() => new Date());

  // Call hooks only when not in fixture mode
  const bracketQuery = useBracket(fixture ? '' : eventId);
  const standingsQuery = useStandings(fixture ? '' : eventId);

  const [userSelectedTab, setUserSelectedTab] = useState<
    'groups' | 'knockout' | null
  >(null);

  if (!fixture && (bracketQuery.isPending || standingsQuery.isPending)) {
    return (
      <main
        data-testid="bracket-page"
        className="min-h-screen bg-night text-night-foreground p-4 md:p-6 lg:p-8"
      >
        <div className="flex items-center justify-center p-12">
          <p role="status" className="font-sans text-night-muted">
            กำลังโหลด…
          </p>
        </div>
      </main>
    );
  }

  const is404 =
    (bracketQuery.error as { status?: number })?.status === 404 ||
    (standingsQuery.error as { status?: number })?.status === 404 ||
    (bracketQuery.error as { code?: string })?.code === 'NOT_FOUND' ||
    (standingsQuery.error as { code?: string })?.code === 'NOT_FOUND';

  const otherError = !fixture ? bracketQuery.error || standingsQuery.error : null;

  const rawRounds = fixture
    ? bracketFixture
    : bracketQuery.data?.rounds ?? [];

  const rawStandings = fixture
    ? standingsFixture
    : standingsQuery.data ?? [];

  const hasData = rawRounds.length > 0 || rawStandings.length > 0;

  if (!fixture && ((is404 || otherError) && !hasData)) {
    if (is404) {
      return (
        <main
          data-testid="bracket-page"
          className="min-h-screen bg-night text-night-foreground p-4 md:p-6 lg:p-8"
        >
          <div
            data-testid="bracket-unpublished"
            className="flex flex-col items-center justify-center p-12 text-center gap-4"
          >
            <p className="font-pixel text-lg text-night-muted">
              สายแข่งยังไม่ประกาศ
            </p>
            <a
              href="/events"
              className="inline-flex items-center gap-2 px-4 py-2 border-2 border-night-line bg-night-panel text-night-foreground hover:bg-night-panel-2 transition-colors font-sans text-sm"
            >
              ← กลับไปหน้ารายการ
            </a>
          </div>
        </main>
      );
    }

    return (
      <main
        data-testid="bracket-page"
        className="min-h-screen bg-night text-night-foreground p-4 md:p-6 lg:p-8"
      >
        <div className="max-w-xl mx-auto flex flex-col gap-4 p-8">
          <div
            role="alert"
            className="p-4 border-2 border-night-line bg-night-panel text-night-foreground font-sans text-sm"
          >
            {thaiError(otherError)}
          </div>
          <a
            href="/events"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 border-2 border-night-line bg-night-panel text-night-foreground hover:bg-night-panel-2 transition-colors font-sans text-sm"
          >
            ← กลับไปหน้ารายการ
          </a>
        </div>
      </main>
    );
  }

  const groups = groupStandings(rawStandings);
  const hasStandings = rawStandings.length > 0;
  const bracketPublished =
    !fixture && bracketQuery.data?.provisional === false && rawRounds.length > 0;
  const activeTab =
    userSelectedTab ?? (bracketPublished || !hasStandings ? 'knockout' : 'groups');

  const updatedAt =
    !fixture && bracketQuery.dataUpdatedAt
      ? new Date(bracketQuery.dataUpdatedAt)
      : initialTime;

  return (
    <main
      data-testid="bracket-page"
      className="min-h-screen bg-night text-night-foreground p-4 md:p-6 lg:p-8"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header: title + last updated */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b-2 border-night-line pb-4">
          <h1 className="font-sans text-2xl font-bold text-night-foreground">
            สายแข่งขัน
          </h1>
          <p
            data-testid="bracket-last-updated"
            className="font-sans text-xs text-night-muted"
          >
            {`อัปเดต ${formatTime(updatedAt)} (รีเฟรชอัตโนมัติ 30 วิ)`}
          </p>
        </header>

        {/* Optional non-blocking error alert */}
        {!fixture && otherError && (
          <div
            role="alert"
            className="p-3 border-2 border-night-line bg-night-panel text-night-foreground font-sans text-sm"
          >
            {thaiError(otherError)}
          </div>
        )}

        {/* Tab navigation */}
        <div
          role="tablist"
          aria-label="การแข่งขัน"
          className="flex gap-2"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'groups'}
            data-state={activeTab === 'groups' ? 'active' : 'inactive'}
            onClick={() => setUserSelectedTab('groups')}
            className={`px-4 py-2 text-sm font-sans border-2 border-night-line transition-colors ${
              activeTab === 'groups'
                ? 'bg-night-panel-2 text-night-foreground font-semibold'
                : 'bg-night-panel text-night-muted hover:text-night-foreground hover:bg-night-panel-2'
            }`}
          >
            รอบกลุ่ม
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'knockout'}
            data-state={activeTab === 'knockout' ? 'active' : 'inactive'}
            onClick={() => setUserSelectedTab('knockout')}
            className={`px-4 py-2 text-sm font-sans border-2 border-night-line transition-colors ${
              activeTab === 'knockout'
                ? 'bg-night-panel-2 text-night-foreground font-semibold'
                : 'bg-night-panel text-night-muted hover:text-night-foreground hover:bg-night-panel-2'
            }`}
          >
            สายน็อคเอาท์
          </button>
        </div>

        {/* Active tab content */}
        <div>
          {activeTab === 'groups' && (
            <section
              aria-label="ตารางคะแนนรอบกลุ่ม"
              className="flex flex-col gap-6"
            >
              {groups.length > 0 ? (
                groups.map(({ groupId, label, rows }) => (
                  <GroupStandingsTable
                    key={groupId}
                    label={label}
                    rows={rows}
                  />
                ))
              ) : (
                <div
                  data-testid="standings-empty"
                  className="p-8 text-center font-sans text-night-muted bg-night-panel border-2 border-night-line"
                >
                  ยังไม่มีตารางคะแนน
                </div>
              )}
            </section>
          )}

          {activeTab === 'knockout' && (
            <section aria-label="ผังน็อคเอาท์">
              <Bracket rounds={rawRounds} />
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
