'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { CheckIcon } from '@/components/ui/Icon';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { useStandings } from '@/features/bracket/api';
import { thaiError } from '@/lib/errors';
import {
  usePreviewKnockout,
  usePublishDraw,
  type Draw,
} from './knockoutApi';

export interface KnockoutDrawProps {
  eventId: string;
}

function generateRandomSeed(): string {
  let hex = '';
  for (let i = 0; i < 32; i++) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return hex;
}

function KnockoutDrawInner({ eventId }: KnockoutDrawProps) {
  const { data: standings } = useStandings(eventId);
  const previewMutation = usePreviewKnockout(eventId);
  const publishMutation = usePublishDraw();

  const [previewDraw, setPreviewDraw] = useState<Draw | null>(null);
  const [publishedDraw, setPublishedDraw] = useState<Draw | null>(null);
  const [rerollOpen, setRerollOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);

  // Group stage locked check: same condition as groupconfirm-done (standings rows with confirmed true)
  const isGroupsLocked = Boolean(
    standings && standings.length > 0 && standings.some((s) => s.confirmed),
  );

  if (!isGroupsLocked) {
    return null;
  }

  const isPublished = Boolean(
    publishedDraw ||
      (previewDraw && previewDraw.status === 'published') ||
      publishMutation.isSuccess,
  );

  const activeDraw = publishedDraw || previewDraw;

  const handlePreviewClick = () => {
    previewMutation.reset();
    previewMutation.mutate(undefined, {
      onSuccess: (draw) => {
        setPreviewDraw(draw);
      },
    });
  };

  const handleRerollSubmit = (reason: string) => {
    previewMutation.reset();
    previewMutation.mutate(
      { seed: generateRandomSeed(), reason },
      {
        onSuccess: (draw) => {
          setPreviewDraw(draw);
          setRerollOpen(false);
        },
      },
    );
  };

  const handlePublishConfirm = () => {
    if (!previewDraw?.id) return;
    publishMutation.reset();
    publishMutation.mutate(
      {
        drawId: previewDraw.id,
        eventId,
        ...(previewDraw.conflicts && previewDraw.conflicts.length > 0
          ? { acknowledgeConflicts: true }
          : {}),
      },
      {
        onSuccess: (draw) => {
          setPublishedDraw(draw);
          setPublishDialogOpen(false);
        },
      },
    );
  };

  return (
    <>
      <div
        data-testid="knockout-draw-panel"
        className="p-4 rounded-xl border border-border bg-card text-card-foreground flex flex-col gap-4"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-foreground">
              สายน็อกเอาต์ (Knockout Stage)
            </span>
            <span className="text-xs text-muted-foreground">
              จัดสายประกบคู่สำหรับรอบน็อกเอาต์จากอันดับในรอบกลุ่ม
            </span>
          </div>

          {isPublished ? (
            <div
              data-testid="knockout-published"
              className="flex items-center gap-2"
            >
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <CheckIcon className="w-4 h-4 text-primary" />
                <span>เผยแพร่สายน็อกเอาต์แล้ว</span>
              </div>
              <Link
                href={`/events/${eventId}/bracket`}
                className="min-h-[44px] inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                ดูผังสายแข่ง
              </Link>
            </div>
          ) : !activeDraw ? (
            <button
              type="button"
              data-testid="knockout-preview"
              disabled={previewMutation.isPending}
              onClick={handlePreviewClick}
              className="min-h-[44px] px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
            >
              {previewMutation.isPending ? 'กำลังจัดสาย…' : 'จัดสายน็อกเอาต์'}
            </button>
          ) : null}
        </div>

        {/* Error message from preview */}
        {previewMutation.error ? (
          <p role="alert" className="text-xs text-destructive">
            {thaiError(previewMutation.error)}
          </p>
        ) : null}

        {/* Preview Summary */}
        {activeDraw && !isPublished ? (
          <div className="flex flex-col gap-3 pt-2 border-t border-border">
            <div
              data-testid="knockout-preview-summary"
              className="p-3 rounded-lg border border-border bg-muted/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
            >
              <div className="text-sm font-medium text-foreground">
                ขนาดสาย: {activeDraw.size ?? 0} ทีม
                {activeDraw.size
                  ? ` (${Math.round(Math.log2(activeDraw.size))} รอบ)`
                  : ''}{' '}
                · ฉบับที่ {activeDraw.version}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="knockout-reroll"
                  disabled={previewMutation.isPending || publishMutation.isPending}
                  onClick={() => setRerollOpen(true)}
                  className="min-h-[44px] px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
                >
                  สุ่มสายใหม่
                </button>
                <button
                  type="button"
                  data-testid="knockout-publish"
                  disabled={publishMutation.isPending}
                  onClick={() => {
                    publishMutation.reset();
                    setPublishDialogOpen(true);
                  }}
                  className="min-h-[44px] px-4 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                >
                  เผยแพร่สายน็อกเอาต์
                </button>
              </div>
            </div>

            {/* Conflicts Warning */}
            {activeDraw.conflicts && activeDraw.conflicts.length > 0 ? (
              <div
                data-testid="knockout-preview-conflicts"
                className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-xs text-destructive flex flex-col gap-1"
              >
                <span className="font-semibold">พบทีมหรือกลุ่มที่ชนกันในรอบแรก:</span>
                <ul className="list-disc list-inside">
                  {activeDraw.conflicts.map((c, i) => (
                    <li key={i}>
                      {c.kind === 'group'
                        ? `คู่ที่ ${c.matchNo}: มาจากกลุ่มเดียวกัน (กลุ่ม ${c.groupLabel})`
                        : `คู่ที่ ${c.matchNo}: ทีมเดียวกัน`}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Pairings list from Draw.slots */}
            {activeDraw.slots && activeDraw.slots.length > 0 ? (
              <div
                data-testid="knockout-preview-pairings"
                className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1"
              >
                {Array.from({ length: Math.ceil(activeDraw.slots.length / 2) }).map(
                  (_, pairIdx) => {
                    const topSlot = activeDraw.slots?.[pairIdx * 2];
                    const bottomSlot = activeDraw.slots?.[pairIdx * 2 + 1];
                    const matchNo = pairIdx + 1;
                    return (
                      <div
                        key={matchNo}
                        data-testid="knockout-pairing-card"
                        className="p-2.5 rounded-lg border border-border bg-card text-xs flex flex-col gap-1.5"
                      >
                        <div className="font-semibold text-muted-foreground">
                          คู่ที่ {matchNo}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">
                            {topSlot?.entry?.displayName ??
                              (topSlot?.entryId ? topSlot.entryId : 'บาย')}
                          </span>
                          {topSlot?.source ? (
                            <span className="text-muted-foreground text-[11px]">
                              {topSlot.source.place === 1
                                ? `แชมป์กลุ่ม ${topSlot.source.groupLabel}`
                                : `อันดับ ${topSlot.source.place} กลุ่ม ${topSlot.source.groupLabel}`}
                            </span>
                          ) : null}
                        </div>
                        <div className="border-t border-border/50 my-0.5" />
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">
                            {bottomSlot?.entry?.displayName ??
                              (bottomSlot?.entryId ? bottomSlot.entryId : 'บาย')}
                          </span>
                          {bottomSlot?.source ? (
                            <span className="text-muted-foreground text-[11px]">
                              {bottomSlot.source.place === 1
                                ? `แชมป์กลุ่ม ${bottomSlot.source.groupLabel}`
                                : `อันดับ ${bottomSlot.source.place} กลุ่ม ${bottomSlot.source.groupLabel}`}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Reroll Reason Dialog */}
      <ReasonDialog
        open={rerollOpen}
        title="ระบุเหตุผลในการสุ่มสายใหม่"
        confirmLabel="สุ่มใหม่"
        minLength={5}
        pending={previewMutation.isPending}
        error={previewMutation.error ? thaiError(previewMutation.error) : undefined}
        onCancel={() => setRerollOpen(false)}
        onSubmit={handleRerollSubmit}
      />

      {/* Publish Confirm Dialog */}
      {publishDialogOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 flex items-center justify-center bg-background/80 z-50 p-4"
        >
          <div className="bg-background border border-border rounded-xl shadow-lg p-6 max-w-md w-full flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-foreground">
              ยืนยันการเผยแพร่สายน็อกเอาต์
            </h2>
            <p className="text-sm text-muted-foreground">
              เผยแพร่แล้วจะสร้างแมตช์น็อกเอาต์และเปลี่ยนไม่ได้
            </p>

            {publishMutation.error ? (
              <p role="alert" className="text-xs text-destructive">
                {thaiError(publishMutation.error)}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                data-testid="knockout-publish-cancel"
                onClick={() => setPublishDialogOpen(false)}
                className="min-h-[44px] px-4 py-2 text-sm rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                data-testid="knockout-publish-confirm"
                disabled={publishMutation.isPending}
                onClick={handlePublishConfirm}
                className="min-h-[44px] px-5 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
              >
                {publishMutation.isPending ? 'กำลังบันทึก…' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function KnockoutDraw({ eventId }: KnockoutDrawProps) {
  // Feature flag: rendered only when NEXT_PUBLIC_KNOCKOUT_UI === '1'
  if (process.env.NEXT_PUBLIC_KNOCKOUT_UI !== '1') {
    return null;
  }

  let hasClient = true;
  try {
    useQueryClient();
  } catch {
    hasClient = false;
  }

  if (!hasClient) {
    return null;
  }

  return <KnockoutDrawInner eventId={eventId} />;
}

export default KnockoutDraw;
