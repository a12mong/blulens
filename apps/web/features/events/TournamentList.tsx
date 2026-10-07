'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import { useMe } from '@/features/auth/api';
import type { components } from '@/lib/api/schema';
import { TournamentCard } from './TournamentCard';
import {
  useEvents,
  useSetTournamentStatus,
  type Tournament,
} from './api';
import { useTournamentsInfinite } from './tournamentsInfinite';

export type TournamentDetail = components['schemas']['TournamentDetail'];

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
          onError(err.message || 'ไม่สามารถเปิดรับสมัครได้');
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

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useTournamentsInfinite();
  const [publishError, setPublishError] = useState<string | null>(null);

  const items = data?.pages.flatMap((page) => page.items) ?? [];

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
          <span>{error?.message || 'เกิดข้อผิดพลาดในการโหลดทัวร์นาเมนต์'}</span>
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
        <div data-testid="tournament-list" className="flex flex-col gap-4">
          {items.map((tournament) => (
            <TournamentCardWithEvents
              key={tournament.id}
              tournament={tournament}
              canManage={canManage}
              onError={setPublishError}
            />
          ))}

          {hasNextPage && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                data-testid="tournament-load-more"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                โหลดเพิ่ม
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TournamentList;
