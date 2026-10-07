'use client';

import { useEffect, useRef } from 'react';
import type { Entry } from './api';

const warningLabels: Record<string, string> = {
  MULTI_TEAM: 'ผู้เล่นสังกัดหลายสโมสร',
  NO_APPROVED_GRADE: 'ผู้เล่นยังไม่มีเกรดที่อนุมัติ',
  GRADE_OUT_OF_BAND: 'เกรดอยู่นอกช่วงของประเภทนี้',
  FRESH_ASSESSMENT_REQUIRED: 'ต้องประเมินใหม่ก่อนลงแข่ง',
};

export interface ApproveConfirmDialogProps {
  entry: Entry;
  open: boolean;
  pending?: boolean;
  error?: string;
  onConfirm(): void;
  onCancel(): void;
}

export function ApproveConfirmDialog({
  entry,
  open,
  pending,
  error,
  onConfirm,
  onCancel,
}: ApproveConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
      onClick={() => !pending && onCancel()}
    >
      <dialog
        open={open}
        className="bg-background border border-border rounded-lg shadow-lg max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="approve-dialog-title"
      >
        <div className="p-6 space-y-4">
          <h2 id="approve-dialog-title" className="text-lg font-semibold">
            ยืนยันอนุมัติผู้สมัคร
          </h2>

          {/* Players section */}
          <div>
            <h3 className="font-medium text-sm mb-2">ผู้เล่น</h3>
            <ul className="space-y-2">
              {entry.players.map((player, idx) => (
                <li key={idx} className="text-sm">
                  <div className="font-medium">{player.displayName || '(ไม่มีชื่อ)'}</div>
                  <div className="text-muted-foreground">
                    {player.grade?.label || 'ยังไม่มีเกรด'}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Warnings section */}
          {entry.warnings && entry.warnings.length > 0 && (
            <div>
              <h3 className="font-medium text-sm mb-2">คำเตือน</h3>
              <ul className="list-disc list-inside space-y-1">
                {entry.warnings.map((warning) => (
                  <li key={warning} className="text-sm text-muted-foreground">
                    {warningLabels[warning] || warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div role="alert" className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end p-6 border-t border-border">
          <button
            onClick={onCancel}
            disabled={pending}
            className="px-4 py-2 text-sm rounded border border-border hover:bg-accent disabled:opacity-50"
            data-testid="approve-cancel"
          >
            ยกเลิก
          </button>
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            disabled={pending}
            className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            data-testid="approve-confirm"
          >
            ยืนยันอนุมัติ
          </button>
        </div>
      </dialog>
    </div>
  );
}

export default ApproveConfirmDialog;
