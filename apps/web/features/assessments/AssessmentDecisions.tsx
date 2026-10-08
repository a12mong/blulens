'use client';

import React, { useState } from 'react';
import type { GradeKey } from '@/components/ui/GradeBand';
import { GradePicker } from '@/components/ui/GradePicker';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { thaiError } from '@/lib/errors';
import * as assessmentApi from './api';
import type { AssessmentDetail } from './api';

export type AssessmentDecisionsProps = {
  detail: AssessmentDetail;
};

export function AssessmentDecisions({ detail }: AssessmentDecisionsProps) {
  const { id, status, latestResult } = detail;
  let useActionHook: typeof assessmentApi.useAssessmentAction | undefined;
  try {
    useActionHook = assessmentApi.useAssessmentAction;
  } catch {
    useActionHook = undefined;
  }
  const hookResult =
    typeof useActionHook === 'function' ? useActionHook(id) : null;
  const actionMutation = hookResult ?? {
    mutate: () => {},
    isPending: false,
    error: null,
    reset: () => {},
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveNote, setApproveNote] = useState('');
  const [returnOpen, setReturnOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideCenterKey, setOverrideCenterKey] = useState<GradeKey | null>(null);
  const [overrideReason, setOverrideReason] = useState('');

  // Status-based permissions
  const canConfirm = status === 'provisional';
  const canApprove = status === 'disputed' || status === 'pending_approval';
  const canReturn =
    status === 'provisional' ||
    status === 'disputed' ||
    status === 'pending_approval';
  const canOverride =
    status === 'provisional' ||
    status === 'disputed' ||
    status === 'pending_approval' ||
    status === 'approved' ||
    status === 'overridden';

  const hasAnyAction = canConfirm || canApprove || canReturn || canOverride;
  const isPending = actionMutation.isPending;

  const oldLabel = latestResult?.grade.label ?? 'ไม่ระบุ';
  const trimmedReason = overrideReason.trim();
  const isOverrideDisabled =
    !overrideCenterKey || trimmedReason.length < 20 || isPending;

  const handleConfirm = () => {
    actionMutation.mutate(
      { action: 'confirm' },
      {
        onSuccess: () => setConfirmOpen(false),
      },
    );
  };

  const handleApprove = () => {
    actionMutation.mutate(
      {
        action: 'approve',
        body: {
          note: approveNote.trim() || undefined,
          resultVersion: detail.latestResultVersion ?? undefined,
        },
      },
      {
        onSuccess: () => setApproveOpen(false),
      },
    );
  };

  const handleOverride = () => {
    if (!overrideCenterKey) return;
    actionMutation.mutate(
      {
        action: 'override',
        body: {
          centerKey: overrideCenterKey,
          reason: trimmedReason,
          resultVersion: detail.latestResultVersion ?? undefined,
        },
      },
      {
        onSuccess: () => setOverrideOpen(false),
      },
    );
  };

  if (!hasAnyAction) {
    return (
      <div className="p-4 rounded-lg border border-border bg-card text-card-foreground">
        <p className="text-sm text-muted-foreground">
          ยังไม่มีการตัดสินใจที่ทำได้ในสถานะนี้
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg border border-border bg-card text-card-foreground">
      {status === 'provisional' ? (
        <p className="text-xs text-muted-foreground">
          ยังไม่ใช้สมัคร/จัดสายจนกว่ายืนยัน
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {canConfirm ? (
          <button
            type="button"
            data-testid="decide-confirm"
            disabled={isPending}
            onClick={() => {
              actionMutation.reset();
              setConfirmOpen(true);
            }}
            className="min-h-[44px] px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
          >
            ยืนยันผล
          </button>
        ) : null}

        {canApprove ? (
          <button
            type="button"
            data-testid="decide-approve"
            disabled={isPending}
            onClick={() => {
              actionMutation.reset();
              setApproveNote('');
              setApproveOpen(true);
            }}
            className="min-h-[44px] px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
          >
            อนุมัติ
          </button>
        ) : null}

        {canReturn ? (
          <button
            type="button"
            data-testid="decide-return"
            disabled={isPending}
            onClick={() => {
              actionMutation.reset();
              setReturnOpen(true);
            }}
            className="min-h-[44px] px-4 py-2 text-sm font-medium rounded border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
          >
            ส่งกลับ
          </button>
        ) : null}

        {canOverride ? (
          <button
            type="button"
            data-testid="decide-override"
            disabled={isPending}
            onClick={() => {
              actionMutation.reset();
              setOverrideCenterKey(null);
              setOverrideReason('');
              setOverrideOpen(true);
            }}
            className="min-h-[44px] px-4 py-2 text-sm font-medium rounded border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
          >
            แก้ไขผล (Override)
          </button>
        ) : null}
      </div>

      {/* Confirm Dialog */}
      {confirmOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 flex items-center justify-center bg-background/80 z-50 p-4"
        >
          <div className="bg-background border border-border rounded-lg shadow-lg p-6 max-w-md w-full flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-foreground">
              ยืนยันผลที่ประเมินโดยกรรมการ 1 คน?
            </h2>
            {actionMutation.error ? (
              <p role="alert" className="text-xs text-destructive">
                {thaiError(actionMutation.error)}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="min-h-[44px] px-4 py-2 text-sm rounded border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                data-testid="confirm-submit"
                disabled={isPending}
                onClick={handleConfirm}
                className="min-h-[44px] px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
              >
                {isPending ? 'กำลังบันทึก…' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Approve Dialog */}
      {approveOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 flex items-center justify-center bg-background/80 z-50 p-4"
        >
          <div className="bg-background border border-border rounded-lg shadow-lg p-6 max-w-md w-full flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-foreground">
              อนุมัติผลการประเมิน
            </h2>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">
                หมายเหตุ (ไม่บังคับ)
              </label>
              <textarea
                data-testid="approve-note"
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                placeholder="ระบุหมายเหตุหากมี"
                className="min-h-[88px] p-2 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {actionMutation.error ? (
              <p role="alert" className="text-xs text-destructive">
                {thaiError(actionMutation.error)}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setApproveOpen(false)}
                className="min-h-[44px] px-4 py-2 text-sm rounded border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                data-testid="approve-submit"
                disabled={isPending}
                onClick={handleApprove}
                className="min-h-[44px] px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
              >
                {isPending ? 'กำลังบันทึก…' : 'อนุมัติ'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Return Dialog */}
      <ReasonDialog
        open={returnOpen}
        title="ส่งกลับให้รีวิวเพิ่ม"
        confirmLabel="ส่งกลับ"
        minLength={5}
        onSubmit={(reason) => {
          actionMutation.mutate(
            { action: 'return', body: { reason } },
            {
              onSuccess: () => setReturnOpen(false),
            },
          );
        }}
        onCancel={() => setReturnOpen(false)}
        error={
          actionMutation.error ? thaiError(actionMutation.error) : undefined
        }
        pending={isPending}
      />

      {/* Override Dialog */}
      {overrideOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 flex items-center justify-center bg-background/80 z-50 p-4"
        >
          <div className="bg-background border border-border rounded-lg shadow-lg p-6 max-w-lg w-full flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-foreground">
              แก้ไขผลการประเมิน (Override)
            </h2>

            <div className="text-sm font-medium text-foreground">
              ผลเดิม {oldLabel} → ผลใหม่ {overrideCenterKey ?? '-'}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">
                เลือกเกรดใหม่ (กึ่งกลาง)
              </label>
              <GradePicker
                variant="ladder"
                allowNA={false}
                value={overrideCenterKey}
                onChange={(k) => setOverrideCenterKey(k as GradeKey | null)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">
                  เหตุผลในการแก้ไข (อย่างน้อย 20 ตัวอักษร)
                </label>
                <span className="text-xs text-muted-foreground">
                  {trimmedReason.length}/20
                </span>
              </div>
              <textarea
                data-testid="override-reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="ระบุเหตุผลในการแก้ไขผลการประเมิน"
                className="min-h-[88px] p-2 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {actionMutation.error ? (
              <p role="alert" className="text-xs text-destructive">
                {thaiError(actionMutation.error)}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOverrideOpen(false)}
                className="min-h-[44px] px-4 py-2 text-sm rounded border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                data-testid="override-submit"
                disabled={isOverrideDisabled}
                onClick={handleOverride}
                className="min-h-[44px] px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
              >
                {isPending ? 'กำลังบันทึก…' : 'แก้ไขผล'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AssessmentDecisions;
