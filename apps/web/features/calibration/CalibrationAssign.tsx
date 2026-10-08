'use client';

import React, { useEffect, useState } from 'react';
import { thaiError } from '@/lib/errors';
import { useReviewerSearch, type UserPickerItem } from '@/features/users/api';
import { useAssignCalibration } from './api';

export function CalibrationAssign({
  setId,
  alreadyAssigned = false,
}: {
  setId: string;
  alreadyAssigned?: boolean;
}) {
  const assign = useAssignCalibration(setId);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [picked, setPicked] = useState<UserPickerItem[]>([]);
  const [due, setDue] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: found = [] } = useReviewerSearch(debounced);
  const options = found.filter((u) => !picked.some((p) => p.id === u.id));

  const submit = async () => {
    setError(null);
    try {
      await assign.mutateAsync({
        reviewerIds: picked.map((p) => p.id),
        dueAt: due ? new Date(due).toISOString() : undefined,
      });
      setPicked([]);
      setDue('');
      setConfirming(false);
    } catch (err) {
      setConfirming(false);
      setError(thaiError(err, 'มอบหมายไม่สำเร็จ'));
    }
  };

  return (
    <section data-testid="calib-assign-panel" className="p-4 border border-border rounded bg-card space-y-3">
      <h3 className="text-sm font-semibold">{alreadyAssigned ? 'เพิ่มผู้ตรวจ' : 'มอบหมายผู้ตรวจ'}</h3>
      <label className="block text-sm" htmlFor="calib-reviewer-q">
        ค้นหาผู้ตรวจ
      </label>
      <input
        id="calib-reviewer-q"
        data-testid="calib-reviewer-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full min-h-[44px] px-3 border border-border rounded bg-card"
      />
      {options.length > 0 && query.trim() !== '' && (
        <ul className="border border-border rounded divide-y divide-border">
          {options.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                data-testid="calib-reviewer-option"
                onClick={() => {
                  setPicked((prev) => [...prev, u]);
                  setQuery('');
                }}
                className="w-full min-h-[44px] px-3 text-left hover:bg-muted"
              >
                {u.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
      {picked.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {picked.map((p) => (
            <li
              key={p.id}
              data-testid="calib-reviewer-chip"
              className="inline-flex items-center gap-1 px-3 border border-border rounded-full bg-muted"
            >
              <span className="text-sm">{p.displayName}</span>
              <button
                type="button"
                aria-label={`เอา ${p.displayName} ออก`}
                onClick={() => setPicked((prev) => prev.filter((x) => x.id !== p.id))}
                className="min-h-[44px] min-w-[44px]"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="block text-sm" htmlFor="calib-due">
        กำหนดส่ง (ไม่บังคับ)
      </label>
      <input
        id="calib-due"
        type="datetime-local"
        value={due}
        onChange={(e) => setDue(e.target.value)}
        className="min-h-[44px] px-3 border border-border rounded bg-card"
      />
      {error && (
        <div role="alert" data-testid="calib-assign-error" className="p-3 border border-destructive rounded bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      <button
        type="button"
        data-testid="calib-assign"
        disabled={picked.length === 0 || assign.isPending}
        onClick={() => setConfirming(true)}
        className="min-h-[44px] px-4 py-2 bg-primary text-primary-foreground rounded disabled:opacity-50"
      >
        มอบหมายชุดนี้
      </button>

      {confirming && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
          <div className="bg-card text-card-foreground border border-border rounded-lg p-6 max-w-md w-full space-y-4">
            <p className="text-sm">
              {alreadyAssigned
                ? 'เพิ่มผู้ตรวจในชุดที่มอบหมายแล้ว'
                : 'มอบหมายแล้วจะแก้คลิปและเกรดอ้างอิงไม่ได้'}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(false)} className="min-h-[44px] px-4 py-2 border border-border rounded">
                ยกเลิก
              </button>
              <button
                type="button"
                data-testid="calib-assign-confirm"
                onClick={submit}
                disabled={assign.isPending}
                className="min-h-[44px] px-4 py-2 bg-primary text-primary-foreground rounded disabled:opacity-50"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
