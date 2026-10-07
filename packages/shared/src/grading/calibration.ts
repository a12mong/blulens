export interface CalibrationItem {
  overall: number;
  referenceIndex: number;
}

export interface CalibrationStats {
  n: number;
  bias: number | null;
  meanAbsError: number | null;
}

export function calibrationStats(items: readonly CalibrationItem[]): CalibrationStats {
  const n = items.length;
  if (n === 0) {
    return { n: 0, bias: null, meanAbsError: null };
  }

  let sumDiff = 0;
  let sumAbsDiff = 0;

  for (const item of items) {
    const { overall, referenceIndex } = item;
    if (
      !Number.isFinite(overall) ||
      overall < 0 ||
      overall >= 15 ||
      !Number.isInteger(referenceIndex) ||
      referenceIndex < 0 ||
      referenceIndex > 14
    ) {
      throw new RangeError('CALIBRATION_INVALID_ITEM');
    }

    const refCenter = referenceIndex + 0.5;
    const d = overall - refCenter;
    sumDiff += d;
    sumAbsDiff += Math.abs(d);
  }

  const bias = sumDiff / n;
  const meanAbsError = sumAbsDiff / n;

  return {
    n,
    bias,
    meanAbsError,
  };
}
