import { describe, expect, it } from 'vitest';
import { drawTransition, type DrawAction, type DrawStatus, type DrawTransitionResult } from './transition';

describe('drawTransition', () => {
  it('allows exactly the draw.md §6 transitions and reports the first failing rule', () => {
    // Table test: 5 statuses × 4 action types = 20 rows
    // Expected: ok only for 4 allowed pairs + all edge cases as specified
    type TestCase = {
      current: DrawStatus;
      action: DrawAction;
      expected: DrawTransitionResult;
      label: string;
    };

    const cases: TestCase[] = [
      // preview + publish (allowed, but check rules 2-4)
      {
        current: 'preview',
        action: { type: 'publish', inputHashMatches: true, conflictCount: 0, acknowledgeConflicts: false },
        expected: { ok: true, next: 'published' },
        label: 'preview + publish(true,0,false) -> published',
      },
      {
        current: 'preview',
        action: { type: 'publish', inputHashMatches: true, conflictCount: 2, acknowledgeConflicts: true },
        expected: { ok: true, next: 'published' },
        label: 'preview + publish(true,2,true) -> published',
      },
      {
        current: 'preview',
        action: { type: 'publish', inputHashMatches: false, conflictCount: 2, acknowledgeConflicts: false },
        expected: { ok: false, code: 'DRAW_INPUT_CHANGED' },
        label: 'preview + publish(false,2,false) -> DRAW_INPUT_CHANGED (check 2)',
      },
      {
        current: 'preview',
        action: { type: 'publish', inputHashMatches: true, conflictCount: 1, acknowledgeConflicts: false },
        expected: { ok: false, code: 'DRAW_CONFLICTS_NOT_ACKNOWLEDGED' },
        label: 'preview + publish(true,1,false) -> DRAW_CONFLICTS_NOT_ACKNOWLEDGED (check 3)',
      },

      // preview + discard (allowed)
      {
        current: 'preview',
        action: { type: 'discard' },
        expected: { ok: true, next: 'discarded' },
        label: 'preview + discard -> discarded',
      },

      // preview + supersede (not allowed)
      {
        current: 'preview',
        action: { type: 'supersede', reason: 'team data was wrong' },
        expected: { ok: false, code: 'DRAW_INVALID_TRANSITION' },
        label: 'preview + supersede -> DRAW_INVALID_TRANSITION',
      },

      // preview + lock (not allowed)
      {
        current: 'preview',
        action: { type: 'lock' },
        expected: { ok: false, code: 'DRAW_INVALID_TRANSITION' },
        label: 'preview + lock -> DRAW_INVALID_TRANSITION',
      },

      // published + publish (not allowed)
      {
        current: 'published',
        action: { type: 'publish', inputHashMatches: true, conflictCount: 0, acknowledgeConflicts: false },
        expected: { ok: false, code: 'DRAW_INVALID_TRANSITION' },
        label: 'published + publish -> DRAW_INVALID_TRANSITION',
      },

      // published + discard (not allowed)
      {
        current: 'published',
        action: { type: 'discard' },
        expected: { ok: false, code: 'DRAW_INVALID_TRANSITION' },
        label: 'published + discard -> DRAW_INVALID_TRANSITION',
      },

      // published + supersede (allowed, but check reason rule)
      {
        current: 'published',
        action: { type: 'supersede', reason: '   ab  ' },
        expected: { ok: false, code: 'DRAW_REASON_REQUIRED' },
        label: 'published + supersede("   ab  ") -> DRAW_REASON_REQUIRED (check 4)',
      },
      {
        current: 'published',
        action: { type: 'supersede', reason: 'team data was wrong' },
        expected: { ok: true, next: 'superseded' },
        label: 'published + supersede("team data was wrong") -> superseded',
      },

      // published + lock (allowed)
      {
        current: 'published',
        action: { type: 'lock' },
        expected: { ok: true, next: 'locked' },
        label: 'published + lock -> locked',
      },

      // discarded + any action -> invalid
      {
        current: 'discarded',
        action: { type: 'publish', inputHashMatches: true, conflictCount: 0, acknowledgeConflicts: false },
        expected: { ok: false, code: 'DRAW_INVALID_TRANSITION' },
        label: 'discarded + publish -> DRAW_INVALID_TRANSITION',
      },
      {
        current: 'discarded',
        action: { type: 'discard' },
        expected: { ok: false, code: 'DRAW_INVALID_TRANSITION' },
        label: 'discarded + discard -> DRAW_INVALID_TRANSITION',
      },
      {
        current: 'discarded',
        action: { type: 'supersede', reason: 'team data was wrong' },
        expected: { ok: false, code: 'DRAW_INVALID_TRANSITION' },
        label: 'discarded + supersede -> DRAW_INVALID_TRANSITION',
      },
      {
        current: 'discarded',
        action: { type: 'lock' },
        expected: { ok: false, code: 'DRAW_INVALID_TRANSITION' },
        label: 'discarded + lock -> DRAW_INVALID_TRANSITION',
      },

      // superseded + any action -> invalid
      {
        current: 'superseded',
        action: { type: 'publish', inputHashMatches: true, conflictCount: 0, acknowledgeConflicts: false },
        expected: { ok: false, code: 'DRAW_INVALID_TRANSITION' },
        label: 'superseded + publish -> DRAW_INVALID_TRANSITION',
      },
      {
        current: 'superseded',
        action: { type: 'discard' },
        expected: { ok: false, code: 'DRAW_INVALID_TRANSITION' },
        label: 'superseded + discard -> DRAW_INVALID_TRANSITION',
      },
      {
        current: 'superseded',
        action: { type: 'supersede', reason: 'team data was wrong' },
        expected: { ok: false, code: 'DRAW_INVALID_TRANSITION' },
        label: 'superseded + supersede -> DRAW_INVALID_TRANSITION',
      },
      {
        current: 'superseded',
        action: { type: 'lock' },
        expected: { ok: false, code: 'DRAW_INVALID_TRANSITION' },
        label: 'superseded + lock -> DRAW_INVALID_TRANSITION',
      },

      // locked + any action -> invalid
      {
        current: 'locked',
        action: { type: 'publish', inputHashMatches: true, conflictCount: 0, acknowledgeConflicts: false },
        expected: { ok: false, code: 'DRAW_INVALID_TRANSITION' },
        label: 'locked + publish -> DRAW_INVALID_TRANSITION',
      },
      {
        current: 'locked',
        action: { type: 'discard' },
        expected: { ok: false, code: 'DRAW_INVALID_TRANSITION' },
        label: 'locked + discard -> DRAW_INVALID_TRANSITION',
      },
      {
        current: 'locked',
        action: { type: 'supersede', reason: 'team data was wrong' },
        expected: { ok: false, code: 'DRAW_INVALID_TRANSITION' },
        label: 'locked + supersede -> DRAW_INVALID_TRANSITION',
      },
      {
        current: 'locked',
        action: { type: 'lock' },
        expected: { ok: false, code: 'DRAW_INVALID_TRANSITION' },
        label: 'locked + lock -> DRAW_INVALID_TRANSITION',
      },
    ];

    for (const { current, action, expected, label } of cases) {
      const result = drawTransition(current, action);
      expect(result).toEqual(expected, label);
    }
  });
});
