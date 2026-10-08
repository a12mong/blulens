'use client';

import React from 'react';
import Link from 'next/link';
import { useAssessments } from '@/features/assessments/api';
import { formatEventLabel } from '@/features/assessments/ReviewerProgress';
import { GradeBand, type GradeKey } from '@/components/ui/GradeBand';
import { thaiError } from '@/lib/errors';
import type { components } from '@/lib/api/schema';

type Assessment = components['schemas']['Assessment'];

function formatCreatedDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getMemberStatusText(item: Assessment): string {
  if (item.latestGrade) {
    return 'ผลประกาศแล้ว';
  }
  const s = item.status?.toLowerCase();
  if (s === 'withdrawn' || s === 'void' || s === 'rejected') {
    return 'ยกเลิก';
  }
  return 'อยู่ระหว่างตรวจ';
}

function getCurrentStepIndex(item: Assessment): number {
  if (item.latestGrade) {
    return 2; // ผลประกาศ
  }
  const s = item.status?.toLowerCase();
  if (s === 'submitted' || s === 'draft') {
    return 0; // ส่งแล้ว
  }
  return 1; // กำลังตรวจ
}

const TIMELINE_STEPS = [
  { id: 'submitted', label: 'ส่งแล้ว' },
  { id: 'reviewing', label: 'กำลังตรวจ' },
  { id: 'published', label: 'ผลประกาศ' },
];

function MyResultCard({ item }: { item: Assessment }) {
  const statusText = getMemberStatusText(item);
  const currentStep = getCurrentStepIndex(item);
  const eventLabel = formatEventLabel(item.event);

  return (
    <article
      data-testid="myresult-card"
      className="bg-card text-card-foreground border border-border rounded-lg p-4 sm:p-5 flex flex-col gap-4 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
        <div>
          <h2 className="font-bold text-lg text-foreground">{eventLabel}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            วันที่สร้าง {formatCreatedDate(item.createdAt)}
          </p>
        </div>
        <div>
          <span
            data-testid="myresult-status"
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
              statusText === 'ผลประกาศแล้ว'
                ? 'bg-primary text-primary-foreground'
                : statusText === 'ยกเลิก'
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-secondary text-secondary-foreground border border-border'
            }`}
          >
            {statusText}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-1.5">
        <div
          data-testid="myresult-timeline"
          className="flex flex-wrap items-center gap-2 text-xs sm:text-sm"
        >
          {TIMELINE_STEPS.map((step, idx) => {
            const isCurrent = currentStep === idx;
            const isDone = currentStep > idx;

            return (
              <React.Fragment key={step.id}>
                {idx > 0 && (
                  <span className="text-muted-foreground" aria-hidden="true">
                    →
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : isDone
                        ? 'bg-muted text-foreground'
                        : 'bg-muted/50 text-muted-foreground'
                  }`}
                >
                  <span>{step.label}</span>
                  {isCurrent && <span className="text-xs font-semibold"> (ตอนนี้)</span>}
                </span>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Published Grade Band */}
      {item.latestGrade && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="text-sm font-medium text-foreground">
            {`ระดับ ${item.latestGrade.label ?? ''} · ช่วง ${item.latestGrade.lower ?? ''}–${item.latestGrade.upper ?? ''}`}
          </div>
          {item.latestGrade.lower && item.latestGrade.upper && typeof item.latestGrade.score === 'number' && (
            <GradeBand
              lower={item.latestGrade.lower as GradeKey}
              upper={item.latestGrade.upper as GradeKey}
              score={item.latestGrade.score}
              label={item.latestGrade.label}
            />
          )}
        </div>
      )}
      <Link
        href={`/me/assessments/${item.id}`}
        data-testid="myresult-open"
        className="inline-flex items-center justify-center self-start min-h-[44px] px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-muted"
      >
        ดูรายละเอียด
      </Link>
    </article>
  );
}

export function MyResults() {
  const queryResult = useAssessments();
  const { data, isPending, isError, error, refetch } = queryResult;
  const fetchNextPage = (queryResult as { fetchNextPage?: () => void }).fetchNextPage;

  if (isPending) {
    return (
      <div data-testid="myresult-loading" role="status" className="space-y-4 animate-pulse">
        <div className="h-28 bg-muted rounded-lg" />
        <div className="h-28 bg-muted rounded-lg" />
        <div className="h-28 bg-muted rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div
        data-testid="myresult-error"
        role="alert"
        className="p-4 border border-destructive/20 bg-destructive/10 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4"
      >
        <p className="text-destructive font-medium">{thaiError(error)}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="min-h-11 min-h-[44px] px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 transition-colors"
        >
          ลองใหม่
        </button>
      </div>
    );
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <div
        data-testid="myresult-empty"
        className="p-8 text-center border border-border rounded-lg bg-card text-card-foreground space-y-4"
      >
        <p className="text-muted-foreground text-base">คุณยังไม่มีผลประเมิน</p>
        <div>
          <Link
            href="/events"
            className="inline-flex items-center justify-center min-h-11 min-h-[44px] px-4 py-2 bg-primary text-primary-foreground font-medium text-sm rounded-md hover:bg-primary/90 transition-colors"
          >
            ดูอีเวนต์
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <MyResultCard key={item.id} item={item} />
      ))}

      {data?.nextCursor && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            data-testid="myresult-load-more"
            onClick={() => fetchNextPage?.()}
            className="min-h-11 min-h-[44px] px-6 py-2 border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md font-medium text-sm transition-colors inline-flex items-center justify-center"
          >
            โหลดเพิ่ม
          </button>
        </div>
      )}
    </div>
  );
}

export default MyResults;
