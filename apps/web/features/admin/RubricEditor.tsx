'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { thaiError } from '@/lib/errors';
import {
  useRubric,
  useUpdateRubric,
  useCopyRubric,
  type RubricItem,
} from './api';

export function RubricEditor({ rubricId }: { rubricId: string }) {
  const router = useRouter();
  const { data: rubric, isLoading, error, refetch } = useRubric(rubricId);
  const updateMutation = useUpdateRubric(rubricId);
  const copyMutation = useCopyRubric();

  const [items, setItems] = useState<RubricItem[]>([]);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [isDirty, setIsDirty] = useState(false);
  const [editError, setEditError] = useState('');

  // Initialize items when rubric loads
  if (rubric && items.length === 0) {
    setItems(rubric.criteria || []);
  }

  if (isLoading) {
    return <div data-testid="editor-loading" role="status">กำลังโหลด...</div>;
  }

  if (error) {
    return (
      <div data-testid="editor-error" role="alert" className="p-4 bg-destructive/10 border border-destructive rounded">
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

  if (!rubric) return <div>ไม่พบรูบริก</div>;

  const isInUse = rubric.activatedAt != null;
  const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0), 0);
  const canSave = totalWeight === 100 && items.every((item) => item.nameTh.trim());

  async function handleSave() {
    if (!canSave) return;
    try {
      setEditError('');
      await updateMutation.mutateAsync({ criteria: items });
      setIsDirty(false);
    } catch (e) {
      setEditError(thaiError(e, 'บันทึกไม่สำเร็จ'));
    }
  }

  async function handleCopy() {
    try {
      setEditError('');
      const newRubric = await copyMutation.mutateAsync({
        copyFrom: rubricId,
        name: `${rubric.name} (สำเนา)`,
      });
      router.push(`/admin/rubrics/${newRubric.id}`);
    } catch (e) {
      setEditError(thaiError(e, 'สร้างสำเนาไม่สำเร็จ'));
    }
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">{rubric.name}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date(rubric.createdAt).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </p>
        {isInUse && (
          <span className="inline-block mt-2 px-2 py-1 text-xs bg-primary text-primary-foreground rounded">
            กำลังใช้
          </span>
        )}
      </div>

      {/* Error */}
      {editError && (
        <div role="alert" className="p-3 bg-destructive/10 border border-destructive rounded text-destructive text-sm">
          {editError}
        </div>
      )}

      {/* Read-only message if in use */}
      {isInUse && (
        <div className="p-3 bg-muted border border-border rounded text-sm">
          ชุดนี้กำลังใช้ แก้ไขไม่ได้ ใช้ปุ่ม "ทำสำเนา" เพื่อสร้างเวอร์ชันใหม่
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setTab('edit')}
          className={`px-4 py-2 ${tab === 'edit' ? 'border-b-2 border-primary font-semibold' : 'text-muted-foreground'}`}
        >
          แก้ไข
        </button>
        <button
          onClick={() => setTab('preview')}
          className={`px-4 py-2 ${tab === 'preview' ? 'border-b-2 border-primary font-semibold' : 'text-muted-foreground'}`}
        >
          ตัวอย่าง
        </button>
      </div>

      {/* Edit Mode */}
      {tab === 'edit' && (
        <div data-testid="editor-edit-mode" className="space-y-4">
          {/* Items List */}
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="p-3 border rounded flex gap-2 items-end">
                <div className="w-8 text-center text-sm font-medium">{idx + 1}</div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">ชื่อ</label>
                  <input
                    type="text"
                    value={item.nameTh}
                    onChange={(e) => {
                      const updated = [...items];
                      updated[idx].nameTh = e.currentTarget.value;
                      setItems(updated);
                      setIsDirty(true);
                    }}
                    maxLength={40}
                    placeholder="เช่น ฟอร์มการตี"
                    disabled={isInUse}
                    className="w-full px-2 py-1 border border-input rounded bg-background text-sm disabled:opacity-50"
                  />
                </div>
                <div className="w-20">
                  <label className="text-xs text-muted-foreground">น้ำหนัก %</label>
                  <input
                    type="number"
                    value={item.weight}
                    onChange={(e) => {
                      const updated = [...items];
                      updated[idx].weight = parseFloat(e.currentTarget.value) || 0;
                      setItems(updated);
                      setIsDirty(true);
                    }}
                    min="0"
                    disabled={isInUse}
                    className="w-full px-2 py-1 border border-input rounded bg-background text-sm disabled:opacity-50"
                  />
                </div>
                {!isInUse && (
                  <button
                    onClick={() => {
                      const updated = items.filter((_, i) => i !== idx);
                      setItems(updated);
                      setIsDirty(true);
                    }}
                    className="px-2 py-1 text-destructive text-sm"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add Item Button */}
          {!isInUse && (
            <button
              onClick={() => {
                setItems([...items, { key: '', nameTh: '', weight: 0, anchorsTh: {} }]);
                setIsDirty(true);
              }}
              className="px-4 py-2 text-primary font-medium text-sm"
            >
              + เพิ่ม item
            </button>
          )}

          {/* Weight Sum */}
          <div
            className={`p-3 rounded text-sm ${
              totalWeight === 100
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            รวม {totalWeight}%{totalWeight !== 100 ? ` (ขาด ${100 - totalWeight}%)` : ' ✓'}
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!canSave || updateMutation.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded min-h-[44px] disabled:opacity-50"
            >
              {updateMutation.isPending ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
            {isInUse && (
              <button
                onClick={handleCopy}
                disabled={copyMutation.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded min-h-[44px] disabled:opacity-50"
              >
                {copyMutation.isPending ? 'กำลังสร้าง…' : 'ทำสำเนา'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Preview Mode */}
      {tab === 'preview' && (
        <div data-testid="editor-preview-mode" className="space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className="p-3 border rounded">
              <div className="flex gap-2 items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium">{idx + 1}. {item.nameTh}</h4>
                  <p className="text-xs text-muted-foreground mt-1">น้ำหนัก ×{item.weight}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
