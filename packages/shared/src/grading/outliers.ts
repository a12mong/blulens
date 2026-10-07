export const OUTLIER_MIN_DEVIATION = 2.0;
export const OUTLIER_MIN_ROBUST_Z = 3.5;
/** Float tolerance for the strict comparisons above (2-decimal inputs). */
export const OUTLIER_EPSILON = 1e-9;

export interface OutlierItem {
  index: number; // position in the input array
  value: number;
  deviation: number; // |value - median|
  robustZ: number | null; // null when MAD = 0
  candidate: boolean; // passes the outlier test before the E_max cap
  excluded: boolean; // candidate AND within the E_max cap
}

export interface OutlierReport {
  n: number;
  median: number;
  mad: number;
  maxExclusions: number; // E_max (0 when n < 3)
  items: OutlierItem[]; // same order as the input
  excludedIndexes: number[]; // ascending
}

function computeMedian(arr: readonly number[]): number {
  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid]!;
  }
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function detectOutliers(values: readonly number[]): OutlierReport {
  if (values.length === 0) {
    throw new RangeError('GRADING_NO_SCORES');
  }

  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new RangeError('GRADING_INVALID_SCORE');
    }
  }

  const n = values.length;
  const median = computeMedian(values);
  const deviations = values.map((v) => Math.abs(v - median));
  const mad = computeMedian(deviations);

  const maxExclusions = n < 3 ? 0 : n < 8 ? 1 : Math.floor(n / 4);

  const items: OutlierItem[] = values.map((value, index) => {
    const deviation = deviations[index]!;
    const robustZ = mad === 0 ? null : (0.6745 * (value - median)) / mad;
    const candidate =
      n >= 3 &&
      deviation > OUTLIER_MIN_DEVIATION + OUTLIER_EPSILON &&
      (mad === 0 || (robustZ !== null && Math.abs(robustZ) > OUTLIER_MIN_ROBUST_Z + OUTLIER_EPSILON));

    return {
      index,
      value,
      deviation,
      robustZ,
      candidate,
      excluded: false,
    };
  });

  const candidates = items.filter((item) => item.candidate);
  candidates.sort((a, b) => {
    if (Math.abs(b.deviation - a.deviation) > OUTLIER_EPSILON) {
      return b.deviation - a.deviation;
    }
    return a.index - b.index;
  });

  const excludedIndexSet = new Set<number>();
  for (let i = 0; i < Math.min(maxExclusions, candidates.length); i++) {
    const excludedIndex = candidates[i]!.index;
    excludedIndexSet.add(excludedIndex);
    items[excludedIndex]!.excluded = true;
  }

  const excludedIndexes = Array.from(excludedIndexSet).sort((a, b) => a - b);

  return {
    n,
    median,
    mad,
    maxExclusions,
    items,
    excludedIndexes,
  };
}
