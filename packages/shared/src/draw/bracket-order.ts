const VALID_SIZES = new Set([2, 4, 8, 16, 32, 64, 128, 256]);

/** Virtual rank at each position: result[p - 1] = rank of position p (1-based). */
export function bracketOrder(size: number): number[] {
  if (!VALID_SIZES.has(size)) {
    throw new RangeError(`bracketOrder: invalid size ${size}`);
  }

  let current = [1, 2];
  while (current.length < size) {
    const next: number[] = [];
    const sum = 2 * current.length + 1;
    for (const r of current) {
      next.push(r, sum - r);
    }
    current = next;
  }

  return current.slice();
}
