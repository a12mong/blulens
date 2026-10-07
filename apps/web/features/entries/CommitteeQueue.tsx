'use client';

import React, { useState } from 'react';
import { ApproveConfirmDialog } from './ApproveConfirmDialog';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { EntryTable } from './EntryTable';
import {
  useApproveEntry,
  useCommitteeQueue,
  useRejectEntry,
  type Entry,
} from './api';
import { thaiError } from '@/lib/errors';

export type CommitteeQueueProps = {
  eventId?: string;
};

type ActiveDialog =
  | { type: 'approve_confirm'; entry: Entry }
  | { type: 'approve_out_of_band'; entry: Entry }
  | { type: 'reject'; entry: Entry };

export function CommitteeQueue({ eventId }: CommitteeQueueProps) {
  const { data, isPending, isError, error: queryError } = useCommitteeQueue(eventId);
  const approveMutation = useApproveEntry();
  const rejectMutation = useRejectEntry();

  const [actionError, setActionError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ActiveDialog | null>(null);
  const [dialogError, setDialogError] = useState<string | undefined>(undefined);

  if (isPending) {
    return (
      <div role="status" className="text-sm text-muted-foreground">
        กำลังโหลด…
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        data-testid="queue-error"
        className="text-sm text-destructive"
      >
        {thaiError(queryError, 'เกิดข้อผิดพลาดในการโหลดคิว')}
      </div>
    );
  }

  const items: Entry[] = Array.isArray(data)
    ? data
    : ((data as unknown as { items?: Entry[] })?.items ?? []);

  const handleApprove = (entry: Entry) => {
    const isOutOfBand = entry.warnings?.includes('GRADE_OUT_OF_BAND');
    setActionError(null);
    setDialogError(undefined);
    if (isOutOfBand) {
      setDialog({ type: 'approve_out_of_band', entry });
    } else {
      setDialog({ type: 'approve_confirm', entry });
    }
  };

  const handleReject = (entry: Entry) => {
    setActionError(null);
    setDialogError(undefined);
    setDialog({ type: 'reject', entry });
  };

  const handleApproveConfirmed = (entry: Entry) => {
    approveMutation.mutate(
      { entryId: entry.id },
      {
        onSuccess: () => {
          setDialog(null);
          setDialogError(undefined);
        },
        onError: (err) => {
          setDialogError(thaiError(err, 'เกิดข้อผิดพลาดในการอนุมัติ'));
        },
      },
    );
  };

  const handleApproveWithReason = (entry: Entry, reason: string) => {
    approveMutation.mutate(
      { entryId: entry.id, reason },
      {
        onSuccess: () => {
          setDialog(null);
          setDialogError(undefined);
        },
        onError: (err) => {
          setDialogError(thaiError(err, 'เกิดข้อผิดพลาดในการอนุมัติ'));
        },
      },
    );
  };

  const handleRejectWithReason = (entry: Entry, reason: string) => {
    rejectMutation.mutate(
      { entryId: entry.id, reason },
      {
        onSuccess: () => {
          setDialog(null);
          setDialogError(undefined);
        },
        onError: (err) => {
          setDialogError(thaiError(err, 'เกิดข้อผิดพลาดในการปฏิเสธ'));
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {actionError ? (
        <p
          role="alert"
          data-testid="queue-action-error"
          className="text-sm text-destructive"
        >
          {actionError}
        </p>
      ) : null}

      <EntryTable
        entries={items}
        mode="committee"
        onApprove={handleApprove}
        onReject={handleReject}
      />

      {dialog?.type === 'approve_confirm' ? (
        <ApproveConfirmDialog
          entry={dialog.entry}
          open={true}
          pending={approveMutation.isPending}
          error={dialogError}
          onConfirm={() => handleApproveConfirmed(dialog.entry)}
          onCancel={() => {
            setDialog(null);
            setDialogError(undefined);
          }}
        />
      ) : null}

      {dialog && (dialog.type === 'approve_out_of_band' || dialog.type === 'reject') ? (
        <ReasonDialog
          open={true}
          title={
            dialog.type === 'approve_out_of_band'
              ? 'อนุมัติเกรดนอกช่วง'
              : 'ปฏิเสธผู้สมัคร'
          }
          confirmLabel={
            dialog.type === 'approve_out_of_band' ? 'อนุมัติ' : 'ปฏิเสธ'
          }
          minLength={dialog.type === 'approve_out_of_band' ? 20 : 10}
          onSubmit={(reason) => {
            if (dialog.type === 'approve_out_of_band') {
              handleApproveWithReason(dialog.entry, reason);
            } else {
              handleRejectWithReason(dialog.entry, reason);
            }
          }}
          onCancel={() => {
            setDialog(null);
            setDialogError(undefined);
          }}
          error={dialogError}
          pending={
            dialog.type === 'approve_out_of_band'
              ? approveMutation.isPending
              : rejectMutation.isPending
          }
        />
      ) : null}
    </div>
  );
}

export default CommitteeQueue;
