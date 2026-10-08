'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { thaiError } from '@/lib/errors';
import {
  useActivateRubric,
  useCreateRubricDraft,
  useDeleteRubric,
  useRubrics,
  type Rubric,
} from './api';

const STATUS_TH: Record<string, string> = {
  draft: 'ฉบับร่าง',
  active: 'ใช้งานอยู่',
  retired: 'เลิกใช้แล้ว',
};

function formatDate(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function RubricList() {
  const { data, isLoading, error, refetch } = useRubrics();
  const create = useCreateRubricDraft();
  const del = useDeleteRubric();
  const activate = useActivateRubric();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activateId, setActivateId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div role="status" data-testid="rubric-loading" className="p-6 text-center text-muted-foreground">
        กำลังโหลด…
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" data-testid="rubric-error" className="p-6 border border-destructive rounded-lg bg-destructive/10 space-y-3">
        <p className="text-destructive font-medium">{thaiError(error, 'โหลดเกณฑ์ไม่สำเร็จ')}</p>
        <button type="button" onClick={() => refetch()} className="min-h-[44px] px-4 py-2 bg-primary text-primary-foreground rounded-md">
          ลองใหม่
        </button>
      </div>
    );
  }

  const rubrics: Rubric[] = data ?? [];
  const hasDraft = rubrics.some((r) => r.status === 'draft');

  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    setActionError(null);
    try {
      await fn();
      return true;
    } catch (err) {
      setActionError(thaiError(err, fallback));
      return false;
    }
  };

  return (
    <div className="space-y-4">
      {actionError && (
        <div role="alert" data-testid="rubric-action-error" className="p-3 border border-destructive rounded bg-destructive/10 text-destructive text-sm">
          {actionError}
        </div>
      )}

      {hasDraft ? (
        <p className="text-sm text-muted-foreground">มีฉบับร่างอยู่แล้ว</p>
      ) : (
        <button
          type="button"
          data-testid="rubric-new-draft"
          disabled={create.isPending}
          onClick={() => run(() => create.mutateAsync(), 'สร้างร่างไม่สำเร็จ')}
          className="min-h-[44px] px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium disabled:opacity-50"
        >
          สร้างร่างจากเกณฑ์ที่ใช้อยู่
        </button>
      )}

      {rubrics.length === 0 ? (
        <p className="p-6 text-center text-muted-foreground border border-border rounded-lg bg-card">ยังไม่มีเกณฑ์</p>
      ) : (
        rubrics.map((r) => (
          <article key={r.id} data-testid="rubric-card" className="bg-card text-card-foreground border border-border rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">เวอร์ชัน {r.methodVersion}</h2>
              <span data-testid="rubric-status" className="text-xs font-semibold px-3 py-1 rounded-full border border-border bg-secondary text-secondary-foreground">
                {STATUS_TH[r.status ?? ''] ?? r.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">สร้างเมื่อ {formatDate(r.createdAt)}</p>
            <p className="text-sm">
              เกณฑ์ {r.criteria.length} ข้อ: {r.criteria.map((c) => `${c.nameTh} (${c.weight})`).join(', ')}
            </p>
            {r.status === 'draft' && r.id && (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/committee/rubrics/${r.id}`}
                  data-testid="rubric-edit"
                  className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-muted"
                >
                  แก้ไข
                </Link>
                <button
                  type="button"
                  data-testid="rubric-activate"
                  onClick={() => setActivateId(r.id ?? null)}
                  className="min-h-[44px] px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
                >
                  เปิดใช้
                </button>
                <button
                  type="button"
                  data-testid="rubric-delete"
                  onClick={() => setDeleteId(r.id ?? null)}
                  className="min-h-[44px] px-4 py-2 border border-destructive text-destructive rounded-md text-sm font-medium"
                >
                  ลบร่าง
                </button>
              </div>
            )}
          </article>
        ))
      )}

      {deleteId && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
          <div className="bg-card text-card-foreground border border-border rounded-lg p-6 max-w-md w-full space-y-4">
            <p className="text-sm">ลบฉบับร่างนี้?</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteId(null)} className="min-h-[44px] px-4 py-2 border border-border rounded">
                ยกเลิก
              </button>
              <button
                type="button"
                data-testid="rubric-delete-confirm"
                disabled={del.isPending}
                onClick={async () => {
                  const id = deleteId;
                  setDeleteId(null);
                  await run(() => del.mutateAsync(id), 'ลบไม่สำเร็จ');
                }}
                className="min-h-[44px] px-4 py-2 bg-destructive text-destructive-foreground rounded disabled:opacity-50"
              >
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}

      <ReasonDialog
        open={activateId !== null}
        title="เปิดใช้เกณฑ์เวอร์ชันนี้ (เกณฑ์เดิมจะถูกเลิกใช้)"
        confirmLabel="เปิดใช้"
        minLength={5}
        pending={activate.isPending}
        onCancel={() => setActivateId(null)}
        onSubmit={async (reason) => {
          const id = activateId;
          if (!id) return;
          const ok = await run(() => activate.mutateAsync({ id, reason }), 'เปิดใช้ไม่สำเร็จ');
          if (ok) setActivateId(null);
        }}
      />
    </div>
  );
}
