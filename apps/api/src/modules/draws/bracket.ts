export interface NextSlotResult {
  round: number;
  index: number;
  side: 'top' | 'bottom';
}

/**
 * Pure helper for bracket progression.
 * Given a match at `round` (1-indexed) and `indexInRound` (0-indexed match index within the round),
 * computes the next match slot where the winner advances.
 *
 * Rules:
 * - round: round + 1
 * - index: Math.floor(indexInRound / 2)
 * - side: 'top' when indexInRound is even, 'bottom' when indexInRound is odd
 */
export function nextSlot(round: number, indexInRound: number): NextSlotResult {
  return {
    round: round + 1,
    index: Math.floor(indexInRound / 2),
    side: indexInRound % 2 === 0 ? 'top' : 'bottom',
  };
}
