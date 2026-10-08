'use client';

import React, { useMemo, useState } from 'react';
import { thaiError } from '@/lib/errors';
import { useUmpireMatches, type Match } from './api';
import { UmpireMatchCard } from './UmpireMatchCard';

export type UmpireTab = 'todo' | 'reported' | 'confirmed' | 'all';

function compareCourts(a?: string | null, b?: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const numA = parseInt(a.replace(/\D/g, ''), 10);
  const numB = parseInt(b.replace(/\D/g, ''), 10);
  if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
    return numA - numB;
  }
  return a.localeCompare(b, undefined, { numeric: true });
}

function compareMatches(a: Match, b: Match): number {
  const courtDiff = compareCourts(a.court, b.court);
  if (courtDiff !== 0) return courtDiff;
  const roundA = a.round ?? 0;
  const roundB = b.round ?? 0;
  return roundA - roundB;
}

export function UmpireMatches() {
  const { data: matches = [], isLoading, isError, error, refetch } = useUmpireMatches();
  const [activeTab, setActiveTab] = useState<UmpireTab>('todo');

  const counts = useMemo(() => {
    return {
      todo: matches.filter((m) => m.status === 'scheduled').length,
      reported: matches.filter((m) => m.status === 'reported').length,
      confirmed: matches.filter((m) => m.status === 'confirmed').length,
      all: matches.length,
    };
  }, [matches]);

  const filteredMatches = useMemo(() => {
    let list: Match[] = [];
    if (activeTab === 'todo') {
      list = matches.filter((m) => m.status === 'scheduled');
    } else if (activeTab === 'reported') {
      list = matches.filter((m) => m.status === 'reported');
    } else if (activeTab === 'confirmed') {
      list = matches.filter((m) => m.status === 'confirmed');
    } else {
      list = matches;
    }
    return [...list].sort(compareMatches);
  }, [matches, activeTab]);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="กำลังโหลด"
        data-testid="umpire-skeleton"
        className="flex flex-col gap-3"
      >
        <div className="h-11 w-full bg-muted rounded-md animate-pulse" />
        <div className="h-28 rounded-lg bg-muted animate-pulse" />
        <div className="h-28 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        data-testid="umpire-error"
        className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg border border-destructive bg-destructive/10 text-destructive text-sm"
      >
        <span>{thaiError(error, 'เกิดข้อผิดพลาดในการโหลดแมตช์')}</span>
        <button
          type="button"
          data-testid="umpire-retry"
          onClick={() => refetch()}
          className="min-h-[44px] px-4 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 cursor-pointer"
        >
          ลองใหม่
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <div
        className="flex gap-2 flex-wrap border-b border-border pb-2"
        role="tablist"
        aria-label="สถานะแมตช์"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'todo'}
          data-testid="umpire-tab-todo"
          onClick={() => setActiveTab('todo')}
          className={`min-h-[44px] px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'todo'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          รอกรอก ({counts.todo})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'reported'}
          data-testid="umpire-tab-reported"
          onClick={() => setActiveTab('reported')}
          className={`min-h-[44px] px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'reported'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          รายงานแล้ว ({counts.reported})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'confirmed'}
          data-testid="umpire-tab-confirmed"
          onClick={() => setActiveTab('confirmed')}
          className={`min-h-[44px] px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'confirmed'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          ยืนยันแล้ว ({counts.confirmed})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'all'}
          data-testid="umpire-tab-all"
          onClick={() => setActiveTab('all')}
          className={`min-h-[44px] px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          ทั้งหมด ({counts.all})
        </button>
      </div>

      {filteredMatches.length === 0 ? (
        <div
          data-testid="umpire-empty"
          className="p-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg"
        >
          ไม่มีแมตช์ในหมวดนี้
        </div>
      ) : (
        <div data-testid="umpire-match-list" className="flex flex-col gap-3">
          {filteredMatches.map((m) => (
            <UmpireMatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </div>
  );
}
