import { describe, expect, it } from 'vitest';
import { applyWithdrawal } from './withdrawal';

describe('applyWithdrawal', () => {
  // Standard 8-slot bracket for testing
  const slots8 = ['A1', null, 'A2', 'C1', 'B1', null, 'B2', 'A3'] as const;

  it('uses the first reserve, else gives the round-1 opponent a walkover, never redraws', () => {
    // Case 1: applyWithdrawal(slots8, 'C1', ['R1','R2'])
    // C1 is at position 4 (0-based index 3)
    // With reserves, use first one
    const result1 = applyWithdrawal([...slots8], 'C1', ['R1', 'R2']);
    expect(result1.slots).toEqual(['A1', null, 'A2', 'R1', 'B1', null, 'B2', 'A3']);
    expect(result1.remainingReserveIds).toEqual(['R2']);
    expect(result1.outcome).toEqual({ kind: 'reserve', position: 4, reserveId: 'R1' });

    // Case 2: applyWithdrawal(slots8, 'A2', [])
    // A2 is at position 3 (0-based index 2)
    // Position 3 is odd, so opponent is at position 4: C1
    const result2 = applyWithdrawal([...slots8], 'A2', []);
    expect(result2.slots).toEqual(['A1', null, null, 'C1', 'B1', null, 'B2', 'A3']);
    expect(result2.remainingReserveIds).toEqual([]);
    expect(result2.outcome).toEqual({ kind: 'walkover', position: 3, opponentId: 'C1' });

    // Case 3: applyWithdrawal(slots8, 'A3', [])
    // A3 is at position 8 (0-based index 7)
    // Position 8 is even, so opponent is at position 7: B2
    const result3 = applyWithdrawal([...slots8], 'A3', []);
    expect(result3.slots).toEqual(['A1', null, 'A2', 'C1', 'B1', null, 'B2', null]);
    expect(result3.remainingReserveIds).toEqual([]);
    expect(result3.outcome).toEqual({ kind: 'walkover', position: 8, opponentId: 'B2' });

    // Case 4: applyWithdrawal(slots8, 'A1', [])
    // A1 is at position 1 (0-based index 0)
    // Position 1 is odd, so opponent is at position 2: null (bye)
    const result4 = applyWithdrawal([...slots8], 'A1', []);
    expect(result4.slots).toEqual([null, null, 'A2', 'C1', 'B1', null, 'B2', 'A3']);
    expect(result4.remainingReserveIds).toEqual([]);
    expect(result4.outcome).toEqual({ kind: 'walkover', position: 1, opponentId: null });
  });

  it('throws RangeError for invalid slots length', () => {
    // Not power of 2
    expect(() => applyWithdrawal(['A', 'B', 'C'], 'A', [])).toThrow(
      new RangeError('DRAW_INVALID_SLOTS'),
    );

    // Length 1 (not >= 2)
    expect(() => applyWithdrawal(['A'], 'A', [])).toThrow(
      new RangeError('DRAW_INVALID_SLOTS'),
    );

    // Length 0
    expect(() => applyWithdrawal([], 'A', [])).toThrow(
      new RangeError('DRAW_INVALID_SLOTS'),
    );

    // Length 6 (not power of 2)
    expect(() => applyWithdrawal(['A', 'B', 'C', 'D', 'E', 'F'], 'A', [])).toThrow(
      new RangeError('DRAW_INVALID_SLOTS'),
    );
  });

  it('throws RangeError if entry not found in slots', () => {
    expect(() => applyWithdrawal([...slots8], 'ZZ', [])).toThrow(
      new RangeError('DRAW_ENTRY_NOT_IN_DRAW'),
    );

    expect(() => applyWithdrawal([...slots8], 'B3', ['R1'])).toThrow(
      new RangeError('DRAW_ENTRY_NOT_IN_DRAW'),
    );
  });

  it('throws RangeError if reserve is already in the draw', () => {
    expect(() => applyWithdrawal([...slots8], 'C1', ['B2'])).toThrow(
      new RangeError('DRAW_DUPLICATE_ENTRY'),
    );

    expect(() => applyWithdrawal([...slots8], 'A2', ['A1'])).toThrow(
      new RangeError('DRAW_DUPLICATE_ENTRY'),
    );
  });

  it('never mutates the input arrays', () => {
    const slots = ['A', 'B', 'C', 'D'] as const;
    const reserves = ['R1', 'R2'] as const;
    const slotsCopy = [...slots];
    const reservesCopy = [...reserves];

    applyWithdrawal(slots, 'A', reserves);

    expect(slots).toEqual(slotsCopy);
    expect(reserves).toEqual(reservesCopy);
  });

  it('correctly identifies round-1 opponents in larger brackets', () => {
    // 16-slot bracket
    const slots16 = [
      'A1', null, 'A2', 'C1', 'B1', null, 'B2', 'A3',
      'D1', null, 'D2', 'E1', 'E2', null, 'F1', 'F2',
    ] as const;

    // Position 1 (odd) → opponent at position 2 (null)
    const r1 = applyWithdrawal([...slots16], 'A1', []);
    expect(r1.outcome).toEqual({ kind: 'walkover', position: 1, opponentId: null });

    // Position 4 (even) → opponent at position 3 (C1)
    const r4 = applyWithdrawal([...slots16], 'C1', []);
    expect(r4.outcome).toEqual({ kind: 'walkover', position: 4, opponentId: 'A2' });

    // Position 9 (odd) → opponent at position 10 (null)
    const r9 = applyWithdrawal([...slots16], 'D1', []);
    expect(r9.outcome).toEqual({ kind: 'walkover', position: 9, opponentId: null });

    // Position 16 (even) → opponent at position 15 (F1)
    const r16 = applyWithdrawal([...slots16], 'F2', []);
    expect(r16.outcome).toEqual({ kind: 'walkover', position: 16, opponentId: 'F1' });
  });
});
