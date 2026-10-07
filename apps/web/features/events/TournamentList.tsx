'use client';

import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import { useMe } from '@/features/auth/api';
import type { components } from '@/lib/api/schema';
import { thaiError } from '@/lib/errors';
import { TournamentCard } from './TournamentCard';
import {
  STATUS_LABELS,
  type TournamentStatus,
} from './TournamentStatusBadge';
import {
  useEvents,
  useSetTournamentStatus,
  useTournaments,
  type Tournament,
} from './api';

export type TournamentDetail = components['schemas']['TournamentDetail'];

const STATUS_ORDER: TournamentStatus[] = [
  'draft',
  'open',
  'closed',
  'running',
  'finished',
];

export function TournamentCardWithEvents({
  tournament,
  canManage,
  onError,
}: {
  tournament: Tournament;
  canManage: boolean;
  onError: (msg: string) => void;
}) {
  const { data: events } = useEvents(tournament.id);
  const setStatusMutation = useSetTournamentStatus(tournament.id);

  const handleOpen = () => {
    setStatusMutation.mutate(
      { to: 'open' },
      {
        onError: (err) => {
          onError(thaiError(err, 'ไม่สามารถเปิดรับสมัครได้'));
        },
      },
    );
  };

  const detail: TournamentDetail = {
    ...tournament,
    events: events ?? [],
  };

  return (
    <TournamentCard
      tournament={detail}
      canManage={canManage}
      onOpen={handleOpen}
    />
  );
}

export function TournamentList() {
  const { data: me } = useMe();
  const canManage = Boolean(me?.roles?.includes('Committee'));

  const { data, isLoading, isError, error, refetch } = useTournaments();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [publishError, setPublishError] = useState<string | null>(null);

  const items = data?.items ?? [];

  const availableStatuses = useMemo(() => {
    const present = Array.from(new Set(items.map((t) => t.status)));
    return present.sort((a, b) => {
      const idxA = STATUS_ORDER.indexOf(a);
      const idxB = STATUS_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [items]);

  const filteredItems = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    return items.filter((tournament) => {
      const matchesSearch =
        !trimmed || tournament.name.toLowerCase().includes(trimmed);
      const matchesStatus =
        !statusFilter || tournament.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [items, searchQuery, statusFilter]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {canManage && (
        <div className="flex justify-end">
          <Link
            data-testid="tournament-create-open"
            href="/events/new"
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            + สร้างทัวร์นาเมนต์
          </Link>
        </div>
      )}

      {publishError && (
        <div
          role="alert"
          data-testid="tournament-publish-error"
          className="p-3 text-sm rounded border border-destructive bg-destructive/10 text-destructive"
        >
          {publishError}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <div
            data-testid="tournament-skeleton"
            className="h-32 rounded-lg bg-muted animate-pulse"
          />
          <div
            data-testid="tournament-skeleton"
            className="h-32 rounded-lg bg-muted animate-pulse"
          />
          <div
            data-testid="tournament-skeleton"
            className="h-32 rounded-lg bg-muted animate-pulse"
          />
        </div>
      ) : isError ? (
        <div
          role="alert"
          data-testid="tournament-list-error"
          className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg border border-destructive bg-destructive/10 text-destructive text-sm"
        >
          <span>{thaiError(error, 'เกิดข้อผิดพลาดในการโหลดทัวร์นาเมนต์')}</span>
          <button
            type="button"
            data-testid="tournament-retry"
            onClick={() => refetch()}
            className="px-3 py-1.5 rounded bg-destructive text-destructive-foreground text-xs font-medium hover:opacity-90 cursor-pointer"
          >
            ลองใหม่
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 rounded-lg border border-dashed border-border gap-3 text-center">
          <p
            data-testid="tournament-empty"
            className="text-muted-foreground text-sm"
          >
            ยังไม่มีทัวร์นาเมนต์
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
            <input
              type="search"
              data-testid="tournament-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อทัวร์นาเมนต์"
              className="min-h-[44px] h-11 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring flex-1 w-full"
            />
            <select
              data-testid="tournament-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-h-[44px] h-11 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer sm:w-48 w-full"
            >
              <option value="">ทุกสถานะ</option>
              {availableStatuses.map((st) => (
                <option key={st} value={st}>
                  {STATUS_LABELS[st] ?? st}
                </option>
              ))}
            </select>
          </div>

          {filteredItems.length === 0 ? (
            <div
              data-testid="tournament-no-match"
              className="flex flex-col items-center justify-center p-8 rounded-lg border border-dashed border-border gap-3 text-center"
            >
              <p className="text-muted-foreground text-sm">
                ไม่พบทัวร์นาเมนต์ที่ตรงกับการค้นหา
              </p>
              <button
                type="button"
                onClick={handleClearFilters}
                className="min-h-[44px] px-4 py-2 text-xs font-medium rounded border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                ล้างตัวกรอง
              </button>
            </div>
          ) : (
            <div data-testid="tournament-list" className="flex flex-col gap-4">
              {filteredItems.map((tournament) => (
                <TournamentCardWithEvents
                  key={tournament.id}
                  tournament={tournament}
                  canManage={canManage}
                  onError={setPublishError}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TournamentList;
