'use client';

import { useState } from 'react';
import { useMyAssignments } from './api';
import { ReviewCard } from './ReviewCard';
import { thaiError } from '@/lib/errors';
import type { components } from '@/lib/api/schema';

type ReviewAssignment = components['schemas']['ReviewAssignment'];

export function ReviewQueue() {
  const [selectedState, setSelectedState] = useState<'open' | 'submitted' | 'expired' | null>('open');

  const { data: allAssignments, isPending, isError, error, refetch } = useMyAssignments();

  if (isError) {
    return (
      <div role="alert" data-testid="review-error" className="bg-red-50 border border-red-200 rounded p-4 space-y-3">
        <p className="text-red-800">{thaiError(error, 'เกิดข้อผิดพลาดในการโหลดงาน')}</p>
        <button
          onClick={() => refetch()}
          className="inline-block min-h-[44px] px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          ลองใหม่
        </button>
      </div>
    );
  }

  const assignments = allAssignments || [];
  const states = ['open', 'submitted', 'expired'] as const;
  const stateCounts = Object.fromEntries(
    states.map((state) => [state, assignments.filter((a) => a.state === state).length])
  );

  const stateLabels = {
    open: 'ยังไม่ทำ',
    submitted: 'ส่งแล้ว',
    expired: 'หมดเวลา',
  };

  const filtered = selectedState ? assignments.filter((a) => a.state === selectedState) : assignments;
  const submitted = assignments.filter((a) => a.state === 'submitted').length;
  const total = assignments.length;

  const sorted = [...filtered].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  return (
    <div className="space-y-6 p-4">
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap" role="tablist">
        {states.map((state) => (
          <button
            key={state}
            role="tab"
            aria-selected={selectedState === state}
            onClick={() => setSelectedState(state)}
            data-testid={`review-tab-${state}`}
            className={`min-h-[44px] px-4 py-2 rounded font-medium transition-all ${
              selectedState === state
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {stateLabels[state]} {stateCounts[state]}
          </button>
        ))}
      </div>

      {/* Progress */}
      {total > 0 && (
        <div data-testid="review-progress" className="space-y-2">
          <div className="text-sm font-medium">เสร็จ {submitted}/{total}</div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full"
              style={{ width: `${total > 0 ? (submitted / total) * 100 : 0}%` }}
              role="progressbar"
              aria-label={`เสร็จ ${submitted} จาก ${total} งาน`}
              aria-valuenow={submitted}
              aria-valuemin={0}
              aria-valuemax={total}
            />
          </div>
        </div>
      )}

      {/* Loading state */}
      {isPending && (
        <div role="status" className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              data-testid="review-skeleton"
              className="border rounded-lg p-4 bg-gray-100 h-24 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty and loaded states */}
      {!isPending && (
        <>
          {total === 0 ? (
            <p className="text-center text-gray-600 py-8">ยังไม่มีงานที่มอบหมายให้คุณ</p>
          ) : sorted.length === 0 ? (
            <p className="text-center text-gray-600 py-8">ไม่มีงานในหมวดนี้</p>
          ) : (
            <div className="space-y-3">
              {sorted.map((assignment) => (
                <ReviewCard key={assignment.id} assignment={assignment} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
