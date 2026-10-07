import { notImplemented } from './stub';

/**
 * Virtual rank at each bracket position (draw.md appendix A, draw-v1):
 * result[p - 1] = rank of position p (1-based). Size must be 2, 4, ..., 256.
 * Example: bracketOrder(8) = [1, 8, 4, 5, 2, 7, 3, 6].
 */
export function bracketOrder(size: number): number[] {
  return notImplemented(`bl-18-1 bracketOrder(${size})`);
}
