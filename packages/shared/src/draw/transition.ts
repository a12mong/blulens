import { notImplemented } from './stub';

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
  return notImplemented(`bl-18-3 drawTransition(${current}, ${action.type})`);
}
