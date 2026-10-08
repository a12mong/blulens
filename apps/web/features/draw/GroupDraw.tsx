'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { thaiError } from '@/lib/errors';
import {
  useGroups,
  usePreviewGroups,
  usePublishDraw,
  type Draw,
} from './api';

export type GroupDrawProps = {
  eventId: string;
};

export function GroupDraw({ eventId }: GroupDrawProps) {
  const [currentDraw, setCurrentDraw] = useState<Draw | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [ackConflicts, setAckConflicts] = useState(false);
  const [conflictReason, setConflictReason] = useState('');
  const [showRerollDialog, setShowRerollDialog] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);

  // Queries for groups (preview or published)
  const publishedGroupsQuery = useGroups(eventId, 'published', {
    enabled: !currentDraw,
  });

  const previewGroupsQuery = useGroups(eventId, 'preview', {
    enabled: Boolean(currentDraw && !isPublished),
  });

  const effectivePublished =
    isPublished ||
    currentDraw?.status === 'published' ||
    (Boolean(publishedGroupsQuery.data && publishedGroupsQuery.data.length > 0) && !currentDraw);

  const previewMutation = usePreviewGroups(eventId, {
    onSuccess: (draw) => {
      setCurrentDraw(draw);
      setIsPublished(draw.status === 'published');
      setAckConflicts(false);
      setConflictReason('');
      setActionError(null);
      setShowRerollDialog(false);
    },
    onError: (err) => {
      setActionError(err);
    },
  });

  const publishMutation = usePublishDraw({
    onSuccess: (draw) => {
      setCurrentDraw(draw);
      setIsPublished(true);
      setShowPublishConfirm(false);
      setActionError(null);
    },
    onError: (err) => {
      setActionError(err);
    },
  });

  const handlePreview = () => {
    setActionError(null);
    previewMutation.mutate();
  };

  const handleReroll = (reason: string) => {
    setActionError(null);
    previewMutation.mutate({ reason });
  };

  const hasConflicts = Boolean(
    currentDraw &&
      ((currentDraw.sameTeamR1Count !== undefined && currentDraw.sameTeamR1Count > 0) ||
        (currentDraw.conflicts !== undefined && currentDraw.conflicts.length > 0))
  );

  const isPublishDisabled =
    publishMutation.isPending ||
    (hasConflicts && (!ackConflicts || conflictReason.trim().length < 5));

  const handleConfirmPublish = () => {
    if (!currentDraw) return;
    setActionError(null);
    publishMutation.mutate({
      drawId: currentDraw.id,
      eventId,
      acknowledgeConflicts: hasConflicts ? true : undefined,
      reason: hasConflicts ? conflictReason.trim() : undefined,
    });
  };

  const groups = effectivePublished
    ? publishedGroupsQuery.data
    : previewGroupsQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-foreground">การจับกลุ่ม</h2>
      </div>

      {Boolean(actionError) && (
        <div
          role="alert"
          data-testid="draw-error"
          className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm"
        >
          {thaiError(actionError)}
        </div>
      )}

      {effectivePublished ? (
        <div className="space-y-4">
          <div
            data-testid="draw-published"
            className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted text-foreground font-medium"
          >
            <span>✓ เผยแพร่แล้ว</span>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/events/${eventId}/standings`}
              className="inline-flex min-h-11 min-h-[44px] items-center rounded border border-border bg-card text-card-foreground px-4 text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
            >
              ตารางคะแนน
            </Link>
            <Link
              href={`/committee/events/${eventId}/results`}
              className="inline-flex min-h-11 min-h-[44px] items-center rounded border border-border bg-card text-card-foreground px-4 text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
            >
              ผลที่รอยืนยัน
            </Link>
          </div>
        </div>
      ) : !currentDraw ? (
        <div>
          <button
            type="button"
            data-testid="draw-preview"
            onClick={handlePreview}
            disabled={previewMutation.isPending}
            className="min-h-11 min-h-[44px] px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {previewMutation.isPending ? 'กำลังจับกลุ่ม…' : 'จับกลุ่ม'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div
            data-testid="draw-summary"
            className="p-4 rounded-lg border border-border bg-card text-card-foreground font-medium"
          >
            ขนาด {currentDraw.size ?? '-'} · ทีมเดียวกันชนรอบแรก {currentDraw.sameTeamR1Count ?? 0}
          </div>

          {hasConflicts && (
            <div
              data-testid="draw-conflicts"
              className="rounded-lg border border-warning/50 bg-warning/15 p-4 text-warning-foreground space-y-3"
            >
              <div className="flex items-center gap-2 font-medium">
                <span aria-hidden="true">⚠️</span>
                <span>
                  พบทีมเดียวกันชนกันรอบแรก (
                  {currentDraw.sameTeamR1Count ?? currentDraw.conflicts?.length ?? 1} คู่)
                </span>
              </div>
              {currentDraw.conflicts && currentDraw.conflicts.length > 0 && (
                <ul className="list-disc list-inside text-sm space-y-1">
                  {currentDraw.conflicts.map((c, i) => (
                    <li key={i}>
                      {c.teamId
                        ? `ทีม ${c.teamId} ชนกันในรอบแรก`
                        : `แมตช์ที่ ${c.matchNo ?? i + 1} ชนกันในรอบแรก`}
                    </li>
                  ))}
                </ul>
              )}
              <div className="pt-2 border-t border-warning/30 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="draw-ack-conflicts"
                    checked={ackConflicts}
                    onChange={(e) => setAckConflicts(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                  <span>รับทราบทีมที่ชนกัน</span>
                </label>
                <div>
                  <textarea
                    data-testid="draw-conflict-reason"
                    aria-label="เหตุผลการรับทราบ"
                    value={conflictReason}
                    onChange={(e) => setConflictReason(e.target.value)}
                    placeholder="ระบุเหตุผลการรับทราบทีมชนกัน (อย่างน้อย 5 ตัวอักษร)"
                    className="w-full min-h-[80px] p-2 text-sm rounded border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {conflictReason.trim().length}/5 ตัวอักษร
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              data-testid="draw-reroll"
              onClick={() => setShowRerollDialog(true)}
              disabled={previewMutation.isPending || publishMutation.isPending}
              className="min-h-11 min-h-[44px] px-4 py-2 rounded border border-border bg-card text-card-foreground font-medium hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
            >
              สุ่มใหม่
            </button>
            <button
              type="button"
              data-testid="draw-publish"
              onClick={() => setShowPublishConfirm(true)}
              disabled={isPublishDisabled}
              className="min-h-11 min-h-[44px] px-4 py-2 rounded bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              เผยแพร่
            </button>
          </div>
        </div>
      )}

      {/* Group Cards Preview */}
      {groups && groups.length > 0 && (
        <div data-testid="draw-groups" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((group, idx) => (
            <div
              key={group.id ?? idx}
              data-testid="group-card"
              className="rounded-lg border border-border bg-card p-4 space-y-3"
            >
              <h3 data-testid="group-title" className="font-semibold text-foreground">
                กลุ่ม {group.label ?? String.fromCharCode(65 + idx)}
              </h3>
              <ul className="divide-y divide-border text-sm">
                {group.members?.map((member, mIdx) => {
                  const entry = member.entry;
                  const playerNames =
                    entry?.players && entry.players.length > 0
                      ? entry.players.map((p) => p.displayName).join(' / ')
                      : `คู่ที่ ${mIdx + 1}`;
                  const clubText =
                    entry?.teamNames && entry.teamNames.length > 0
                      ? entry.teamNames.join(', ')
                      : null;

                  return (
                    <li
                      key={member.entryId ?? mIdx}
                      className="py-2 flex items-center justify-between gap-2"
                    >
                      <span className="font-medium text-foreground">{playerNames}</span>
                      {clubText && (
                        <span className="text-xs text-muted-foreground">{clubText}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Reroll Reason Dialog */}
      <ReasonDialog
        open={showRerollDialog}
        title="สุ่มจับกลุ่มใหม่"
        confirmLabel="สุ่มใหม่"
        minLength={5}
        pending={previewMutation.isPending}
        onSubmit={handleReroll}
        onCancel={() => setShowRerollDialog(false)}
      />

      {/* Publish Confirm Dialog */}
      {showPublishConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="publish-confirm-title"
          className="fixed inset-0 flex items-center justify-center bg-background/80 z-50 p-4"
        >
          <div className="bg-card text-card-foreground border border-border rounded-lg shadow-lg p-6 max-w-md w-full">
            <h2 id="publish-confirm-title" className="text-lg font-semibold mb-2">
              ยืนยันการเผยแพร่การจับกลุ่ม
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              เผยแพร่แล้วจะสร้างแมตช์และจับกลุ่มใหม่ไม่ได้
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                data-testid="cancel-publish"
                onClick={() => setShowPublishConfirm(false)}
                disabled={publishMutation.isPending}
                className="min-h-11 min-h-[44px] px-4 py-2 border border-border rounded bg-muted text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                data-testid="confirm-publish"
                onClick={handleConfirmPublish}
                disabled={publishMutation.isPending}
                className="min-h-11 min-h-[44px] px-4 py-2 rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium disabled:opacity-50 cursor-pointer"
              >
                {publishMutation.isPending ? 'กำลังเผยแพร่…' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
