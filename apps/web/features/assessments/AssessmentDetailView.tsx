'use client';

import Link from 'next/link';
import React from 'react';
import { ClipPlayer } from '@/components/ui/ClipPlayer';
import { GradeBand, type GradeKey } from '@/components/ui/GradeBand';
import { thaiError } from '@/lib/errors';
import { AssessmentStatusBadge } from './AssessmentStatusBadge';
import { AssessmentDecisions } from './AssessmentDecisions';
import { AssignReviewers } from './AssignReviewers';
import { useAssessmentDetail } from './api';

export const FLAG_LABELS: Record<string, string> = {
  OUTLIER_EXCLUDED: 'ค่าผิดปกติถูกตัดออก',
  HIGH_DISAGREEMENT: 'กรรมการเห็นต่างกันมาก',
  LOW_RATER_COUNT: 'จำนวนกรรมการน้อย',
  OVERRIDE: 'แก้ไขโดยคณะกรรมการ',
  SINGLE_REVIEWER: 'ประเมินโดยกรรมการ 1 คน',
  PAIR_DISAGREEMENT: 'คู่กรรมการเห็นต่างกัน',
};

export type AssessmentDetailViewProps = {
  id: string;
};

export function AssessmentDetailView({ id }: AssessmentDetailViewProps) {
  const { data, isLoading, isError, error, refetch } = useAssessmentDetail(id);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-4xl mx-auto w-full">
        <Link
          href="/committee/assessments"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
        >
          ← รายการผลประเมิน
        </Link>
        <div
          role="status"
          data-testid="detail-loading"
          className="flex flex-col gap-4 animate-pulse"
        >
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-40 rounded-lg bg-muted" />
          <div className="h-48 rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-4xl mx-auto w-full">
        <Link
          href="/committee/assessments"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
        >
          ← รายการผลประเมิน
        </Link>
        <div
          role="alert"
          data-testid="detail-error"
          className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg border border-destructive bg-destructive/10 text-destructive text-sm"
        >
          <span>{thaiError(error, 'เกิดข้อผิดพลาดในการโหลดผลประเมิน')}</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="min-h-[44px] px-4 py-2 rounded bg-destructive text-destructive-foreground text-xs font-medium hover:opacity-90 cursor-pointer"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  const { subject, status, latestResult, clips, reviewerRows } = data;
  const grade = latestResult?.grade;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-4xl mx-auto w-full">
      {/* Back link */}
      <div>
        <Link
          href="/committee/assessments"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
        >
          ← รายการผลประเมิน
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">
          {subject?.displayName ?? 'ไม่ระบุ'}
        </h1>
        <AssessmentStatusBadge status={status} />
      </div>

      {/* Result block */}
      <div
        data-testid="detail-result"
        className="p-4 rounded-lg border border-border bg-card text-card-foreground flex flex-col gap-3"
      >
        {latestResult && grade ? (
          <>
            <GradeBand
              lower={grade.lower as GradeKey}
              upper={grade.upper as GradeKey}
              score={grade.score}
              label={grade.label}
              provisional={status === 'provisional'}
              disputed={status === 'disputed'}
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>
                คะแนน {grade.score.toFixed(2)} ±{' '}
                {grade.margin !== undefined && grade.margin !== null
                  ? grade.margin.toFixed(2)
                  : '0.00'}
              </span>
              <span>
                ผู้ประเมินที่ใช้ {latestResult.nRaters} · ตัดออก{' '}
                {latestResult.nExcluded}
              </span>
              {latestResult.spread !== undefined && latestResult.spread !== null ? (
                <span>ส่วนต่าง {latestResult.spread.toFixed(2)}</span>
              ) : null}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">ยังสรุปไม่ได้</p>
        )}
      </div>

      {/* Decisions */}
      <AssessmentDecisions detail={data} />

      {/* Assign Reviewers */}
      <AssignReviewers detail={data} />

      {/* Flags */}
      <div data-testid="detail-flags" className="flex flex-col gap-2">
        {latestResult?.flags && latestResult.flags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {latestResult.flags.map((flag) => (
              <span
                key={flag}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border border-border"
              >
                {FLAG_LABELS[flag] ?? flag}
              </span>
            ))}
          </div>
        ) : null}
        {latestResult?.source === 'override' && latestResult.reason ? (
          <p className="text-sm text-muted-foreground">
            เหตุผล: {latestResult.reason}
          </p>
        ) : null}
      </div>

      {/* Clips */}
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-foreground">คลิป</h2>
        {clips && clips.length > 0 ? (
          <ClipPlayer
            clips={clips.map((c) => ({
              id: c.id ?? '',
              status: c.status ?? 'uploaded',
              viewUrl: c.viewUrl,
              durationSec: c.durationSec,
            }))}
            onRefreshNeeded={() => refetch()}
          />
        ) : (
          <p className="text-sm text-muted-foreground">ยังไม่มีคลิป</p>
        )}
      </section>

      {/* Reviewer rows table */}
      {reviewerRows && reviewerRows.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-foreground">ผู้ประเมิน</h2>
          <div className="overflow-x-auto w-full border border-border rounded-lg bg-card">
            <table
              data-testid="detail-reviewers"
              className="w-full text-left text-sm border-collapse min-w-[500px]"
            >
              <thead>
                <tr className="border-b border-border bg-muted/50 text-muted-foreground text-xs">
                  <th className="p-3">กรรมการ</th>
                  <th className="p-3">คะแนนรวม</th>
                  <th className="p-3">สถานะ</th>
                  <th className="p-3">Bias</th>
                  <th className="p-3">Pair Kappa</th>
                  <th className="p-3">หัวข้อย่อย</th>
                </tr>
              </thead>
              <tbody>
                {reviewerRows.map((row, idx) => (
                  <tr
                    key={row.reviewerId ?? idx}
                    data-testid="detail-reviewer-row"
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="p-3 font-medium text-foreground">
                      {row.reviewerName ?? 'ไม่ระบุ'}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {row.overall !== undefined ? row.overall.toFixed(2) : '-'}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {row.excluded ? 'ตัดออก' : 'ใช้'}
                      {row.robustZ !== null && row.robustZ !== undefined
                        ? ` z=${row.robustZ.toFixed(1)}`
                        : ''}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {row.reviewerBias !== null && row.reviewerBias !== undefined
                        ? `${row.reviewerBias > 0 ? `+${row.reviewerBias.toFixed(1)}` : row.reviewerBias.toFixed(1)} ขั้น`
                        : '-'}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {row.pairKappa !== null && row.pairKappa !== undefined
                        ? `κ ${row.pairKappa.toFixed(2)}`
                        : '-'}
                    </td>
                    <td className="p-3">
                      {row.criteria && row.criteria.length > 0 ? (
                        <details className="cursor-pointer">
                          <summary className="text-xs text-muted-foreground hover:text-foreground">
                            ต่อหัวข้อ
                          </summary>
                          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                            {row.criteria.map((c) => (
                              <li key={c.criterion}>
                                {c.criterion}: {c.gradeKey ?? 'ประเมินไม่ได้'}
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default AssessmentDetailView;
