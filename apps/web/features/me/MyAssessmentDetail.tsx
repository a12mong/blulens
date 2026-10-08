'use client';

import React from 'react';
import Link from 'next/link';
import { useAssessmentDetail } from '@/features/assessments/api';
import { formatEventLabel } from '@/features/assessments/ReviewerProgress';
import { ClipPlayer } from '@/components/ui/ClipPlayer';
import { GradeBand } from '@/components/ui/GradeBand';
import { thaiError } from '@/lib/errors';

export interface MyAssessmentDetailProps {
  id: string;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Member wording only: never the review count, reviewer identity, flags or "provisional"/"disputed".
function memberStatus(status: string | undefined, published: boolean): string {
  if (published) return 'ผลประกาศแล้ว';
  if (status === 'withdrawn' || status === 'rejected') return 'ยกเลิก';
  if (status === 'draft') return 'ฉบับร่าง (ยังไม่ได้ส่ง)';
  return 'อยู่ระหว่างตรวจ';
}

export function MyAssessmentDetail({ id }: MyAssessmentDetailProps) {
  const { data, isLoading, error, refetch } = useAssessmentDetail(id);

  if (isLoading) {
    return (
      <div role="status" data-testid="myassess-loading" className="p-6 text-center text-muted-foreground">
        กำลังโหลด…
      </div>
    );
  }

  if (error || !data) {
    const notFound = (error as { status?: number } | null)?.status === 404;
    return (
      <div role="alert" data-testid="myassess-error" className="p-6 border border-destructive rounded-lg bg-destructive/10 space-y-3">
        <p className="text-destructive font-medium">
          {notFound ? 'ไม่พบคำขอประเมินนี้' : thaiError(error, 'โหลดข้อมูลไม่สำเร็จ')}
        </p>
        {!notFound && (
          <button
            type="button"
            onClick={() => refetch()}
            className="min-h-[44px] px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            ลองใหม่
          </button>
        )}
      </div>
    );
  }

  const result = data.latestResult;
  const published = Boolean(result && result.status !== 'pending' && result.status !== 'superseded');
  const grade = published ? result?.grade : null;
  const clips = (data.clips ?? []).filter((c) => c.id);

  return (
    <div className="space-y-6">
      <section className="bg-card text-card-foreground border border-border rounded-lg p-4 sm:p-5 space-y-2">
        <h2 data-testid="myassess-event" className="font-bold text-lg">{formatEventLabel(data.event)}</h2>
        <p className="text-xs text-muted-foreground">วันที่สร้าง {formatDate(data.createdAt)}</p>
        <p data-testid="myassess-status" className="text-sm font-semibold">
          สถานะ: {memberStatus(data.status, published)}
        </p>
      </section>

      <section className="bg-card text-card-foreground border border-border rounded-lg p-4 sm:p-5 space-y-3">
        <h2 className="font-semibold">ผลประเมิน</h2>
        {grade ? (
          <div data-testid="myassess-grade" className="space-y-2">
            <GradeBand lower={grade.lower} upper={grade.upper} score={grade.score} label={grade.label} />
            <p className="text-sm">
              ระดับ {grade.label} · ช่วง {grade.lower}–{grade.upper}
            </p>
            {result?.source === 'override' && result.reason && (
              <p data-testid="myassess-reason" className="text-sm text-muted-foreground">
                คณะกรรมการปรับผล เหตุผล: {result.reason}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              ประกาศเมื่อ {formatDate(result?.computedAt)} (ครั้งที่ {result?.version})
            </p>
          </div>
        ) : (
          <p data-testid="myassess-pending" className="text-sm text-muted-foreground">
            ยังไม่มีผลประกาศ คณะกรรมการกำลังตรวจคำขอของคุณ
          </p>
        )}
      </section>

      <section className="bg-card text-card-foreground border border-border rounded-lg p-4 sm:p-5 space-y-3">
        <h2 className="font-semibold">คลิปที่ส่ง</h2>
        {clips.length > 0 ? (
          <div data-testid="myassess-clips">
            <ClipPlayer clips={clips} onRefreshNeeded={() => refetch()} />
          </div>
        ) : (
          <p data-testid="myassess-noclips" className="text-sm text-muted-foreground">ไม่มีคลิป</p>
        )}
      </section>

      <Link
        href="/me"
        className="inline-flex items-center min-h-[44px] px-4 py-2 border border-border rounded-md text-sm hover:bg-muted"
      >
        ← กลับไปหน้าของฉัน
      </Link>
    </div>
  );
}

export default MyAssessmentDetail;
