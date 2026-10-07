#!/usr/bin/env node
/**
 * Verification script for outlier detection test fixtures
 * Computes median, MAD, and z-scores for all test cases
 */

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function mad(values) {
  const m = median(values);
  const deviations = values.map((v) => Math.abs(v - m));
  return median(deviations);
}

function robustZ(value, medianVal, madVal) {
  if (madVal === 0) return null;
  return (0.6745 * (value - medianVal)) / madVal;
}

function analyzeFixture(name, values) {
  const m = median(values);
  const mad_val = mad(values);
  const results = values.map((v, idx) => ({
    index: idx,
    value: v,
    deviation: Math.abs(v - m),
    robustZ: robustZ(v, m, mad_val),
  }));

  console.log(`\n${name}:`);
  console.log(`  Values: [${values.join(', ')}]`);
  console.log(`  M=${m.toFixed(4)}, MAD=${mad_val.toFixed(4)}`);
  results.forEach((r) => {
    if (r.robustZ !== null) {
      console.log(
        `    [${r.index}] ${r.value}: dev=${r.deviation.toFixed(4)}, z=${r.robustZ.toFixed(4)}`
      );
    } else {
      console.log(`    [${r.index}] ${r.value}: dev=${r.deviation.toFixed(4)}, z=undefined (MAD=0)`);
    }
  });
}

console.log('=== Z-Boundary Test Fixtures ===');

// Wrong fixture from my test (included for reference)
analyzeFixture('WRONG [6.4, 7.5, 8.6, 12.7]', [6.4, 7.5, 8.6, 12.7]);

// CORRECT fixtures from Dwight
analyzeFixture('CORRECT [7, 7, 8, 9, 13.18] - z just below 3.5', [7, 7, 8, 9, 13.18]);
analyzeFixture('CORRECT [7, 7, 8, 9, 13.20] - z just above 3.5', [7, 7, 8, 9, 13.20]);
analyzeFixture('CORRECT [8.0, 8.5, 9.0, 9.5, 15.0] - clear outlier', [8.0, 8.5, 9.0, 9.5, 15.0]);

// Wrong fixtures from my rework (included for reference)
analyzeFixture('WRONG [5.5, 7.5, 9.5, 12.5]', [5.5, 7.5, 9.5, 12.5]);

console.log('\n\n=== Golden Fixtures from Appendix C ===');
analyzeFixture('C.1: [7.50, 7.50, 7.83]', [7.5, 7.5, 7.83]);
analyzeFixture('C.3: [7.50, 7.83, 8.17, 11.00]', [7.5, 7.83, 8.17, 11.0]);
analyzeFixture('C.4: [6.50, 7.50, 9.50]', [6.5, 7.5, 9.5]);
analyzeFixture('C.5: [7.50, 7.50, 11.50]', [7.5, 7.5, 11.5]);

console.log('\n\n=== Additional Test Cases ===');
analyzeFixture('[7, 7, 7, 9.01] - 2.01 deviation', [7, 7, 7, 9.01]);
analyzeFixture('[7, 7, 7, 9.0] - 2.0 exactly', [7, 7, 7, 9.0]);
analyzeFixture('[4, 4, 10, 10] - bipolar large gap', [4, 4, 10, 10]);
analyzeFixture('[7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 12.0, 2.0] - n=8 quota', [7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 12.0, 2.0]);

console.log('\n\n=== TABLE FOR DOCUMENTATION ===');
console.log('Fixture Name | Values | M | MAD | max dev | max z | candidates');
console.log('-'.repeat(90));
const fixtures = [
  ['C.3', [7.5, 7.83, 8.17, 11.0]],
  ['z<3.5', [7, 7, 8, 9, 13.18]],
  ['z>3.5', [7, 7, 8, 9, 13.20]],
  ['clear', [8.0, 8.5, 9.0, 9.5, 15.0]],
];
fixtures.forEach(([name, vals]) => {
  const m = median(vals);
  const mad_val = mad(vals);
  const devs = vals.map((v) => Math.abs(v - m));
  const maxDev = Math.max(...devs);
  const zs = devs.map((d) => robustZ(vals[devs.indexOf(d)], m, mad_val) || 0);
  const maxZ = Math.max(...zs);
  console.log(
    `${name.padEnd(12)} | ${maxDev.toFixed(2)} dev | ${m.toFixed(4)} | ${mad_val.toFixed(4)} | ${maxZ.toFixed(4)}`
  );
});
