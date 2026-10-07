'use client';

import { type components } from '@/lib/api/schema';
import { AgreementBadge } from './AgreementBadge';

type RaterStats = components['schemas']['RaterStats'];
type RaterStatsPair = NonNullable<RaterStats['pairs']>[number];
type AgreementValue = components['schemas']['AgreementValue'];

interface PairMatrixProps {
  reviewerIds: string[];
  pairs: RaterStatsPair[];
  labelFor?: (id: string) => string;
  onCellClick?: (a: string, b: string) => void;
}

export function PairMatrix({
  reviewerIds,
  pairs,
  labelFor,
  onCellClick,
}: PairMatrixProps) {
  if (reviewerIds.length === 0) {
    return <div>ยังไม่มีข้อมูลผู้ประเมิน</div>;
  }

  const defaultLabelFor = (id: string, index: number) => `R${index + 1}`;
  const getLabel = (id: string, index: number) =>
    labelFor?.(id) ?? defaultLabelFor(id, index);

  const findPair = (a: string, b: string): RaterStatsPair | undefined => {
    return (pairs || []).find(
      (p) =>
        (p.a === a && p.b === b) || (p.a === b && p.b === a)
    );
  };

  return (
    <div className="overflow-x-auto">
      <table data-testid="pair-matrix">
        <thead>
          <tr>
            <th></th>
            {reviewerIds.map((id, idx) => (
              <th key={id}>{getLabel(id, idx)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {reviewerIds.map((rowId, rowIdx) => (
            <tr key={rowId}>
              <th>{getLabel(rowId, rowIdx)}</th>
              {reviewerIds.map((colId, colIdx) => {
                const cellKey = `${rowId}-${colId}`;
                const testId = `pair-cell-${rowIdx}-${colIdx}`;

                if (rowIdx === colIdx) {
                  return (
                    <td key={cellKey} data-testid={testId}>
                      –
                    </td>
                  );
                }

                const pair = findPair(rowId, colId);
                const agreementValue: AgreementValue = pair?.cohenKappaQuadratic || {
                  kappa: null,
                  n: 0,
                  band: 'insufficient',
                };
                const isInsufficient = agreementValue.kappa === null || agreementValue.band === 'insufficient';

                if (onCellClick) {
                  return (
                    <td
                      key={cellKey}
                      data-testid={testId}
                      title={isInsufficient ? 'ข้อมูลร่วมไม่พอ' : undefined}
                    >
                      <button
                        onClick={() => onCellClick(rowId, colId)}
                        className="min-h-[44px] min-w-[44px] p-1"
                      >
                        {isInsufficient ? (
                          <>
                            —
                            <span className="sr-only">ข้อมูลร่วมไม่พอ</span>
                          </>
                        ) : (
                          <AgreementBadge value={agreementValue} />
                        )}
                      </button>
                    </td>
                  );
                }

                return (
                  <td
                    key={cellKey}
                    data-testid={testId}
                    title={isInsufficient ? 'ข้อมูลร่วมไม่พอ' : undefined}
                  >
                    {isInsufficient ? (
                      <>
                        —
                        <span className="sr-only">ข้อมูลร่วมไม่พอ</span>
                      </>
                    ) : (
                      <AgreementBadge value={agreementValue} />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
