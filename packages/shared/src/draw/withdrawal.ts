import { notImplemented } from './stub';
import type { SlotValue } from './types';

export type WithdrawalOutcome =
  /** The first reserve takes the withdrawn entry's slot. */
  | { kind: 'reserve'; position: number; reserveId: string }
  /** No reserve left: the round-1 opponent advances (null opponent = the slot faced a bye). */
  | { kind: 'walkover'; position: number; opponentId: string | null };

export interface WithdrawalResult {
  slots: SlotValue[];
  remainingReserveIds: string[];
  outcome: WithdrawalOutcome;
}

/**
 * Withdrawal after publishing never redraws (draw.md §7, D6).
 * slots[p - 1] = position p (1-based). If a reserve exists, it takes the slot; otherwise, the opponent gets a walkover.
 * Throws RangeError if slots.length is not a power of 2 >= 2, or entry not found.
 */
export function applyWithdrawal(
  slots: readonly SlotValue[],
  entryId: string,
  reserveIds: readonly string[],
): WithdrawalResult {
  // Validate slots is a power of 2 >= 2
  const n = slots.length;
  if (n < 2 || (n & (n - 1)) !== 0) {
    throw new RangeError('DRAW_INVALID_SLOTS');
  }

  // Find position (1-based) of the withdrawn entry
  let position = -1;
  for (let i = 0; i < n; i++) {
    if (slots[i] === entryId) {
      position = i + 1; // Convert to 1-based
      break;
    }
  }

  if (position === -1) {
    throw new RangeError('DRAW_ENTRY_NOT_IN_DRAW');
  }

  // Create a copy of slots for mutation
  const newSlots = [...slots];
  const slotIndex = position - 1; // Convert back to 0-based for array access

  // If there's a reserve, use it
  if (reserveIds.length > 0) {
    const reserve = reserveIds[0]!;

    // Check the reserve is not already in the draw
    if (slots.includes(reserve)) {
      throw new RangeError('DRAW_DUPLICATE_ENTRY');
    }

    newSlots[slotIndex] = reserve;

    return {
      slots: newSlots,
      remainingReserveIds: reserveIds.slice(1),
      outcome: {
        kind: 'reserve',
        position,
        reserveId: reserve,
      },
    };
  }

  // No reserve: set slot to null (bye), opponent gets walkover
  newSlots[slotIndex] = null;

  // Find opponent: position p has opponent at p+1 (if p odd) or p-1 (if p even)
  const opponentPosition = position % 2 === 1 ? position + 1 : position - 1;
  const opponentId = opponentPosition <= n ? slots[opponentPosition - 1]! : null;

  return {
    slots: newSlots,
    remainingReserveIds: [],
    outcome: {
      kind: 'walkover',
      position,
      opponentId,
    },
  };
}
