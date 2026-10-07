import { describe, expect, it } from 'vitest';
import * as draw from './index';

// Guards the published bl-18 API surface (names Kelly's QA tests and the devs build against).
// Delete this file when the last stub is replaced (bl-18-6).
describe('bl-18 draw API surface', () => {
  it('exports every agreed function', () => {
    for (const name of [
      'bracketOrder',
      'bracketSize',
      'seedCount',
      'planSeeding',
      'drawTransition',
      'solvePlacement',
      'applyWithdrawal',
      'drawBracket',
      'createRng',
      'shuffle',
      'sharesTeam',
    ]) {
      expect(typeof (draw as Record<string, unknown>)[name]).toBe('function');
    }
  });
});
