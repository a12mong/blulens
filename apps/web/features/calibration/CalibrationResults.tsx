'use client';

import React from 'react';
import { thaiError } from '@/lib/errors';
import { useCalibrationResults, type CalibrationResult } from './api';

export function biasText(r: CalibrationResult): { text: string; thin: boolean } {
  if (r.clipsScored < 2) return { text: '—', thin: true };
  const b = r.biasVsReference;
  if (Math.abs(b) < 0.25) return { text: '0 ขั้น (ตรงเกณฑ์)', thin: false };
  const sign = b > 0 ? '+' : '-';
  const dir = b > 0 ? 'ให้คะแนนสูงกว่าเกณฑ์' : 'ต่ำกว่าเกณฑ์';
  return { text: `${sign}${Math.abs(b).toFixed(1)} ขั้น (${dir})`, thin: false };
}

export function CalibrationResults({
  setId,
  names,
}: {
  setId: string;
  names: Record<string, string>;
}) {
  const { data, isLoading, error, refetch } = useCalibrationResults(setId);

  if (isLoading) {
    return (
      <div role="status" data-testid="calib-results-loading" className="text-muted-foreground">
        กำลังโหลดผล…
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" data-testid="calib-results-error" className="p-3 border border-destructive rounded bg-destructive/10 space-y-2">
        <p className="text-destructive">{thaiError(error, 'โหลดผลไม่สำเร็จ')}</p>
        <button type="button" onClick={() => refetch()} className="min-h-[44px] px-4 py-2 bg-primary text-primary-foreground rounded">
          ลองใหม่
        </button>
      </div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <p data-testid="calib-results-empty" className="p-4 bg-muted rounded text-center text-muted-foreground">
        ยังไม่มีผู้ตรวจส่งคะแนน
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">ความลำเอียงเทียบเกรดอ้างอิง</h3>
      <div className="overflow-x-auto">
        <table data-testid="calib-results" className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="p-2">ผู้ตรวจ</th>
              <th className="p-2">ให้คะแนนแล้ว</th>
              <th className="p-2">ความลำเอียง</th>
              <th className="p-2">คลาดเคลื่อนเฉลี่ย</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const bias = biasText(r);
              return (
                <tr key={r.reviewerId} data-testid="calib-result-row" className="border-b border-border align-top">
                  <td className="p-2">{names[r.reviewerId] ?? 'ผู้ตรวจ'}</td>
                  <td className="p-2">ให้คะแนนแล้ว {r.clipsScored} คลิป</td>
                  <td data-testid="calib-bias" className="p-2">
                    {bias.text}
                    {bias.thin && <span className="block text-xs text-muted-foreground">ข้อมูลยังไม่พอ</span>}
                  </td>
                  <td data-testid="calib-mae" className="p-2">
                    {bias.thin ? '—' : `คลาดเคลื่อนเฉลี่ย ${r.meanAbsError.toFixed(1)} ขั้น`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
