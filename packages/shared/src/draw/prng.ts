/**
 * Deterministic PRNG for draws (draw.md §4: never the system RNG).
 * Seed string -> cyrb128 -> 128-bit state -> xoshiro128**.
 * Same seed string = same sequence on every machine and in every JS runtime.
 */

export interface Rng {
  /** Next raw 32-bit unsigned integer. */
  nextUint32(): number;
  /** Unbiased integer in [0, n). n must be an integer in [1, 2^32]. */
  int(n: number): number;
}

/** cyrb128 string hash -> four 32-bit words. Iterates UTF-16 code units. */
export function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

const rotl = (x: number, k: number) => (x << k) | (x >>> (32 - k));

/** xoshiro128** over an explicit 4-word state (exported for the reference-vector test). */
export function xoshiro128ss(state: readonly [number, number, number, number]): () => number {
  let [a, b, c, d] = state;
  if ((a | b | c | d) === 0) a = 1; // the all-zero state is a fixed point
  return () => {
    const result = Math.imul(rotl(Math.imul(b, 5), 7), 9) >>> 0;
    const t = b << 9;
    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;
    c ^= t;
    d = rotl(d, 11);
    return result;
  };
}

export function createRng(seed: string): Rng {
  const next = xoshiro128ss(cyrb128(seed));
  return {
    nextUint32: next,
    int(n: number): number {
      if (!Number.isInteger(n) || n < 1 || n > 2 ** 32) {
        throw new RangeError(`rng.int: n must be an integer in [1, 2^32], got ${n}`);
      }
      // rejection sampling: drop the top partial bucket so every value is equally likely
      const limit = 2 ** 32 - (2 ** 32 % n);
      let u = next();
      while (u >= limit) u = next();
      return u % n;
    },
  };
}

/** Fisher-Yates shuffle into a new array; the input is not modified. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}
