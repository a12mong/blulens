import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReviewDraft } from './useReviewDraft';

describe('useReviewDraft', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('stores, restores and clears the draft per assignment', () => {
    // Set scores and comment for first assignment
    const { result: result1 } = renderHook(() => useReviewDraft('id-1'));

    act(() => {
      result1.current.setScore('footwork', 'S');
      result1.current.setScore('smash', null);
      result1.current.setComment('Good form');
    });

    expect(result1.current.draft.scores).toEqual({ footwork: 'S', smash: null });
    expect(result1.current.draft.comment).toBe('Good form');

    // Verify localStorage has the draft
    const stored = JSON.parse(localStorage.getItem('bl:review-draft:id-1') || '{}');
    expect(stored.scores).toEqual({ footwork: 'S', smash: null });
    expect(stored.comment).toBe('Good form');

    // Create a fresh hook for the same assignment - should restore
    const { result: result1Fresh } = renderHook(() => useReviewDraft('id-1'));
    expect(result1Fresh.current.draft.scores).toEqual({ footwork: 'S', smash: null });
    expect(result1Fresh.current.draft.comment).toBe('Good form');

    // Create a hook for a different assignment - should be empty
    const { result: result2 } = renderHook(() => useReviewDraft('id-2'));
    expect(result2.current.draft.scores).toEqual({});
    expect(result2.current.draft.comment).toBe('');

    // Clear the first assignment's draft
    act(() => {
      result1Fresh.current.clear();
    });

    expect(result1Fresh.current.draft.scores).toEqual({});
    expect(result1Fresh.current.draft.comment).toBe('');
    expect(localStorage.getItem('bl:review-draft:id-1')).toBeNull();
  });

  it('handles localStorage not available gracefully', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage not available');
    });
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('localStorage not available');
    });

    const { result } = renderHook(() => useReviewDraft('id-1'));

    act(() => {
      result.current.setScore('footwork', 'S');
      result.current.setComment('Test');
    });

    expect(result.current.draft.scores).toEqual({ footwork: 'S' });
    expect(result.current.draft.comment).toBe('Test');

    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
  });
});
