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
 * slots[p - 1] = position p. Throws RangeError('DRAW_ENTRY_NOT_IN_DRAW') if the entry is absent.
 */
export function applyWithdrawal(
  slots: readonly SlotValue[],
  entryId: string,
  reserveIds: readonly string[],
): WithdrawalResult {
  return notImplemented(`bl-18-5 applyWithdrawal(${slots.length}, ${entryId}, ${reserveIds.length})`);
}
