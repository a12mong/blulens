import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  useResultDraft,
  loadResultDraft,
  saveResultDraft,
  removeResultDraft,
  getResultDraftKey,
} from './useResultDraft';

describe('useResultDraft', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('constructs correct storage key with prefix', () => {
    expect(getResultDraftKey('m-123')).toBe('bl:result-draft:m-123');
  });

  it('loads null when key does not exist or invalid', () => {
    expect(loadResultDraft('m-empty')).toBeNull();

    localStorage.setItem('bl:result-draft:m-corrupt', 'not-valid-json');
    expect(loadResultDraft('m-corrupt')).toBeNull();
  });

  it('saves and loads draft directly via helpers', () => {
    const draftData = {
      games: [{ a: 21, b: 19 }, { a: 18, b: 21 }],
      outcome: 'played',
    };

    saveResultDraft('m-1', draftData);
    expect(localStorage.getItem('bl:result-draft:m-1')).toBe(JSON.stringify(draftData));

    const loaded = loadResultDraft('m-1');
    expect(loaded).toEqual(draftData);

    removeResultDraft('m-1');
    expect(localStorage.getItem('bl:result-draft:m-1')).toBeNull();
  });

  it('useResultDraft hook reads initial draft and updates on saveDraft and clearDraft', () => {
    const initialDraft = {
      games: [{ a: 15, b: 11 }],
      outcome: 'played',
    };
    saveResultDraft('m-hook', initialDraft);

    const { result } = renderHook(() => useResultDraft('m-hook'));
    expect(result.current.draft).toEqual(initialDraft);

    const updated = {
      games: [{ a: 15, b: 11 }, { a: 15, b: 9 }],
      outcome: 'played',
    };

    act(() => {
      result.current.saveDraft(updated);
    });

    expect(result.current.draft).toEqual(updated);
    expect(loadResultDraft('m-hook')).toEqual(updated);

    act(() => {
      result.current.clearDraft();
    });

    expect(result.current.draft).toBeNull();
    expect(loadResultDraft('m-hook')).toBeNull();
  });
});
