'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { thaiError } from '@/lib/errors';
import { MatchResultForm } from './MatchResultForm';
import { useUmpireMatches } from './api';
import type { MatchFormat } from './scoreRules';

export const DEFAULT_FORMATS: Record<'group' | 'knockout' | 'third_place', MatchFormat> = {
  group: {
    preset: 'group_2x15',
    mode: 'fixed_games',
    games: 2,
    pointsPerGame: 15,
    deuce: false,
    cap: null,
    drawAllowed: true,
  },
  knockout: {
    preset: 'bo3_21',
    mode: 'best_of',
    games: 3,
    pointsPerGame: 21,
    deuce: true,
    cap: 30,
    drawAllowed: false,
  },
  third_place: {
    preset: 'bo3_21',
    mode: 'best_of',
    games: 3,
    pointsPerGame: 21,
    deuce: true,
    cap: 30,
    drawAllowed: false,
  },
};

export type UmpireMatchPageProps = {
  id: string;
};

export function UmpireMatchPage({ id }: UmpireMatchPageProps) {
  const router = useRouter();
  const { data: matches, isLoading, isError, error } = useUmpireMatches();

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="กำลังโหลด"
        data-testid="umpire-match-skeleton"
        className="flex flex-col gap-4 animate-pulse"
      >
        <div className="h-24 bg-muted rounded-lg" />
        <div className="h-48 bg-muted rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        data-testid="umpire-match-error"
        className="p-4 rounded-lg border border-destructive bg-destructive/10 text-destructive text-sm"
      >
        {thaiError(error, 'เกิดข้อผิดพลาดในการโหลดแมตช์')}
      </div>
    );
  }

  const match = matches?.find((m) => m.id === id);

  if (!match) {
    return (
      <div
        data-testid="umpire-match-missing"
        className="p-6 rounded-lg border border-border bg-card text-card-foreground text-center"
      >
        <p className="text-muted-foreground">ไม่พบแมตช์นี้ หรือคุณไม่มีสิทธิ์</p>
      </div>
    );
  }

  const stage = match.stage ?? 'knockout';
  // the API resolves the stage format server-side (Match.format); constants are only a fallback for older responses
  const format =
    match.format ?? DEFAULT_FORMATS[stage as keyof typeof DEFAULT_FORMATS] ?? DEFAULT_FORMATS.knockout;

  return (
    <MatchResultForm
      match={match}
      format={format}
      onReported={() => {
        router.push('/umpire');
      }}
    />
  );
}
