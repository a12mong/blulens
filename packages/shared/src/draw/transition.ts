export type DrawStatus = 'preview' | 'published' | 'discarded' | 'superseded' | 'locked';

export type DrawAction =
  | { type: 'publish'; inputHashMatches: boolean; conflictCount: number; acknowledgeConflicts: boolean }
  | { type: 'discard' }
  | { type: 'supersede'; reason: string }
  | { type: 'lock' };

export type DrawErrorCode =
  | 'DRAW_INVALID_TRANSITION'
  | 'DRAW_INPUT_CHANGED'
  | 'DRAW_CONFLICTS_NOT_ACKNOWLEDGED'
  | 'DRAW_REASON_REQUIRED';

export type DrawTransitionResult = { ok: true; next: DrawStatus } | { ok: false; code: DrawErrorCode };

/** Draw version lifecycle (draw.md §6, D5/D8). Never throws; returns the first failing rule. */
export function drawTransition(current: DrawStatus, action: DrawAction): DrawTransitionResult {
  // Check 1: Allowed transitions only
  if (current === 'preview' && action.type === 'publish') {
    // Check 2: input hash mismatch
    if (!action.inputHashMatches) {
      return { ok: false, code: 'DRAW_INPUT_CHANGED' };
    }

    // Check 3: unacknowledged conflicts
    if (action.conflictCount > 0 && !action.acknowledgeConflicts) {
      return { ok: false, code: 'DRAW_CONFLICTS_NOT_ACKNOWLEDGED' };
    }

    return { ok: true, next: 'published' };
  }

  if (current === 'preview' && action.type === 'discard') {
    return { ok: true, next: 'discarded' };
  }

  if (current === 'published' && action.type === 'supersede') {
    // Check 4: reason validation (min 5 chars after trim)
    if (action.reason.trim().length < 5) {
      return { ok: false, code: 'DRAW_REASON_REQUIRED' };
    }

    return { ok: true, next: 'superseded' };
  }

  if (current === 'published' && action.type === 'lock') {
    return { ok: true, next: 'locked' };
  }

  // All other transitions are invalid
  return { ok: false, code: 'DRAW_INVALID_TRANSITION' };
}
