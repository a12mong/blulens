'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ClipPlayer } from '@/components/ui/ClipPlayer';
import { RubricItemCard } from '@/features/review/RubricItemCard';
import { thaiError } from '@/lib/errors';
import { useAssignment, useSubmitReview } from './api';
import { useReviewDraft } from './useReviewDraft';
import type { components } from '@/lib/api/schema';
import type { GradeKey } from '@/components/ui/GradeBand';

type CriterionScore = components['schemas']['CriterionScore'];

interface ReviewScoringProps {
  id: string;
}

export function ReviewScoring({ id }: ReviewScoringProps) {
  const router = useRouter();
  const { data, isPending, isError, error, refetch } = useAssignment(id);
  const draft = useReviewDraft(id);
  const submit = useSubmitReview(id);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Prefill draft from myScores if draft is empty
  useEffect(() => {
    if (data?.myScores && Object.keys(draft.draft.scores).length === 0) {
      data.myScores.forEach((score) => {
        draft.setScore(score.criterion, score.gradeKey || null);
      });
    }
  }, [data?.myScores, draft]);

  if (isPending) {
    return (
      <div role="status" data-testid="scoring-loading" className="space-y-4 p-4">
        <div className="h-96 bg-secondary rounded animate-pulse" />
        <div className="h-12 bg-secondary rounded animate-pulse" />
        <div className="h-24 bg-secondary rounded animate-pulse" />
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" data-testid="scoring-error" className="bg-destructive/10 border border-destructive rounded p-4 space-y-3 m-4">
        <p className="text-destructive">{thaiError(error, 'เกิดข้อผิดพลาดในการโหลดงาน')}</p>
        <div className="flex gap-3">
          <button
            onClick={() => refetch()}
            className="inline-block min-h-[44px] px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
          >
            ลองใหม่
          </button>
          <Link
            href="/review"
            className="inline-block min-h-[44px] px-4 py-2 bg-secondary text-secondary-foreground rounded hover:opacity-90 transition-opacity"
          >
            ← คิว
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Read-only states
  if (data.state !== 'open') {
    const isExpired = data.state === 'expired';
    const heading = isExpired ? 'งานนี้หมดเวลาแล้ว' : 'ส่งผลประเมินแล้ว';

    return (
      <div className="space-y-6 p-4">
        <div>
          <h1 className="text-2xl font-bold mb-4">{heading}</h1>
          <ClipPlayer clips={(data.clips || []).filter((c) => c.id) as any} onRefreshNeeded={() => refetch()} />
        </div>

        {data.rubric?.criteria && (
          <div className="space-y-4">
            {data.rubric.criteria.map((criterion, index) => (
              <RubricItemCard
                key={criterion.key}
                index={index}
                criterion={criterion}
                value={
                  (data.myScores?.find((s) => s.criterion === criterion.key)?.gradeKey || null) as any
                }
                onChange={() => {}}
                readOnly
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Open state
  const criteria = data.rubric?.criteria || [];
  const answeredCount = criteria.filter((c) => draft.draft.scores[c.key] !== undefined).length;
  const isComplete = answeredCount === criteria.length && criteria.length > 0;

  const handleSubmitClick = () => {
    setShowConfirm(true);
    setSubmitError(null);
  };

  const handleConfirm = () => {
    const scores: CriterionScore[] = criteria.map((c) => ({
      criterion: c.key,
      gradeKey: (draft.draft.scores[c.key] || null) as any,
    }));

    submit.mutate(
      {
        scores,
        comment: draft.draft.comment || undefined,
      },
      {
        onSuccess: () => {
          draft.clear();
          router.push('/review');
        },
        onError: (err) => {
          setSubmitError(thaiError(err, 'เกิดข้อผิดพลาดในการส่งผลประเมิน'));
          setShowConfirm(false);
        },
      }
    );
  };

  return (
    <div className="space-y-6 p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">งาน #{id.substring(id.length - 4).toUpperCase()}</h1>
        <Link
          href="/review"
          className="text-primary hover:opacity-90 font-medium transition-opacity"
        >
          ← คิว
        </Link>
      </div>

      {/* Clip Player */}
      <ClipPlayer clips={(data.clips || []).filter((c) => c.id) as any} onRefreshNeeded={() => refetch()} />

      {/* Progress */}
      <div data-testid="scoring-progress" className="text-sm font-medium">
        ให้คะแนนแล้ว {answeredCount}/{criteria.length}
      </div>

      {/* Rubric Items */}
      {criteria.length > 0 && (
        <div className="space-y-4">
          {criteria.map((criterion, index) => (
            <RubricItemCard
              key={criterion.key}
              index={index}
              criterion={criterion}
              value={draft.draft.scores[criterion.key] as GradeKey | null | undefined}
              onChange={(gradeKey) => {
                draft.setScore(criterion.key, gradeKey);
              }}
              readOnly={false}
            />
          ))}
        </div>
      )}

      {/* Comment */}
      <div>
        <label htmlFor="comment" className="block text-sm font-medium mb-2">
          ความเห็นรวม
        </label>
        <textarea
          id="comment"
          data-testid="scoring-comment"
          value={draft.draft.comment}
          onChange={(e) => draft.setComment(e.currentTarget.value.slice(0, 2000))}
          maxLength={2000}
          className="w-full min-h-[100px] p-3 border border-border rounded bg-card text-card-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="เพิ่มความเห็นหรือหมายเหตุ (ไม่บังคับ)"
        />
      </div>

      {/* Draft Note */}
      <div data-testid="scoring-draft-note" className="text-xs text-muted-foreground bg-secondary/20 p-3 rounded">
        ร่างอยู่ในเครื่องนี้เท่านั้น
      </div>

      {/* Submit Error */}
      {submitError && (
        <div role="alert" data-testid="scoring-submit-error" className="bg-destructive/10 border border-destructive rounded p-3 text-destructive text-sm">
          {submitError}
        </div>
      )}

      {/* Sticky Submit Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 shadow-lg">
        <button
          data-testid="scoring-submit"
          onClick={handleSubmitClick}
          disabled={!isComplete || submit.isPending}
          className="w-full min-h-[44px] px-4 py-2 bg-primary text-primary-foreground rounded font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
        >
          ส่งและล็อก
        </button>
      </div>

      {/* Confirm Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div role="dialog" aria-modal="true" className="bg-card rounded-lg p-6 max-w-sm mx-4 space-y-4 shadow-lg">
            <p className="text-card-foreground">ส่งแล้วแก้ไขไม่ได้ ยืนยันหรือไม่</p>
            <div className="flex gap-3 justify-end">
              <button
                data-testid="scoring-cancel"
                onClick={() => setShowConfirm(false)}
                className="min-h-[44px] px-4 py-2 bg-secondary text-secondary-foreground rounded hover:opacity-90 transition-opacity font-medium"
              >
                ยกเลิก
              </button>
              <button
                data-testid="scoring-confirm"
                onClick={handleConfirm}
                disabled={submit.isPending}
                className="min-h-[44px] px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity disabled:opacity-50 font-medium"
              >
                ส่งและล็อก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
