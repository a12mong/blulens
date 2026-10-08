'use client';

import React, { useState } from 'react';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { thaiError } from '@/lib/errors';
import { useReportedMatches, useMatchDecision, type Match } from './api';

export interface ResultsQueueProps {
  eventId: string;
}

const STAGE_LABELS: Record<string, string> = {
  group: 'กลุ่ม',
  knockout: 'น็อคเอาท์',
  third_place: 'ชิงที่ 3',
};

export function ResultsQueue({ eventId }: ResultsQueueProps) {
  const { data: matches, isLoading, isError, error, refetch } = useReportedMatches(eventId);
  const decisionMutation = useMatchDecision(eventId);

  const [approveMatch, setApproveMatch] = useState<Match | null>(null);
  const [rejectMatch, setRejectMatch] = useState<Match | null>(null);

  const isPending = decisionMutation.isPending;

  const handleApproveClick = (match: Match) => {
    decisionMutation.reset();
    setApproveMatch(match);
  };

  const handleApproveConfirm = () => {
    if (!approveMatch?.id) return;
    decisionMutation.mutate(
      { matchId: approveMatch.id, action: 'approve' },
      {
        onSuccess: () => {
          setApproveMatch(null);
        },
      },
    );
  };

  const handleRejectClick = (match: Match) => {
    decisionMutation.reset();
    setRejectMatch(match);
  };

  const handleRejectSubmit = (reason: string) => {
    if (!rejectMatch?.id) return;
    decisionMutation.mutate(
      { matchId: rejectMatch.id, action: 'reject', reason },
      {
        onSuccess: () => {
          setRejectMatch(null);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div data-testid="results-loading" role="status" className="space-y-4 animate-pulse">
        <div className="h-20 bg-muted rounded-lg" />
        <div className="h-20 bg-muted rounded-lg" />
        <div className="h-20 bg-muted rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div
        data-testid="results-error"
        role="alert"
        className="p-4 rounded-lg border border-destructive bg-destructive/10 text-destructive flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <span className="text-sm font-medium">
          {thaiError(error, 'เกิดข้อผิดพลาดในการโหลดผลการแข่งขัน')}
        </span>
        <button
          type="button"
          onClick={() => refetch()}
          className="min-h-[44px] px-4 py-2 text-sm font-medium rounded bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity"
        >
          ลองใหม่
        </button>
      </div>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg bg-card">
        ไม่มีผลที่รอยืนยัน
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {matches.map((match) => {
        const nameA = match.aEntry?.displayName || 'ฝ่าย A';
        const nameB = match.bEntry?.displayName || 'ฝ่าย B';
        const isWalkover =
          match.result === 'walkover_a' ||
          match.result === 'walkover_b' ||
          match.status === 'walkover';

        const stageText = (match.stage && STAGE_LABELS[match.stage]) || match.stage || '';
        const roundText = match.round != null ? ` รอบ ${match.round}` : '';
        const courtText = match.court ? `สนาม ${match.court}` : null;

        const metaParts = [stageText + roundText, courtText].filter(Boolean);

        return (
          <div
            key={match.id}
            data-testid="result-row"
            className="p-4 rounded-lg border border-border bg-card text-card-foreground shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          >
            <div className="flex-1 space-y-1.5 w-full">
              {metaParts.length > 0 && (
                <div className="text-xs font-semibold text-muted-foreground">
                  {metaParts.join(' · ')}
                </div>
              )}

              <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                <span>{nameA}</span>
                <span className="text-xs font-bold text-muted-foreground px-1">vs</span>
                <span>{nameB}</span>
              </div>

              <div className="text-sm">
                {isWalkover ? (
                  <span className="font-medium text-foreground">ชนะโดยไม่ลงแข่ง</span>
                ) : match.games && match.games.length > 0 ? (
                  <span className="font-mono font-medium text-foreground">
                    {match.games.map((g) => `${g.a ?? 0}–${g.b ?? 0}`).join(', ')}
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                type="button"
                data-testid="result-reject"
                disabled={isPending}
                onClick={() => handleRejectClick(match)}
                className="min-h-[44px] px-4 py-2 text-sm font-medium rounded border border-border bg-card text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                ส่งกลับให้กรรมการ
              </button>
              <button
                type="button"
                data-testid="result-approve"
                disabled={isPending}
                onClick={() => handleApproveClick(match)}
                className="min-h-[44px] px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                ยืนยันผล
              </button>
            </div>
          </div>
        );
      })}

      {/* Confirm Approve Dialog */}
      {approveMatch && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 flex items-center justify-center bg-background/80 z-50 p-4"
        >
          <div className="bg-background border border-border rounded-lg shadow-lg p-6 max-w-md w-full flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-foreground">
              ยืนยันผลแมตช์นี้?
            </h2>

            <div className="text-sm text-muted-foreground">
              {approveMatch.aEntry?.displayName || 'ฝ่าย A'} vs{' '}
              {approveMatch.bEntry?.displayName || 'ฝ่าย B'}
            </div>

            {decisionMutation.error && (
              <p role="alert" className="text-xs text-destructive">
                {thaiError(decisionMutation.error)}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setApproveMatch(null)}
                className="min-h-[44px] px-4 py-2 text-sm rounded border border-border bg-card text-foreground hover:bg-muted transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                data-testid="confirm-submit"
                disabled={isPending}
                onClick={handleApproveConfirm}
                className="min-h-[44px] px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isPending ? 'กำลังยืนยัน…' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Dialog */}
      <ReasonDialog
        open={Boolean(rejectMatch)}
        title="ส่งกลับให้กรรมการ"
        confirmLabel="ส่งกลับ"
        minLength={5}
        pending={isPending}
        error={decisionMutation.error ? thaiError(decisionMutation.error) : undefined}
        onSubmit={handleRejectSubmit}
        onCancel={() => setRejectMatch(null)}
      />
    </div>
  );
}
