'use client';

import { useEffect, useRef, useState } from 'react';

export type ReasonDialogProps = {
  open: boolean;
  title: string;
  confirmLabel: string;
  minLength?: number;
  onSubmit: (reason: string) => void;
  onCancel: () => void;
  error?: string;
  pending?: boolean;
};

export function ReasonDialog({
  open,
  title,
  confirmLabel,
  minLength = 1,
  onSubmit,
  onCancel,
  error,
  pending = false,
}: ReasonDialogProps) {
  const [reason, setReason] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      textareaRef.current?.focus();
    }
  }, [open]);

  const trimmedReason = reason.trim();
  const isDisabled = trimmedReason.length < minLength || pending;

  const handleSubmit = () => {
    onSubmit(trimmedReason);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reason-dialog-title"
      className="fixed inset-0 flex items-center justify-center bg-background/80 z-50"
    >
      <div className="bg-background border border-border rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
        <h2 id="reason-dialog-title" className="text-lg font-semibold mb-4">
          {title}
        </h2>

        <textarea
          ref={textareaRef}
          data-testid="reason-input"
          aria-label="เหตุผล"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-2 border border-border rounded resize-none focus:outline-none focus:ring-2 focus:ring-primary mb-2 min-h-[100px]"
        />

        <p className="text-sm text-muted-foreground mb-4" data-testid="reason-count">
          {trimmedReason.length}/{minLength}
        </p>

        {error && (
          <p role="alert" data-testid="reason-error" className="text-red-600 text-sm mb-4">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            data-testid="reason-cancel"
            onClick={onCancel}
            className="px-4 py-2 text-foreground bg-muted border border-border rounded hover:bg-muted-foreground/20 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            data-testid="reason-submit"
            onClick={handleSubmit}
            disabled={isDisabled}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReasonDialog;
