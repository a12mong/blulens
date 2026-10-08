'use client';

import { useMemo, useState } from 'react';
import { useRaterStats } from './api';
import { AgreementBadge } from './AgreementBadge';
import { PairMatrix } from './PairMatrix';
import { thaiError } from '@/lib/errors';

type Window = '30d' | '90d' | '365d' | 'all';

interface RaterPanelProps {
  window?: Window;
}

const windowLabels: Record<Window, string> = {
  '30d': '30 วัน',
  '90d': '90 วัน',
  '365d': '365 วัน',
  'all': 'ทั้งหมด',
};

export function RaterPanel({ window: initialWindow = '90d' }: RaterPanelProps) {
  const [window, setWindow] = useState<Window>(initialWindow);
  const { data: raterStats, isLoading, error, refetch } = useRaterStats(window);

  const reviewerIds = useMemo(
    () => (raterStats?.raters ?? []).map((r) => r.reviewerId ?? '').filter(Boolean),
    [raterStats?.raters]
  );

  const pairs = useMemo(() => raterStats?.pairs ?? [], [raterStats?.pairs]);

  const getBiasText = (bias: number | undefined): string => {
    if (bias === undefined || bias === null) return '';
    const absVal = Math.abs(bias);
    const direction =
      bias > 0
        ? 'เข้มน้อยกว่าฉันทามติ'
        : bias < 0
          ? 'เข้มกว่าฉันทามติ'
          : '';
    return `${bias > 0 ? '+' : ''}${absVal.toFixed(1)} ขั้น (${direction})`;
  };

  if (isLoading) {
    return <div role="status">กำลังโหลด…</div>;
  }

  if (error) {
    return (
      <div role="alert" data-testid="rater-error" className="space-y-3">
        <p>{thaiError(error)}</p>
        <button onClick={() => refetch()}>ลองใหม่</button>
      </div>
    );
  }

  const hasRaters = reviewerIds.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="rater-window">ช่วงสถิติ</label>
        <select
          id="rater-window"
          data-testid="rater-window"
          value={window}
          onChange={(e) => setWindow(e.target.value as Window)}
        >
          {Object.entries(windowLabels).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {hasRaters ? (
        <>
          <div>
            <h3>ความสอดคล้องของกรรมการ</h3>
            {raterStats?.panel?.fleissKappaTier ? (
              <div className="flex items-center gap-2">
                <AgreementBadge value={raterStats.panel.fleissKappaTier} />
                <span className="text-sm text-muted-foreground">
                  n={raterStats.panel.fleissKappaTier.n}
                </span>
              </div>
            ) : (
              <span>—</span>
            )}
          </div>

          {reviewerIds.length > 1 && (
            <div className="overflow-x-auto">
              <h3>ความสอดคล้องต่อคู่</h3>
              <PairMatrix
                reviewerIds={reviewerIds}
                pairs={pairs}
                labelFor={(id) => {
                  const idx = reviewerIds.indexOf(id);
                  return idx >= 0 ? `R${idx + 1}` : id;
                }}
              />
            </div>
          )}

          <div className="overflow-x-auto">
            <h3>ผู้ประเมิน</h3>
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="text-left">ชื่อ</th>
                  <th className="text-left">รีวิว</th>
                  <th className="text-left">อคติ</th>
                  <th className="text-left">Kappa vs ฉันทามติ</th>
                  <th className="text-left">Outlier %</th>
                  <th className="text-left">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {(raterStats?.raters ?? []).map((rater, idx) => (
                  <tr key={rater.reviewerId} data-testid="rater-row">
                    <td>R{idx + 1}</td>
                    <td>{rater.reviews}</td>
                    <td>{getBiasText(rater.bias)}</td>
                    <td>
                      {rater.kappaVsConsensus ? (
                        <AgreementBadge value={rater.kappaVsConsensus} />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{rater.outlierRate !== undefined ? `${Math.round(rater.outlierRate * 100)}%` : '—'}</td>
                    <td>
                      {rater.flagged && (
                        <span className="inline-block rounded bg-warning text-warning-foreground px-2 py-1 text-sm">
                          ควรทบทวน
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div>ยังไม่มีข้อมูลผู้ประเมิน</div>
      )}
    </div>
  );
}
