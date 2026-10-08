import { useCallback, useState } from 'react';

export interface ResultDraft {
  games: Array<{ a: number; b: number }>;
  outcome?: 'played' | 'walkover_a' | 'walkover_b' | string | null;
}

export const DRAFT_STORAGE_PREFIX = 'bl:result-draft:';

export function getResultDraftKey(matchId: string): string {
  return `${DRAFT_STORAGE_PREFIX}${matchId}`;
}

export function loadResultDraft(matchId: string): ResultDraft | null {
  if (!matchId) return null;
  try {
    const key = getResultDraftKey(matchId);
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as ResultDraft;
    }
  } catch {
    // localStorage unavailable or parse error
  }
  return null;
}

export function saveResultDraft(matchId: string, draft: ResultDraft): void {
  if (!matchId) return;
  try {
    const key = getResultDraftKey(matchId);
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // localStorage unavailable
  }
}

export function removeResultDraft(matchId: string): void {
  if (!matchId) return;
  try {
    const key = getResultDraftKey(matchId);
    localStorage.removeItem(key);
  } catch {
    // localStorage unavailable
  }
}

export function useResultDraft(matchId: string) {
  const [draft, setDraftState] = useState<ResultDraft | null>(() => loadResultDraft(matchId));

  const save = useCallback(
    (newDraft: ResultDraft) => {
      saveResultDraft(matchId, newDraft);
      setDraftState(newDraft);
    },
    [matchId],
  );

  const clear = useCallback(() => {
    removeResultDraft(matchId);
    setDraftState(null);
  }, [matchId]);

  return {
    draft,
    saveDraft: save,
    clearDraft: clear,
  };
}
