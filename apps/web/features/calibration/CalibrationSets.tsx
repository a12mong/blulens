'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { thaiError } from '@/lib/errors';
import { useCalibrationSets, useCreateCalibrationSet } from './api';

export function CalibrationSets() {
  const { data: sets = [], isLoading, error, refetch } = useCalibrationSets();
  const createSet = useCreateCalibrationSet();

  const [formName, setFormName] = useState('');
  const [formPeriod, setFormPeriod] = useState('');
  const [createError, setCreateError] = useState<string>();

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(undefined);

    if (!formName.trim()) {
      return;
    }

    try {
      await createSet.mutateAsync({
        name: formName.trim(),
        ...(formPeriod.trim() ? { period: formPeriod.trim() } : {}),
      });
      setFormName('');
      setFormPeriod('');
    } catch (err) {
      setCreateError(thaiError(err as any, 'ไม่สามารถสร้างชุดได้'));
    }
  };

  if (isLoading) {
    return (
      <div role="status" data-testid="calibration-loading" className="p-6 text-center text-muted-foreground">
        กำลังโหลด…
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" data-testid="calibration-error" className="p-6 rounded-lg bg-destructive/10 border border-destructive">
        <p className="text-destructive font-medium mb-4">เกิดข้อผิดพลาด</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          ลองใหม่
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Create Form */}
      <section data-testid="calibration-create">
        <h2 className="text-lg font-semibold mb-4">สร้างชุดใหม่</h2>
        <form onSubmit={handleCreateSubmit} className="space-y-4 p-4 border border-border rounded-lg bg-card">
          <div>
            <label htmlFor="calibration-name" className="block text-sm font-medium mb-2">
              ชื่อชุด
            </label>
            <input
              id="calibration-name"
              type="text"
              value={formName}
              onChange={e => setFormName(e.target.value.slice(0, 120))}
              placeholder="เช่น ปีการศึกษา 2566 Q1"
              maxLength={120}
              required
              className="w-full px-3 py-2 border border-border rounded text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">{formName.length}/120</p>
          </div>

          <div>
            <label htmlFor="calibration-period" className="block text-sm font-medium mb-2">
              รอบ (ไม่บังคับ)
            </label>
            <input
              id="calibration-period"
              type="text"
              value={formPeriod}
              onChange={e => setFormPeriod(e.target.value)}
              placeholder="2026-Q4"
              className="w-full px-3 py-2 border border-border rounded text-sm"
            />
          </div>

          {createError && (
            <div role="alert" data-testid="calibration-create-error" className="p-3 rounded-lg bg-destructive/10 border border-destructive">
              <p className="text-sm text-destructive">{createError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!formName.trim() || createSet.isPending}
            className="w-full px-4 py-2 min-h-[44px] bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {createSet.isPending ? 'กำลังสร้าง…' : 'สร้างชุด'}
          </button>
        </form>
      </section>

      {/* Sets List */}
      <section>
        <h2 className="text-lg font-semibold mb-4">ชุดมาตรฐาน</h2>
        {sets.length === 0 ? (
          <div data-testid="calibration-empty" className="p-6 text-center text-muted-foreground">
            ยังไม่มีชุดมาตรฐาน
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {sets.map(set => (
              <Link
                key={set.id}
                href={`/committee/calibration/${set.id}`}
                data-testid="calibration-card"
                className="p-4 border border-border rounded-lg bg-card hover:bg-muted min-h-[44px] flex flex-col justify-between"
              >
                <div>
                  <h3 className="font-medium text-sm mb-2">{set.name}</h3>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>{set.period || 'ไม่ระบุรอบ'}</p>
                    <p>คลิป {set.clips?.length ?? 0} คลิป</p>
                  </div>
                </div>
                <p className="text-sm text-primary font-medium mt-3">เปิดชุด</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
