'use client';

import React, { useState } from 'react';
import { thaiError } from '@/lib/errors';
import { useReportedMatches, useMatchDecision, type Match } from './api';

export interface ResultsQueueProps {
  eventId: string;
}

type MatchWithReportedByName = Match & {
  reportedByName?: string | null;
};

const STAGE_LABELS: Record<string, string> = {
  group: 'กลุ่ม',
  knockout: 'น็อคเอาท์',
  third_place: 'ชิงที่ 3',
};

const FLAG_LABELS: Record<string, string> = {
  UMPIRE_TEAM_CONFLICT: 'ผู้ตัดสินเกี่ยวข้องกับทีมในแมตช์',
  COMMITTEE_DIRECT_ENTRY: 'คณะกรรมการกรอกเอง',
  CORRECTED: 'แก้ไขผล',
};

function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  } catch {
    return isoString;
  }
}

function formatReportedMeta(reportedAt?: string | null, reportedByName?: string | null): string {
  const formattedTime = reportedAt ? formatDateTime(reportedAt) : '-';
  if (reportedByName) {
    return `รายงานเมื่อ ${formattedTime} โดย ${reportedByName}`;
  }
  return `รายงานเมื่อ ${formattedTime}`;
}

function formatOutcome(match: Match): string {
  const nameA = match.aEntry?.displayName || 'ฝ่าย A';
  const nameB = match.bEntry?.displayName || 'ฝ่าย B';

  if (match.result === 'a_win') return `ชนะ: ${nameA}`;
  if (match.result === 'b_win') return `ชนะ: ${nameB}`;
  if (match.result === 'draw') return 'เสมอ';
  if (match.result === 'walkover_a') return `ชนะโดยไม่ลงแข่ง: ${nameA}`;
  if (match.result === 'walkover_b') return `ชนะโดยไม่ลงแข่ง: ${nameB}`;

  if (match.status === 'walkover') {
    return `ชนะโดยไม่ลงแข่ง: ${nameA}`;
  }

  if (match.games && match.games.length > 0) {
    let aWins = 0;
    let bWins = 0;
    for (const g of match.games) {
      if ((g.a ?? 0) > (g.b ?? 0)) aWins++;
      else if ((g.b ?? 0) > (g.a ?? 0)) bWins++;
    }
    if (aWins > bWins) return `ชนะ: ${nameA}`;
    if (bWins > aWins) return `ชนะ: ${nameB}`;
    if (aWins === bWins && aWins > 0) return 'เสมอ';
  }

  return '';
}

function DialogMatchDetails({ match }: { match: Match }) {
  const nameA = match.aEntry?.displayName || 'ฝ่าย A';
  const nameB = match.bEntry?.displayName || 'ฝ่าย B';

  return (
    <div
      data-testid="result-dialog-match"
      className="space-y-1.5 text-sm border-b border-border pb-3"
    >
      <div className="font-semibold text-foreground">
        {nameA} พบ {nameB}
      </div>
      {match.games && match.games.length > 0 && (
        <div className="space-y-0.5 text-xs font-mono text-muted-foreground">
          {match.games.map((g, idx) => (
            <div key={idx}>
              {idx + 1}: {g.a ?? 0}–{g.b ?? 0}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ResultsQueue({ eventId }: ResultsQueueProps) {
  const { data: matches, isLoading, isError, error, refetch } = useReportedMatches(eventId);
  const decisionMutation = useMatchDecision(eventId);

  const [approveMatch, setApproveMatch] = useState<Match | null>(null);
  const [rejectMatch, setRejectMatch] = useState<Match | null>(null);
  const [rejectReason, setRejectReason] = useState('');

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
    setRejectReason('');
    setRejectMatch(match);
  };

  const handleRejectSubmit = (reason: string) => {
    if (!rejectMatch?.id) return;
    decisionMutation.mutate(
      { matchId: rejectMatch.id, action: 'reject', reason },
      {
        onSuccess: () => {
          setRejectMatch(null);
          setRejectReason('');
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
          className="min-h-[44px] px-4 py-2 text-sm font-medium rounded bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity cursor-pointer"
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
        const reportedByName = (match as MatchWithReportedByName).reportedByName;
        const outcome = formatOutcome(match);

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

              <div
                data-testid="result-meta"
                className="text-xs text-muted-foreground"
              >
                {formatReportedMeta(match.reportedAt, reportedByName)}
              </div>

              <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                <span>{nameA}</span>
                <span className="text-xs font-bold text-muted-foreground px-1">vs</span>
                <span>{nameB}</span>
              </div>

              {outcome && (
                <div
                  data-testid="result-outcome"
                  className="text-sm font-medium text-foreground"
                >
                  {outcome}
                </div>
              )}

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

              {match.flags && match.flags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {match.flags.map((flag) => {
                    const label = FLAG_LABELS[flag] || flag;
                    return (
                      <span
                        key={flag}
                        data-testid="result-flag"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border border-border bg-muted text-muted-foreground"
                      >
                        <svg
                          className="h-3.5 w-3.5 flex-shrink-0"
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
                        <span>{label}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                type="button"
                data-testid="result-reject"
                disabled={isPending}
                onClick={() => handleRejectClick(match)}
                className="min-h-[44px] px-4 py-2 text-sm font-medium rounded border border-border bg-card text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
              >
                ส่งกลับให้กรรมการ
              </button>
              <button
                type="button"
                data-testid="result-approve"
                disabled={isPending}
                onClick={() => handleApproveClick(match)}
                className="min-h-[44px] px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
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
          aria-labelledby="approve-dialog-title"
          className="fixed inset-0 flex items-center justify-center bg-background/80 z-50 p-4"
        >
          <div className="bg-background border border-border rounded-lg shadow-lg p-6 max-w-md w-full flex flex-col gap-4">
            <h2 id="approve-dialog-title" className="text-lg font-semibold text-foreground">
              ยืนยันผลแมตช์นี้?
            </h2>

            <DialogMatchDetails match={approveMatch} />

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
                className="min-h-[44px] px-4 py-2 text-sm rounded border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                data-testid="confirm-submit"
                disabled={isPending}
                onClick={handleApproveConfirm}
                className="min-h-[44px] px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
              >
                {isPending ? 'กำลังยืนยัน…' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Dialog */}
      {rejectMatch && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-dialog-title"
          className="fixed inset-0 flex items-center justify-center bg-background/80 z-50 p-4"
        >
          <div className="bg-background border border-border rounded-lg shadow-lg p-6 max-w-md w-full flex flex-col gap-4">
            <h2 id="reject-dialog-title" className="text-lg font-semibold text-foreground">
              ส่งกลับให้กรรมการ
            </h2>

            <DialogMatchDetails match={rejectMatch} />

            <div>
              <textarea
                data-testid="reason-input"
                aria-label="เหตุผล"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="ระบุเหตุผลในการส่งกลับ (อย่างน้อย 5 ตัวอักษร)"
                className="w-full px-3 py-2 border border-border rounded resize-none focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px] text-foreground bg-background text-sm"
              />
              <p className="text-sm text-muted-foreground mt-1" data-testid="reason-count">
                {rejectReason.trim().length}/5
              </p>
            </div>

            {decisionMutation.error && (
              <p role="alert" data-testid="reason-error" className="text-xs text-destructive">
                {thaiError(decisionMutation.error)}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                data-testid="reason-cancel"
                disabled={isPending}
                onClick={() => {
                  setRejectMatch(null);
                  setRejectReason('');
                }}
                className="min-h-[44px] px-4 py-2 text-sm rounded border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                data-testid="reason-submit"
                disabled={rejectReason.trim().length < 5 || isPending}
                onClick={() => handleRejectSubmit(rejectReason.trim())}
                className="min-h-[44px] px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isPending ? 'กำลังส่งกลับ…' : 'ส่งกลับ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
