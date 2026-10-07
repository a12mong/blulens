import { describe, expect, it } from 'vitest';
import { calibrationStats } from './calibration';

describe('calibrationStats', () => {
  it('computes bias and mean absolute error against the reference rung centre', () => {
    // 1. [{overall 7.5, ref 7}, {9.0, 7}, {6.5, 7}] -> d = 0, 1.5, -1 -> n 3, bias toBeCloseTo(0.5/3, 10), meanAbsError toBeCloseTo(2.5/3, 10)
    const r1 = calibrationStats([
      { overall: 7.5, referenceIndex: 7 },
      { overall: 9.0, referenceIndex: 7 },
      { overall: 6.5, referenceIndex: 7 },
    ]);
    expect(r1.n).toBe(3);
    expect(r1.bias).not.toBeNull();
    expect(r1.meanAbsError).not.toBeNull();
    expect(r1.bias!).toBeCloseTo(0.5 / 3, 10);
    expect(r1.meanAbsError!).toBeCloseTo(2.5 / 3, 10);

    // 2. [{10.5, 7}] -> n 1, bias 3, meanAbsError 3
    const r2 = calibrationStats([{ overall: 10.5, referenceIndex: 7 }]);
    expect(r2).toEqual({
      n: 1,
      bias: 3,
      meanAbsError: 3,
    });

    // 3. [{7.5, 7}, {8.5, 8}] -> bias 0, meanAbsError 0 (perfectly calibrated)
    const r3 = calibrationStats([
      { overall: 7.5, referenceIndex: 7 },
      { overall: 8.5, referenceIndex: 8 },
    ]);
    expect(r3).toEqual({
      n: 2,
      bias: 0,
      meanAbsError: 0,
    });

    // 4. [{5.5, 7}, {9.5, 7}] -> bias 0, meanAbsError 2 (unbiased but noisy)
    const r4 = calibrationStats([
      { overall: 5.5, referenceIndex: 7 },
      { overall: 9.5, referenceIndex: 7 },
    ]);
    expect(r4).toEqual({
      n: 2,
      bias: 0,
      meanAbsError: 2,
    });
  });

  it('handles empty input correctly', () => {
    const res = calibrationStats([]);
    expect(res).toEqual({
      n: 0,
      bias: null,
      meanAbsError: null,
    });
  });

  it('validates invalid items with RangeError', () => {
    expect(() => calibrationStats([{ overall: 15, referenceIndex: 7 }])).toThrow(RangeError);
    expect(() => calibrationStats([{ overall: 15, referenceIndex: 7 }])).toThrow('CALIBRATION_INVALID_ITEM');

    expect(() => calibrationStats([{ overall: 7.5, referenceIndex: 15 }])).toThrow(RangeError);
    expect(() => calibrationStats([{ overall: 7.5, referenceIndex: 15 }])).toThrow('CALIBRATION_INVALID_ITEM');

    expect(() => calibrationStats([{ overall: 7.5, referenceIndex: 2.5 }])).toThrow(RangeError);
    expect(() => calibrationStats([{ overall: 7.5, referenceIndex: 2.5 }])).toThrow('CALIBRATION_INVALID_ITEM');

    expect(() => calibrationStats([{ overall: NaN, referenceIndex: 7 }])).toThrow(RangeError);
    expect(() => calibrationStats([{ overall: NaN, referenceIndex: 7 }])).toThrow('CALIBRATION_INVALID_ITEM');

    expect(() => calibrationStats([{ overall: -0.1, referenceIndex: 7 }])).toThrow(RangeError);
    expect(() => calibrationStats([{ overall: -0.1, referenceIndex: 7 }])).toThrow('CALIBRATION_INVALID_ITEM');

    expect(() => calibrationStats([{ overall: 7.5, referenceIndex: -1 }])).toThrow(RangeError);
    expect(() => calibrationStats([{ overall: 7.5, referenceIndex: -1 }])).toThrow('CALIBRATION_INVALID_ITEM');
  });

  it('does not mutate input items', () => {
    const items = Object.freeze([
      Object.freeze({ overall: 7.5, referenceIndex: 7 }),
      Object.freeze({ overall: 9.0, referenceIndex: 7 }),
    ]);
    const res = calibrationStats(items);
    expect(res.n).toBe(2);
  });
});
