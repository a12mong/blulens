'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useEventMatches, useStandings } from '@/features/bracket/api';
import { thaiError } from '@/lib/errors';
import { useConfirmGroups } from './api';

export interface GroupStageConfirmProps {
  eventId: string;
}

function GroupStageConfirmInner({ eventId }: GroupStageConfirmProps) {
  const { data: matches } = useEventMatches(eventId);
  const { data: standings } = useStandings(eventId);
  const confirmMutation = useConfirmGroups ? useConfirmGroups(eventId) : null;

  const [dialogOpen, setDialogOpen] = useState(false);

  const groupMatches = matches?.filter((m) => m.stage === 'group') ?? [];

  // No group matches -> render nothing
  if (!matches || groupMatches.length === 0) {
    return null;
  }

  // Open = matches whose status is not confirmed/void/walkover
  const openMatches = groupMatches.filter(
    (m) => !['confirmed', 'void', 'walkover'].includes(m.status ?? ''),
  );
  const openCount = openMatches.length;
  const totalCount = groupMatches.length;
  const doneCount = totalCount - openCount;

  // If standings rows already have confirmed: true, show the done state immediately
  const isConfirmed = Boolean(
    confirmMutation?.isSuccess ||
      (standings && standings.length > 0 && standings.some((s) => s.confirmed)),
  );

  const qualifiers =
    standings?.filter((s) => s.qualification === 'qualified') ?? [];

  const isPending = confirmMutation?.isPending ?? false;

  const handleConfirmSubmit = () => {
    if (!confirmMutation) return;
    confirmMutation.mutate(undefined, {
      onSuccess: () => {
        setDialogOpen(false);
      },
    });
  };

  return (
    <>
      <div
        data-testid="groupconfirm"
        className="p-4 rounded-xl border border-border bg-card text-card-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-foreground">
            รอบกลุ่ม: ยืนยันแล้ว {doneCount} จาก {totalCount} แมตช์
          </span>
          {!isConfirmed && openCount > 0 ? (
            <span className="text-xs text-muted-foreground">
              ต้องยืนยันครบทุกแมตช์ก่อน (เหลือ {openCount})
            </span>
          ) : null}
        </div>

        {isConfirmed ? (
          <div
            data-testid="groupconfirm-done"
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
            <span>ล็อกผลรอบกลุ่มแล้ว</span>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <button
              type="button"
              data-testid="groupconfirm-button"
              disabled={openCount > 0 || isPending}
              onClick={() => {
                confirmMutation?.reset?.();
                setDialogOpen(true);
              }}
              className="min-h-[44px] px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ยืนยันผลรอบกลุ่ม
            </button>
          </div>
        )}
      </div>

      {dialogOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 flex items-center justify-center bg-background/80 z-50 p-4"
        >
          <div className="bg-background border border-border rounded-xl shadow-lg p-6 max-w-md w-full flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-foreground">
              ยืนยันผลรอบกลุ่มแล้วจะแก้ผลไม่ได้
            </h2>
            <p className="text-sm text-muted-foreground">
              เมื่อยืนยันแล้ว อันดับและคะแนนในรอบกลุ่มจะถือเป็นที่สิ้นสุดและไม่สามารถแก้ไขได้อีก
            </p>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">
                รายชื่อผู้ผ่านเข้ารอบ:
              </div>
              {qualifiers.length > 0 ? (
                <ul className="space-y-1.5 max-h-48 overflow-y-auto rounded-lg border border-border p-3 bg-muted/40">
                  {qualifiers.map((q, idx) => {
                    const name =
                      q.entry?.displayName ||
                      q.entry?.players?.map((p) => p.displayName).filter(Boolean).join(' / ') ||
                      q.entryId ||
                      'คู่แข่งขัน';
                    return (
                      <li
                        key={q.entryId || idx}
                        className="text-sm font-medium text-foreground flex items-center justify-between"
                      >
                        <span>{name}</span>
                        {q.rank ? (
                          <span className="text-xs text-muted-foreground">
                            อันดับ {q.rank}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">ไม่มีข้อมูลผู้ผ่านเข้ารอบ</p>
              )}
            </div>

            {confirmMutation?.error ? (
              <p role="alert" className="text-xs text-destructive">
                {thaiError(confirmMutation.error)}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                data-testid="groupconfirm-dialog-cancel"
                onClick={() => setDialogOpen(false)}
                className="min-h-[44px] px-4 py-2 text-sm rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                data-testid="groupconfirm-dialog-confirm"
                disabled={isPending}
                onClick={handleConfirmSubmit}
                className="min-h-[44px] px-5 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
              >
                {isPending ? 'กำลังบันทึก…' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function GroupStageConfirm({ eventId }: GroupStageConfirmProps) {
  let hasClient = true;
  try {
    useQueryClient();
  } catch {
    hasClient = false;
  }

  if (!hasClient) {
    return null;
  }

  return <GroupStageConfirmInner eventId={eventId} />;
}

export default GroupStageConfirm;
