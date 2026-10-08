'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { thaiError } from '@/lib/errors';
import { useRubrics, useSaveRubric, type RubricCriterion } from './api';

const TIERS = [
  { key: 'Rookie', label: 'มือใหม่' },
  { key: 'Beginner', label: 'เริ่มต้น' },
  { key: 'Standard', label: 'มาตรฐาน' },
  { key: 'Neutral', label: 'กลาง' },
  { key: 'Professional', label: 'มืออาชีพ' },
] as const;

const MAX_CRITERIA = 12;
const KEY_RE = /^[a-z][a-z_]{1,31}$/;

type Row = {
  uid: number;
  key: string;
  nameTh: string;
  weight: string;
  anchors: Record<string, string>;
};

let uidSeq = 0;
const toRow = (c: RubricCriterion): Row => ({
  uid: ++uidSeq,
  key: c.key,
  nameTh: c.nameTh,
  weight: String(c.weight),
  anchors: { ...(c.anchorsTh ?? {}) },
});

export function validateRows(rows: Row[]): Record<number, string[]> {
  const errs: Record<number, string[]> = {};
  const seen = new Map<string, number>();
  for (const r of rows) {
    const e: string[] = [];
    if (!KEY_RE.test(r.key)) e.push('คีย์ใช้ a-z และ _ เท่านั้น (2-32 ตัว ขึ้นต้นด้วยตัวอักษร)');
    if ((seen.get(r.key) ?? 0) > 0) e.push('คีย์ซ้ำ');
    seen.set(r.key, (seen.get(r.key) ?? 0) + 1);
    if (r.nameTh.trim().length < 1 || r.nameTh.length > 80) e.push('ชื่อต้องยาว 1-80 ตัวอักษร');
    const w = Number(r.weight);
    if (!(w > 0 && w <= 10)) e.push('น้ำหนักต้องมากกว่า 0 และไม่เกิน 10');
    for (const t of TIERS) {
      if ((r.anchors[t.key] ?? '').length > 500) e.push(`คำอธิบายระดับ ${t.label} ยาวเกิน 500 ตัวอักษร`);
    }
    if (e.length) errs[r.uid] = e;
  }
  return errs;
}

export function RubricEditor({ rubricId }: { rubricId: string }) {
  const { data, isLoading, error, refetch } = useRubrics();
  const save = useSaveRubric();
  const rubric = data?.find((r) => r.id === rubricId);

  const [rows, setRows] = useState<Row[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (rubric && rows === null) setRows(rubric.criteria.map(toRow));
  }, [rubric, rows]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const errors = useMemo(() => validateRows(rows ?? []), [rows]);
  const errorCount = Object.keys(errors).length;

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
        <p className="text-destructive">{thaiError(error, 'โหลดเกณฑ์ไม่สำเร็จ')}</p>
        <button type="button" onClick={() => refetch()} className="min-h-[44px] px-4 py-2 bg-primary text-primary-foreground rounded-md">
          ลองใหม่
        </button>
      </div>
    );
  }
  if (!rubric) {
    return (
      <p data-testid="rubric-notfound" className="p-6 text-center text-muted-foreground">
        ไม่พบเกณฑ์นี้
      </p>
    );
  }

  const back = (
    <Link href="/committee/rubrics" className="inline-flex items-center min-h-[44px] text-primary underline">
      ← กลับไปรายการเกณฑ์
    </Link>
  );

  if (rubric.status !== 'draft') {
    return (
      <div className="space-y-4">
        <p data-testid="rubric-readonly" className="p-4 border border-border rounded-lg bg-muted text-sm">
          เกณฑ์ที่ใช้งานแล้วแก้ไม่ได้ ให้สร้างร่างใหม่จากหน้ารายการ
        </p>
        <ul className="space-y-2">
          {rubric.criteria.map((c) => (
            <li key={c.key} className="p-3 border border-border rounded bg-card text-sm">
              {c.nameTh} · น้ำหนัก {c.weight}
            </li>
          ))}
        </ul>
        {back}
      </div>
    );
  }

  const list = rows ?? [];
  const totalWeight = list.reduce((s, r) => s + (Number(r.weight) > 0 ? Number(r.weight) : 0), 0);

  const update = (uid: number, patch: Partial<Row>) => {
    setRows(list.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
    setDirty(true);
    setSaved(false);
  };
  const move = (idx: number, delta: number) => {
    const next = [...list];
    const j = idx + delta;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setRows(next);
    setDirty(true);
    setSaved(false);
  };

  const onSave = async () => {
    setActionError(null);
    const criteria: RubricCriterion[] = list.map((r) => {
      const anchorsTh: Record<string, string> = {};
      for (const t of TIERS) {
        const v = (r.anchors[t.key] ?? '').trim();
        if (v) anchorsTh[t.key] = v;
      }
      return {
        key: r.key,
        nameTh: r.nameTh.trim(),
        weight: Number(r.weight),
        ...(Object.keys(anchorsTh).length ? { anchorsTh } : {}),
      };
    });
    try {
      await save.mutateAsync({ id: rubricId, criteria });
      setDirty(false);
      setSaved(true);
    } catch (err) {
      setActionError(thaiError(err, 'บันทึกไม่สำเร็จ'));
    }
  };

  return (
    <div className="space-y-4">
      {back}

      {list.map((r, idx) => (
        <section key={r.uid} data-testid="rubric-criterion" className="p-4 border border-border rounded-lg bg-card space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm space-y-1">
              <span>ชื่อเกณฑ์</span>
              <input
                data-testid="crit-name"
                value={r.nameTh}
                onChange={(e) => update(r.uid, { nameTh: e.target.value })}
                className="w-full min-h-[44px] px-3 border border-border rounded bg-card"
              />
            </label>
            <label className="text-sm space-y-1">
              <span>คีย์ (a-z และ _ เท่านั้น)</span>
              <input
                data-testid="crit-key"
                value={r.key}
                onChange={(e) => update(r.uid, { key: e.target.value })}
                className="w-full min-h-[44px] px-3 border border-border rounded bg-card"
              />
            </label>
            <label className="text-sm space-y-1">
              <span>น้ำหนัก</span>
              <input
                data-testid="crit-weight"
                type="number"
                step="0.1"
                value={r.weight}
                onChange={(e) => update(r.uid, { weight: e.target.value })}
                className="w-full min-h-[44px] px-3 border border-border rounded bg-card"
              />
              <span className="block text-xs text-muted-foreground">
                สัดส่วน {totalWeight > 0 && Number(r.weight) > 0 ? Math.round((Number(r.weight) / totalWeight) * 100) : 0}%
              </span>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {TIERS.map((t) => (
              <label key={t.key} className="text-sm space-y-1">
                <span>คำอธิบายระดับ {t.label}</span>
                <textarea
                  data-testid={`crit-anchor-${t.key}`}
                  value={r.anchors[t.key] ?? ''}
                  onChange={(e) => update(r.uid, { anchors: { ...r.anchors, [t.key]: e.target.value } })}
                  className="w-full min-h-[64px] p-2 border border-border rounded bg-card"
                />
              </label>
            ))}
          </div>

          {errors[r.uid] && (
            <ul role="alert" data-testid="crit-errors" className="text-sm text-destructive list-disc pl-5">
              {errors[r.uid].map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" data-testid="crit-up" aria-label="เลื่อนขึ้น" disabled={idx === 0} onClick={() => move(idx, -1)} className="min-h-[44px] px-4 border border-border rounded disabled:opacity-50">
              ขึ้น
            </button>
            <button type="button" data-testid="crit-down" aria-label="เลื่อนลง" disabled={idx === list.length - 1} onClick={() => move(idx, 1)} className="min-h-[44px] px-4 border border-border rounded disabled:opacity-50">
              ลง
            </button>
            <button
              type="button"
              data-testid="crit-remove"
              disabled={list.length <= 1}
              onClick={() => {
                setRows(list.filter((x) => x.uid !== r.uid));
                setDirty(true);
                setSaved(false);
              }}
              className="min-h-[44px] px-4 border border-destructive text-destructive rounded disabled:opacity-50"
            >
              ลบเกณฑ์
            </button>
          </div>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-testid="crit-add"
          disabled={list.length >= MAX_CRITERIA}
          onClick={() => {
            setRows([...list, { uid: ++uidSeq, key: '', nameTh: '', weight: '1', anchors: {} }]);
            setDirty(true);
            setSaved(false);
          }}
          className="min-h-[44px] px-4 py-2 border border-border rounded font-medium disabled:opacity-50"
        >
          + เพิ่มเกณฑ์
        </button>
        <button
          type="button"
          data-testid="rubric-save"
          disabled={errorCount > 0 || save.isPending || list.length === 0}
          onClick={onSave}
          className="min-h-[44px] px-4 py-2 bg-primary text-primary-foreground rounded font-medium disabled:opacity-50"
        >
          บันทึก
        </button>
        {errorCount > 0 && (
          <span role="alert" data-testid="rubric-invalid" className="text-sm text-destructive">
            แก้ข้อผิดพลาดก่อนบันทึก ({errorCount})
          </span>
        )}
        {saved && (
          <span data-testid="rubric-saved" className="text-sm font-medium">
            บันทึกแล้ว
          </span>
        )}
      </div>

      {actionError && (
        <div role="alert" data-testid="rubric-action-error" className="p-3 border border-destructive rounded bg-destructive/10 text-destructive text-sm">
          {actionError}
        </div>
      )}
    </div>
  );
}
