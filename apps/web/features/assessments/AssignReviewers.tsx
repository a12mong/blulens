'use client';

import React, { useEffect, useId, useMemo, useState } from 'react';
import { thaiError } from '@/lib/errors';
import * as usersApi from '../users/api';
import type { UserPickerItem } from '../users/api';
import * as assessmentApi from './api';
import type { AssessmentDetail } from './api';

export type AssignReviewersProps = {
  detail: AssessmentDetail;
};

const ALLOWED_STATUSES = ['submitted', 'in_review', 'needs_reviewers'];

export function AssignReviewers({ detail }: AssignReviewersProps) {
  const titleId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [pickedReviewers, setPickedReviewers] = useState<UserPickerItem[]>([]);
  const [due, setDue] = useState('');
  const [conflictReviewerId, setConflictReviewerId] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  let useAssignHook: typeof assessmentApi.useAssignReviewers | undefined;
  try {
    useAssignHook = assessmentApi.useAssignReviewers;
  } catch {
    useAssignHook = undefined;
  }
  let hookResult = null;
  try {
    hookResult =
      typeof useAssignHook === 'function' ? useAssignHook(detail.id ?? '') : null;
  } catch {
    hookResult = null;
  }
  const assignMutation = hookResult ?? {
    mutate: () => {},
    isPending: false,
  };

  // Debounce search input by 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  let useSearchHook: typeof usersApi.useReviewerSearch | undefined;
  try {
    useSearchHook = usersApi.useReviewerSearch;
  } catch {
    useSearchHook = undefined;
  }
  let searchResult = null;
  try {
    searchResult =
      typeof useSearchHook === 'function'
        ? useSearchHook(debouncedQuery, { enabled: isOpen && debouncedQuery.length >= 1 })
        : null;
  } catch {
    searchResult = null;
  }
  const searchResults = searchResult?.data ?? [];
  const isSearching = Boolean(searchResult?.isLoading);


  // Exclude reviewers already in reviewerRows
  const existingReviewerIds = useMemo(() => {
    return new Set(
      (detail.reviewerRows ?? [])
        .map((r) => r.reviewerId)
        .filter((id): id is string => Boolean(id)),
    );
  }, [detail.reviewerRows]);

  // Exclude already-picked reviewers from results
  const pickedIds = useMemo(() => {
    return new Set(pickedReviewers.map((p) => p.id));
  }, [pickedReviewers]);

  const availableOptions = useMemo(() => {
    if (debouncedQuery.length < 1) return [];
    return searchResults.filter(
      (item) => !existingReviewerIds.has(item.id) && !pickedIds.has(item.id),
    );
  }, [searchResults, existingReviewerIds, pickedIds, debouncedQuery]);

  if (!detail.status || !ALLOWED_STATUSES.includes(detail.status)) {
    return null;
  }

  const handleOpen = () => {
    setIsOpen(true);
    setSearchQuery('');
    setDebouncedQuery('');
    setPickedReviewers([]);
    setDue('');
    setConflictReviewerId(null);
    setGeneralError(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    setConflictReviewerId(null);
    setGeneralError(null);
  };

  const handlePick = (reviewer: UserPickerItem) => {
    setPickedReviewers((prev) => [...prev, reviewer]);
    setSearchQuery('');
    setDebouncedQuery('');
  };

  const handleRemove = (id: string) => {
    setPickedReviewers((prev) => prev.filter((p) => p.id !== id));
    if (conflictReviewerId === id) {
      setConflictReviewerId(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pickedReviewers.length === 0 || assignMutation.isPending) return;

    setConflictReviewerId(null);
    setGeneralError(null);

    const dueAt = due ? new Date(due).toISOString() : undefined;

    assignMutation.mutate(
      {
        reviewerIds: pickedReviewers.map((p) => p.id),
        dueAt,
      },
      {
        onSuccess: () => {
          handleClose();
        },
        onError: (err) => {
          const apiError = err as unknown as {
            code?: string;
            details?: { reviewerId?: string };
          };

          if (
            apiError.code === 'REVIEWER_CONFLICT_OF_INTEREST' &&
            apiError.details?.reviewerId
          ) {
            setConflictReviewerId(apiError.details.reviewerId);
          } else {
            setGeneralError(
              thaiError(err, 'เกิดข้อผิดพลาดในการมอบหมายผู้ประเมิน'),
            );
          }
        },
      },
    );
  };

  return (
    <div className="pt-2">
      <button
        type="button"
        data-testid="assign-open"
        onClick={handleOpen}
        className="min-h-[44px] px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity cursor-pointer text-sm"
      >
        มอบหมายผู้ประเมิน
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 text-card-foreground shadow-lg flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <header className="flex items-center justify-between border-b border-border pb-3">
              <h2 id={titleId} className="text-lg font-semibold text-foreground">
                มอบหมายผู้ประเมิน
              </h2>
              <button
                type="button"
                onClick={handleClose}
                aria-label="ปิดหน้าต่าง"
                className="text-muted-foreground hover:text-foreground text-sm p-1 rounded min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
              >
                ✕
              </button>
            </header>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Search section */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="assign-search-input"
                  className="text-sm font-medium text-foreground"
                >
                  ค้นหาผู้ประเมิน
                </label>
                <input
                  id="assign-search-input"
                  type="text"
                  data-testid="assign-search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="พิมพ์ชื่อผู้ประเมิน..."
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                />

                {isSearching && (
                  <p className="text-xs text-muted-foreground">กำลังค้นหา…</p>
                )}

                {/* Available search results */}
                {availableOptions.length > 0 && (
                  <div
                    className="flex flex-col gap-1 rounded-md border border-border bg-background p-1 mt-1 max-h-48 overflow-y-auto"
                    role="listbox"
                    aria-label="ผลการค้นหาผู้ประเมิน"
                  >
                    {availableOptions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        data-testid="assign-option"
                        onClick={() => handlePick(item)}
                        className="w-full text-left p-2 rounded hover:bg-muted text-sm flex flex-col gap-0.5 border border-transparent hover:border-border transition-colors cursor-pointer min-h-[44px] justify-center"
                      >
                        <span className="font-medium text-foreground">
                          {item.displayName}
                        </span>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {item.teamNames && item.teamNames.length > 0 && (
                            <span>{item.teamNames.join(', ')}</span>
                          )}
                          {item.gradeLabel && (
                            <span>เกรด {item.gradeLabel}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Picked reviewers section */}
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                  ผู้ประเมินที่เลือก ({pickedReviewers.length})
                </span>

                {pickedReviewers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    ยังไม่ได้เลือกผู้ประเมิน
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {pickedReviewers.map((reviewer) => {
                      const isConflict = conflictReviewerId === reviewer.id;
                      return (
                        <div
                          key={reviewer.id}
                          data-testid="assign-picked"
                          className={`inline-flex flex-col gap-1 p-2 rounded-md border text-sm max-w-full ${
                            isConflict
                              ? 'border-destructive bg-destructive/10 text-destructive'
                              : 'border-border bg-secondary text-secondary-foreground'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                              {reviewer.displayName}
                            </span>
                            <button
                              type="button"
                              data-testid="assign-remove"
                              aria-label={`ลบ ${reviewer.displayName}`}
                              onClick={() => handleRemove(reviewer.id)}
                              className="text-muted-foreground hover:text-foreground text-xs p-1 min-w-[28px] min-h-[28px] inline-flex items-center justify-center rounded cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                          {isConflict && (
                            <span
                              data-testid="assign-conflict"
                              className="text-xs font-semibold text-destructive"
                            >
                              ผู้ประเมินสังกัดทีมเดียวกับผู้ถูกประเมิน
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Due date input */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="assign-due-input"
                  className="text-sm font-medium text-foreground"
                >
                  กำหนดส่ง (ไม่บังคับ)
                </label>
                <input
                  id="assign-due-input"
                  type="datetime-local"
                  data-testid="assign-due"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                />
              </div>

              {/* General error message */}
              {generalError && (
                <div
                  role="alert"
                  data-testid="assign-error"
                  className="p-3 rounded-md border border-destructive bg-destructive/10 text-destructive text-sm"
                >
                  {generalError}
                </div>
              )}

              {/* Actions */}
              <footer className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={handleClose}
                  className="min-h-[44px] px-4 py-2 rounded-md border border-border bg-secondary text-secondary-foreground font-medium hover:bg-secondary/80 transition-colors cursor-pointer text-sm"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  data-testid="assign-submit"
                  disabled={
                    pickedReviewers.length === 0 || assignMutation.isPending
                  }
                  className="min-h-[44px] px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer disabled:cursor-not-allowed text-sm"
                >
                  {assignMutation.isPending ? 'กำลังมอบหมาย…' : 'มอบหมาย'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
