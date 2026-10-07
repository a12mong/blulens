import { useCallback, useEffect, useState } from 'react';
import type { components } from '@/lib/api/schema';

type CriterionScore = components['schemas']['CriterionScore'];

export interface ReviewDraft {
  scores: Record<string, string | null>;
  comment: string;
}

interface UseReviewDraftReturn {
  draft: ReviewDraft;
  setScore: (criterion: string, gradeKey: string | null | undefined) => void;
  setComment: (text: string) => void;
  clear: () => void;
}

const STORAGE_KEY_PREFIX = 'bl:review-draft:';

function getStorageKey(id: string): string {
  return `${STORAGE_KEY_PREFIX}${id}`;
}

function loadDraft(id: string): ReviewDraft {
  try {
    const key = getStorageKey(id);
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // localStorage not available or parse error, fall through to default
  }
  return { scores: {}, comment: '' };
}

function saveDraft(id: string, draft: ReviewDraft): void {
  try {
    const key = getStorageKey(id);
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // localStorage not available, silently ignore
  }
}

function removeDraft(id: string): void {
  try {
    const key = getStorageKey(id);
    localStorage.removeItem(key);
  } catch {
    // localStorage not available, silently ignore
  }
}

export function useReviewDraft(id: string): UseReviewDraftReturn {
  const [draft, setDraft] = useState<ReviewDraft>(() => loadDraft(id));

  useEffect(() => {
    if (Object.keys(draft.scores).length > 0 || draft.comment) {
      saveDraft(id, draft);
    } else {
      removeDraft(id);
    }
  }, [id, draft]);

  const setScore = useCallback((criterion: string, gradeKey: string | null | undefined) => {
    setDraft((prev) => {
      const newScores = { ...prev.scores };
      if (gradeKey === undefined) {
        delete newScores[criterion];
      } else {
        newScores[criterion] = gradeKey;
      }
      return { ...prev, scores: newScores };
    });
  }, []);

  const setComment = useCallback((text: string) => {
    setDraft((prev) => ({ ...prev, comment: text }));
  }, []);

  const clear = useCallback(() => {
    removeDraft(id);
    setDraft({ scores: {}, comment: '' });
  }, [id]);

  return { draft, setScore, setComment, clear };
}
