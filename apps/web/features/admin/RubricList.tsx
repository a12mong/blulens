'use client';

import { useState } from 'react';
import Link from 'next/link';
import { thaiError } from '@/lib/errors';
import {
  useRubrics,
  useCreateRubric,
  useDeleteRubric,
  type RubricDetail,
} from './api';

export function RubricList() {
  const { data: rubrics, isLoading, error, refetch } = useRubrics();
  const createMutation = useCreateRubric();
  const deleteMutation = useDeleteRubric();

  const [rubricName, setRubricName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string>('');
  const [deleteError, setDeleteError] = useState('');

  if (isLoading) {
    return <div data-testid="rubric-loading" role="status">กำลังโหลด...</div>;
  }

  if (error) {
    return (
      <div data-testid="rubric-error" role="alert" className="p-4 bg-destructive/10 border border-destructive rounded">
        <p className="text-destructive">{thaiError(error)}</p>
        <button
          onClick={() => refetch()}
          className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded min-h-[44px]"
        >
          ลองใหม่
        </button>
      </div>
    );
  }

  async function handleCreate() {
    if (!rubricName.trim()) return;
    try {
      await createMutation.mutateAsync({ name: rubricName });
      setRubricName('');
    } catch {
      // Error handled by mutation error state
    }
  }

  async function handleDelete(rubricId: string) {
    try {
      setDeleteError('');
      await deleteMutation.mutateAsync(rubricId);
      setDeleteConfirmId('');
    } catch (e) {
      const msg = thaiError(e, 'ลบรูบริกไม่สำเร็จ');
      setDeleteError(msg);
    }
  }

  return (
    <div className="p-4 space-y-6">
      {/* Create Form */}
      <div data-testid="rubric-create-form" className="p-4 border rounded bg-muted space-y-3">
        <label className="block">
          <span className="text-sm font-medium">ชื่อรูบริก</span>
          <input
            type="text"
            value={rubricName}
            onChange={(e) => setRubricName(e.currentTarget.value)}
            maxLength={100}
            placeholder="เช่น มาตรฐานแบดมินตัน v1"
            className="w-full mt-1 px-3 py-2 border border-input rounded bg-background"
          />
        </label>
        <button
          onClick={handleCreate}
          disabled={createMutation.isPending || !rubricName.trim()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded min-h-[44px] disabled:opacity-50"
          data-testid="rubric-create-btn"
        >
          {createMutation.isPending ? 'กำลังสร้าง…' : 'สร้าง'}
        </button>
      </div>

      {/* Rubrics List or Empty */}
      {rubrics && rubrics.length > 0 ? (
        <div className="grid gap-4">
          {rubrics.map((rubric) => (
            <div
              key={rubric.id}
              data-testid="rubric-card"
              className="p-4 border rounded-lg hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{rubric.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(rubric.createdAt).toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  {rubric.activatedAt && (
                    <span className="inline-block mt-2 px-2 py-1 text-xs bg-primary text-primary-foreground rounded">
                      กำลังใช้
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/admin/rubrics/${rubric.id}`}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded min-h-[44px] flex items-center"
                  >
                    แก้ไข
                  </Link>
                  <button
                    onClick={() => setDeleteConfirmId(rubric.id)}
                    disabled={rubric.activatedAt != null}
                    className="px-4 py-2 bg-destructive text-destructive-foreground rounded min-h-[44px] disabled:opacity-50"
                    data-testid="rubric-delete-btn"
                  >
                    ลบ
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div data-testid="rubric-empty" className="p-4 bg-muted rounded text-center text-muted-foreground">
          ยังไม่มีรูบริก
        </div>
      )}

      {/* Delete Confirm Dialog */}
      {deleteConfirmId ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4"
        >
          <div className="bg-background border border-border rounded-lg shadow-lg p-6 max-w-md w-full flex flex-col gap-4">
            <h2 className="text-lg font-semibold">ลบรูบริก</h2>
            <p className="text-sm text-muted-foreground">แน่ใจว่าต้องการลบรูบริกนี้?</p>
            {deleteError && (
              <p className="text-sm text-destructive">{deleteError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId('')}
                disabled={deleteMutation.isPending}
                className="min-h-[44px] px-4 py-2 text-sm rounded border border-input bg-background text-foreground hover:bg-muted disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                className="min-h-[44px] px-4 py-2 text-sm font-medium rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'กำลังลบ…' : 'ลบ'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
