import { chartGeom, formatCap, formatChange, formatPrice, hereRows, hereText } from '@/screens/home/format';

test('prices: 4 decimals under $1, 2 above, with thousands', () => {
  expect(formatPrice(0.05822)).toBe('$0.0582');
  expect(formatPrice(1234.5)).toBe('$1,234.50');
});

test('change: a sign always, real minus, 2 decimals', () => {
  expect(formatChange(-0.308)).toBe('−0.31%');
  expect(formatChange(1.5)).toBe('+1.50%');
  expect(formatChange(0)).toBe('+0.00%');
});

test('cap: shortened', () => {
  expect(formatCap(11487970.4)).toBe('cap $11.5M');
  expect(formatCap(2_400_000_000)).toBe('cap $2.4B');
  expect(formatCap(950)).toBe('cap $950');
  expect(formatCap(12_300)).toBe('cap $12.3k');
  // rounding up to the next unit names that unit
  expect(formatCap(999_950)).toBe('cap $1M');
  expect(formatCap(999.7)).toBe('cap $1k');
});

test('the total in the site words', () => {
  const w = { count: 18, byCountry: [], elsewhere: 0, geo: true };
  expect(hereText(w)).toBe('18 people');
  expect(hereText({ ...w, count: 1 })).toBe('just you');
  expect(hereText({ ...w, count: 0 })).toBe('nobody here right now');
  expect(hereText({ ...w, geo: false })).toBe('18 people · countries unavailable on this build');
});

test('rows: bars against the biggest, elsewhere without a bar', () => {
  expect(hereRows({ count: 6, byCountry: [{ cc: 'FR', n: 3 }, { cc: 'AU', n: 1 }], elsewhere: 2, geo: true })).toEqual([
    { cc: 'FR', name: 'France', n: 3, share: 1 },
    { cc: 'AU', name: 'Australia', n: 1, share: 1 / 3 },
    { cc: '', name: 'elsewhere', n: 2, share: null },
  ]);
});

test('countries unavailable: one "unknown" row with a full bar and the total', () => {
  expect(hereRows({ count: 18, byCountry: [], elsewhere: 0, geo: false })).toEqual([{ cc: '', name: 'unknown', n: 18, share: 1 }]);
  expect(hereRows({ count: 0, byCountry: [], elsewhere: 0, geo: false })).toEqual([]);
});

test('chart: spans the width, highest at the top, lowest at the bottom', () => {
  const g = chartGeom([[0, 1], [10, 3], [20, 2]], 200, 50)!;
  expect(g).toEqual({ points: '0,50 100,0 200,25', min: 1, max: 3 });
});

test('chart: a flat price is a line in the middle; fewer than 2 points is no chart', () => {
  expect(chartGeom([[0, 2], [10, 2]], 100, 40)).toEqual({ points: '0,20 100,20', min: 2, max: 2 });
  expect(chartGeom([[0, 2]], 100, 40)).toBeNull();
  expect(chartGeom([], 100, 40)).toBeNull();
});
